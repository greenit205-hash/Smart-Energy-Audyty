/* Smart Energy Audyty - domykanie pomieszczeń i liczenie powierzchni.
 * Uruchomienie:  node tests/test-obrysy.js     (wymaga: npm install)
 *
 * Scenariusze odwzorowują to, co realnie powstaje przy szkicowaniu na tablecie:
 * niedomknięte narożniki, ściany narysowane z przestrzeleniem, pokoje o wielu
 * ścianach, ścianki działowe, ciągi. Sprawdzamy DWIE rzeczy naraz:
 *   1. czy program rozpoznaje obrys (🏠 Pomieszcz.),
 *   2. czy powierzchnia wychodzi dokładnie tyle, ile powinna.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require('jsdom'));
} catch (e) {
  console.log('Ten zestaw potrzebuje biblioteki jsdom. Zainstaluj raz:\n\n    npm install\n');
  process.exit(2);
}

function pustyKontekst2D() {
  const nic = () => {};
  const ctx = { canvas: { width: 3000, height: 3000 }, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic };
  return new Proxy(ctx, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

const konsola = new VirtualConsole();
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  virtualConsole: konsola, runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://example.org/',
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => pustyKontekst2D();
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    w.alert = () => {}; w.confirm = () => true; w.prompt = () => null; w.scrollTo = () => {};
  }
});
const app = kod => dom.window.eval('(function(){' + kod + '})()');

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

function reset() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 envTags:{}, noteLines:[], apexDims:{}, hatches:[], slopes:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects;
  `);
}

/* Rysuje ściany z listy punktów w METRACH (obrys zamknięty automatycznie),
 * opcjonalnie z zaburzeniem końców w pikselach: [dx1,dy1,dx2,dy2] na ścianę.
 * Zwraca klucze odcinków, żeby dało się wpisać wymiary. */
function rysuj(punkty, zaburzenia) {
  return app(`
    const P = PIXELS_PER_METER, O = 200;
    const pkt = ${JSON.stringify(punkty)}.map(p => ({ x: O + p[0]*P, y: O + p[1]*P }));
    const zab = ${JSON.stringify(zaburzenia || [])};
    const klucze = [];
    for (let i = 0; i < pkt.length; i++) {
      const a = pkt[i], b = pkt[(i + 1) % pkt.length];
      const z = zab[i] || [0,0,0,0];
      const linia = { x1: a.x + z[0], y1: a.y + z[1], x2: b.x + z[2], y2: b.y + z[3] };
      objects.lines.push(linia);
      klucze.push(getSegKey(linia.x1, linia.y1, linia.x2, linia.y2));
    }
    return klucze;
  `);
}

// Klika w podanym punkcie (metry) tak jak narzędzie 🏠 Pomieszcz. i zwraca obrys
function rozpoznajObrys(xm, ym) {
  return app(`
    const P = PIXELS_PER_METER, O = 200;
    const pt = { x: O + ${xm}*P, y: O + ${ym}*P };
    const faces = findPlanarFaces();
    let best = null, bestArea = Infinity;
    faces.forEach(f => {
      const poly = simplifyPolygon(f);
      if (poly.length < 3) return;
      if (!pointInPolygon(pt, poly)) return;
      const a = Math.abs(polygonSignedArea(poly));
      if (a > 1 && a < bestArea) { bestArea = a; best = poly; }
    });
    return best ? { rogi: best.length, poly: best } : null;
  `);
}

// Zakłada pomieszczenie na rozpoznanym obrysie i liczy powierzchnię
function polePokoju(poly, wymiary) {
  return app(`
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie', polygon:${JSON.stringify(poly)} }];
    const wym = ${JSON.stringify(wymiary || {})};
    Object.keys(wym).forEach(k => { objects.customDims[k] = { val: String(wym[k]) }; });
    recalculateRooms();
    const r = objects.rooms[0];
    return { area: r.area, needsDim: !!r.needsDim, brakuje: (r._missingKeys || []).length };
  `);
}

// Rysowanie DOKŁADNIE tak, jak robi to aplikacja: przyciąganie do istniejących
// ścian, prostowanie prawie prostych linii, zaokrąglenie do 1 cm. Dzięki temu
// testujemy szkic, jaki naprawdę powstaje pod palcem na tablecie, a nie idealny
// prostokąt wpisany z klawiatury.
const RYSOWANIE = `
  function rysujSciane(a, b) {
    let s = findSnapPoint(a);
    let start = { x: snapTo1cm(s.pt.x), y: snapTo1cm(s.pt.y) };
    let t = { x: b.x, y: b.y };
    let si = findSnapPoint(t);
    if (si.type === 'node') { t = si.pt; }
    else {
      const dx = b.x - start.x, dy = b.y - start.y;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (Math.abs(ang) <= ORTHO_ANGLE_TOLERANCE || Math.abs(ang) >= 180 - ORTHO_ANGLE_TOLERANCE) t.y = start.y;
      else if (Math.abs(ang - 90) <= ORTHO_ANGLE_TOLERANCE || Math.abs(ang + 90) <= ORTHO_ANGLE_TOLERANCE) t.x = start.x;
      const os = findSnapPoint(t);
      if (os.type === 'line') t = os.pt;
    }
    objects.lines.push({ x1: start.x, y1: start.y, x2: snapTo1cm(t.x), y2: snapTo1cm(t.y) });
  }
  function znajdzObrys(xm, ym) {
    const P = PIXELS_PER_METER, O = 200;
    const pt = { x: O + xm * P, y: O + ym * P };
    let face = null, best = Infinity;
    findPlanarFaces().forEach(f => {
      const p = simplifyPolygon(f);
      if (p.length >= 3 && pointInPolygon(pt, p)) {
        const a = Math.abs(polygonSignedArea(p));
        if (a > 1 && a < best) { best = a; face = p; }
      }
    });
    return face;
  }
  // klucz taki, jaki zapisuje aplikacja, gdy audytor dotknie ściany i wpisze wymiar
  function kluczDotkniecia(l) { return getSegKey(l.x1, l.y1, l.x2, l.y2); }
`;

/* Rysuje pomieszczenie o zadanym kształcie (metry) z niedokładnością palca,
 * rozpoznaje obrys, wpisuje wymiary jak audytor i zwraca policzoną powierzchnię. */
function szkicuj(ksztalt, wymiary, klikX, klikY, drzenie) {
  return app(RYSOWANIE + `
    sketches = [{ id:1, name:'Parter', kind:'rzut', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 envTags:{}, noteLines:[], apexDims:{}, hatches:[], slopes:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    const P = PIXELS_PER_METER, O = 200, D = ${drzenie === undefined ? 7 : drzenie};
    const R = () => (Math.random() * 2 * D - D);
    const p = ${JSON.stringify(ksztalt)};
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      rysujSciane({ x:O + a[0]*P + R(), y:O + a[1]*P + R() },
                  { x:O + b[0]*P + R(), y:O + b[1]*P + R() });
    }
    const face = znajdzObrys(${klikX}, ${klikY});
    if (!face) return { obrys:false };
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie', polygon: face }];
    ${JSON.stringify(wymiary)}.forEach((v, i) => {
      if (v) objects.customDims[kluczDotkniecia(objects.lines[i])] = { val: v };
    });
    recalculateRooms();
    const ostrz = runAuditChecks().filter(x => x.level === 'warn').map(x => x.text);
    return { obrys:true, rogi: face.length, area: objects.rooms[0].area,
             ostrzegaOSkosie: ostrz.some(t => t.includes('ukośnie')) };
  `);
}

// Powtarzamy każdy kształt wiele razy, bo niedokładność palca jest losowa
// i błąd potrafi się ujawniać raz na kilka szkiców.
function seria(nazwa, ksztalt, wymiary, oczekiwane, klikX, klikY, powtorzen, prog, drzenie) {
  let policzone = 0, prosiOPomiar = 0, ukosne = 0, bledne = [];
  for (let i = 0; i < (powtorzen || 60); i++) {
    const r = szkicuj(ksztalt, wymiary, klikX, klikY, drzenie);
    if (!r.obrys) { prosiOPomiar++; continue; }
    if (r.area === oczekiwane) policzone++;
    else if (r.area === 'Wymaga pomiaru!') prosiOPomiar++;
    else if (r.ostrzegaOSkosie) ukosne++;   // krzywo narysowana ściana - kontrola o tym mówi
    else bledne.push(r.area);
  }
  const n = powtorzen || 60;
  // NAJWAŻNIEJSZE: powierzchnia nigdy nie może wyjść inna niż prawdziwa.
  // Powierzchnia inna niż prawdziwa jest dopuszczalna wyłącznie wtedy, gdy ściana
  // została narysowana ukośnie I kontrola pomiarów o tym ostrzega. Cicha pomyłka
  // to błąd, bo audytor nie ma szansy jej zauważyć.
  sprawdz(nazwa + ' — nie podaje błędnej powierzchni bez ostrzeżenia', bledne.length === 0,
    [...new Set(bledne)].join(', '));
  // A po naprawie kluczy praktycznie zawsze da się ją policzyć.
  sprawdz(nazwa + ' — liczy powierzchnię mimo drżenia ręki', policzone >= n * (prog || 0.9),
    policzone + '/' + n + ' (prosi o pomiar: ' + prosiOPomiar + ', ukośne: ' + ukosne + ')');
}

console.log('--- rozpoznawanie obrysu ---');


// 1. Zwykły prostokąt, narysowany czysto
reset();
{
  const k = rysuj([[0,0],[5,0],[5,4],[0,4]]);
  const o = rozpoznajObrys(2.5, 2);
  sprawdz('prostokąt jest rozpoznawany', !!o);
  sprawdz('prostokąt ma 4 rogi', o && o.rogi === 4, o && o.rogi);
  const p = polePokoju(o.poly, { [k[0]]: 5.00, [k[1]]: 4.00 });
  sprawdz('prostokąt 5×4 = 20,00 m²', p.area === '20.00', p.area);
}

// 2-4. Szkic rysowany jak na tablecie: drżąca ręka, przyciąganie, prostowanie.
// To jest scenariusz, w którym wyszedł błąd z rozjeżdżającymi się kluczami odcinków:
// audytor mierzył wszystkie ściany, a pokój i tak pokazywał „Wymaga pomiaru!".
seria('prostokąt 5×4', [[0,0],[5,0],[5,4],[0,4]], ['5.00','4.00'], '20.00', 2.5, 2, 80);
seria('pokój L 6 ścian', [[0,0],[6,0],[6,3],[3,3],[3,5],[0,5]],
      ['6.00','3.00','3.00','2.00','3.00'], '24.00', 1, 1, 80);
// Ośmiościenny pokój przy realnym drżeniu (±3 px ≈ 6 cm na koniec ściany)
seria('pokój z wnęką, 8 ścian', [[0,0],[6,0],[6,4],[4,4],[4,2],[2,2],[2,4],[0,4]],
      ['6.00','4.00','2.00','2.00','2.00','2.00','2.00'], '20.00', 1, 1, 60, 0.95, 3);
// Ten sam pokój przy bardzo niechlujnym rysunku (±7 px ≈ 14 cm na każdy koniec).
// Tu część szkiców słusznie prosi o pomiar - wymagamy tylko, żeby większość
// dawała się policzyć i żeby ŻADEN nie podał złej powierzchni bez ostrzeżenia.
seria('pokój z wnęką, rysowany niechlujnie', [[0,0],[6,0],[6,4],[4,4],[4,2],[2,2],[2,4],[0,4]],
      ['6.00','4.00','2.00','2.00','2.00','2.00','2.00'], '20.00', 1, 1, 60, 0.6, 7);

// Gdy dziura w obrysie jest naprawdę duża, program NIE może jej domykać po cichu
reset();
{
  rysuj([[0,0],[5,0],[5,4],[0,4]], [[0,0,-40,0], [0,0,0,0], [0,0,0,0], [0,0,40,0]]);
  const o = rozpoznajObrys(2.5, 2);
  sprawdz('luka 40 px nie jest domykana po cichu', !o, o && ('rozpoznano ' + o.rogi + ' rogów'));
}

// 5. Pokój w kształcie litery L - 6 ścian
reset();
{
  const k = rysuj([[0,0],[6,0],[6,3],[3,3],[3,5],[0,5]]);
  const o = rozpoznajObrys(1, 1);
  sprawdz('obrys L jest rozpoznawany', !!o);
  sprawdz('obrys L ma 6 rogów', o && o.rogi === 6, o && o.rogi);
  // 6×3 + 3×2 = 18 + 6 = 24 m². Na każdej osi jedna ściana wynika z zamknięcia.
  const p = polePokoju(o.poly, { [k[0]]:6.00, [k[1]]:3.00, [k[2]]:3.00, [k[3]]:2.00, [k[4]]:3.00 });
  sprawdz('pokój L = 24,00 m²', p.area === '24.00', p.area);
}

// 6. Pokój 8-ścienny (wnęka) - tu wcześniej potrafiło się nie domknąć
reset();
{
  const k = rysuj([[0,0],[6,0],[6,4],[4,4],[4,2],[2,2],[2,4],[0,4]]);
  const o = rozpoznajObrys(1, 1);
  sprawdz('obrys z wnęką jest rozpoznawany', !!o);
  sprawdz('obrys z wnęką ma 8 rogów', o && o.rogi === 8, o && o.rogi);
  // 6×4 = 24, minus wnęka 2×2 = 4  ->  20 m²
  const p = polePokoju(o.poly,
    { [k[0]]:6.00, [k[1]]:4.00, [k[2]]:2.00, [k[3]]:2.00, [k[4]]:2.00, [k[5]]:2.00, [k[6]]:2.00 });
  sprawdz('pokój z wnęką = 20,00 m²', p.area === '20.00', p.area);
}

// 7. Dwa pokoje rozdzielone ścianką - każdy osobno, bez zlewania się
reset();
{
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,0, 8,0); L(8,0, 8,4); L(8,4, 0,4); L(0,4, 0,0);
    L(5,0, 5,4);              // ścianka działowa
  `);
  const lewy = rozpoznajObrys(2, 2);
  const prawy = rozpoznajObrys(6.5, 2);
  sprawdz('lewy pokój rozpoznany osobno', !!lewy);
  sprawdz('prawy pokój rozpoznany osobno', !!prawy);
  sprawdz('ścianka dzieli, a nie zlewa', lewy && prawy &&
    Math.abs(Math.abs(dom.window.polygonSignedArea(lewy.poly)) -
             Math.abs(dom.window.polygonSignedArea(prawy.poly))) > 1);
  sprawdz('lewy pokój ma 4 rogi', lewy && lewy.rogi === 4, lewy && lewy.rogi);
}

console.log('--- liczenie powierzchni ---');

// 8. Prostokąt: dwa pomiary wystarczą, jeden nie
reset();
{
  const k = rysuj([[0,0],[5,0],[5,4],[0,4]]);
  const o = rozpoznajObrys(2.5, 2);
  sprawdz('dwa pomiary wystarczają', polePokoju(o.poly, { [k[0]]:5.00, [k[1]]:4.00 }).needsDim === false);
  reset(); rysuj([[0,0],[5,0],[5,4],[0,4]]);
  const p = polePokoju(rozpoznajObrys(2.5, 2).poly, { [k[0]]:5.00 });
  sprawdz('jeden pomiar to za mało', p.needsDim === true, p.area);
  sprawdz('brakujący pomiar jest wskazany', p.brakuje >= 1, p.brakuje);
}

// 9. Ciąg ścian: górna ściana podzielona ścianką działową, mierzona odcinkami
reset();
{
  const wynik = app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return l; };
    L(0,0, 2,0); L(2,0, 6,0); L(6,0, 6,4); L(6,4, 0,4); L(0,4, 0,0);
    L(2,0, 2,-1);                      // ścianka sąsiedniego pomieszczenia dobija do górnej ściany
    let face = null, best = Infinity;
    const pt = { x:O+3*P, y:O+2*P };
    findPlanarFaces().forEach(f => { const p = simplifyPolygon(f);
      if (p.length >= 3 && pointInPolygon(pt, p)) { const a = Math.abs(polygonSignedArea(p));
        if (a > 1 && a < best) { best = a; face = p; } } });
    if (!face) return 'BRAK OBRYSU';
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie', polygon: face }];
    objects.customDims[getSegKey(O, O, O+2*P, O)] = { val:'2.00' };
    objects.customDims[getSegKey(O+2*P, O, O+6*P, O)] = { val:'4.00' };
    objects.customDims[getSegKey(O+6*P, O, O+6*P, O+4*P)] = { val:'4.00' };
    recalculateRooms();
    return objects.rooms[0].area;
  `);
  // STAN OBECNY, świadomie nie zmieniany: gdy ściana jest prosta, obrys upraszcza
  // się do 4 rogów i wierzchołek pośredni znika, więc dwa pomiary cząstkowe nie
  // sumują się do całości. Program prosi wtedy o wymiar całej ściany.
  // To zachowanie bezpieczne (nigdy nie zgaduje), ale niewygodne - do poprawy.
  sprawdz('ściana mierzona odcinkami: program prosi o całość zamiast zgadywać',
    wynik === 'Wymaga pomiaru!', wynik);
}

// 9b. Ścianka działowa nie może podkraść wymiaru sąsiedniej ściany
reset();
{
  const wynik = app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return l; };
    L(0,0, 5,0); L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    L(0,2, 5,2);                       // ścianka dzieli pokój na dwa
    let face = null, best = Infinity;
    const pt = { x:O+2.5*P, y:O+1*P };
    findPlanarFaces().forEach(f => { const p = simplifyPolygon(f);
      if (p.length >= 3 && pointInPolygon(pt, p)) { const a = Math.abs(polygonSignedArea(p));
        if (a > 1 && a < best) { best = a; face = p; } } });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie', polygon: face }];
    objects.customDims[getSegKey(O, O, O+5*P, O)] = { val:'5.00' };
    objects.customDims[getSegKey(O+5*P, O, O+5*P, O+2*P)] = { val:'2.00' };
    recalculateRooms();
    return objects.rooms[0].area;
  `);
  sprawdz('pokój nad ścianką działową = 10,00 m²', wynik === '10.00', wynik);
}

// 10. Wpisany wymiar rządzi, rysunek nie
reset();
{
  const k = rysuj([[0,0],[5,0],[5,4],[0,4]]);
  const o = rozpoznajObrys(2.5, 2);
  const p = polePokoju(o.poly, { [k[0]]: 6.50, [k[1]]: 4.00 });
  sprawdz('liczy się wymiar wpisany, nie narysowany', p.area === '26.00', p.area);
}

// 11. Krzywy rysunek nie zmienia wyniku (klasyfikacja po kącie, nie po pikselach)
[2, 5, 8].forEach(krzywo => {
  reset();
  const k = rysuj([[0,0],[5,0],[5,4],[0,4]], [[0,0,0,krzywo], [0,krzywo,0,0], [0,0,0,0], [0,0,0,0]]);
  const o = rozpoznajObrys(2.5, 2);
  if (!o) { sprawdz('krzywizna ' + krzywo + ' px - obrys rozpoznany', false); return; }
  const p = polePokoju(o.poly, { [k[0]]: 5.00, [k[1]]: 4.00 });
  sprawdz('krzywizna ' + krzywo + ' px nie zmienia pola', p.area === '20.00', p.area);
});

// 12. Powierzchnia liczy się z wymiarów, nie ze skali rysunku
reset();
{
  // ten sam pokój narysowany dwa razy mniejszy - pole musi wyjść identyczne
  const k1 = rysuj([[0,0],[5,0],[5,4],[0,4]]);
  const a = polePokoju(rozpoznajObrys(2.5, 2).poly, { [k1[0]]:5.00, [k1[1]]:4.00 }).area;
  reset();
  const k2 = rysuj([[0,0],[2.5,0],[2.5,2],[0,2]]);
  const b = polePokoju(rozpoznajObrys(1.25, 1).poly, { [k2[0]]:5.00, [k2[1]]:4.00 }).area;
  sprawdz('skala rysunku nie wpływa na wynik', a === b && a === '20.00', a + ' / ' + b);
}

// 13. Suma pomieszczeń w podsumowaniu
reset();
{
  const suma = app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g1 = L(0,0, 5,0), p1 = L(5,0, 5,4), d1 = L(5,4, 0,4), l1 = L(0,4, 0,0);
    const g2 = L(6,0, 9,0), p2 = L(9,0, 9,4), d2 = L(9,4, 6,4), l2 = L(6,4, 6,0);
    objects.rooms = [
      { id:1, num:'1', name:'Salon',  heated:'Tak', ac:'Nie',
        polygon:[{x:O,y:O},{x:O+5*P,y:O},{x:O+5*P,y:O+4*P},{x:O,y:O+4*P}] },
      { id:2, num:'2', name:'Kuchnia', heated:'Nie', ac:'Nie',
        polygon:[{x:O+6*P,y:O},{x:O+9*P,y:O},{x:O+9*P,y:O+4*P},{x:O+6*P,y:O+4*P}] }
    ];
    objects.customDims[g1]={val:'5.00'}; objects.customDims[p1]={val:'4.00'};
    objects.customDims[g2]={val:'3.00'}; objects.customDims[p2]={val:'4.00'};
    recalculateRooms();
    return objects.rooms.map(r => ({ num:r.num, area:r.area, heated:r.heated }));
  `);
  sprawdz('salon 5×4 = 20,00', suma[0].area === '20.00', suma[0].area);
  sprawdz('kuchnia 3×4 = 12,00', suma[1].area === '12.00', suma[1].area);
  const razem = suma.reduce((t, r) => t + parseFloat(r.area), 0);
  sprawdz('razem 32,00 m²', Math.abs(razem - 32) < 0.001, razem);
  const ogrz = suma.filter(r => r.heated === 'Tak').reduce((t, r) => t + parseFloat(r.area), 0);
  sprawdz('ogrzewana liczona osobno = 20,00', Math.abs(ogrz - 20) < 0.001, ogrz);
}

// 14. Kontrola pomiarów nie zgłasza sprzeczności na poprawnym rzucie
reset();
{
  const k = rysuj([[0,0],[5,0],[5,4],[0,4]]);
  polePokoju(rozpoznajObrys(2.5, 2).poly, { [k[0]]: 5.00, [k[1]]: 4.00 });
  app("sketches[0].height = '2.60';");
  const err = app("return runAuditChecks().filter(i => i.level === 'error');");
  sprawdz('poprawny rzut bez sprzeczności', err.length === 0, err.map(e => e.text).join(' | '));
}


// 15. Ukośna ściana na rzucie musi być zgłoszona - to ona po cichu zmienia pole
reset();
{
  const wynik = app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,0, 5,0); L(5,0, 5.4,4); L(5.4,4, 0,4); L(0,4, 0,0);   // prawa ściana wyraźnie ukośna
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie',
      polygon: [{x:O,y:O},{x:O+5*P,y:O},{x:O+5.4*P,y:O+4*P},{x:O,y:O+4*P}] }];
    recalculateRooms();
    return runAuditChecks().filter(i => i.level === 'warn').map(i => i.text);
  `);
  sprawdz('ukośna ściana na rzucie jest zgłaszana',
    wynik.some(t => t.includes('ukośnie')), wynik.join(' | '));
}

// 16. Prosty prostokąt nie może dostać ostrzeżenia o skosie
reset();
{
  const k = rysuj([[0,0],[5,0],[5,4],[0,4]]);
  polePokoju(rozpoznajObrys(2.5, 2).poly, { [k[0]]: 5.00, [k[1]]: 4.00 });
  const w = app("return runAuditChecks().filter(i => i.level === 'warn').map(i => i.text);");
  sprawdz('prosty prostokąt bez fałszywego alarmu o skosie',
    !w.some(t => t.includes('ukośnie')), w.join(' | '));
}

console.log('');
if (bledy.length) {
  console.log('BŁĘDY (' + bledy.length + '):');
  bledy.forEach(b => console.log('  ✗ ' + b));
  console.log('\nPrzeszło: ' + ok + ', nie przeszło: ' + bledy.length);
  dom.window.close();
  process.exit(1);
} else {
  console.log('✓ Wszystkie testy przeszły (' + ok + ' sprawdzeń).');
  dom.window.close();
}
