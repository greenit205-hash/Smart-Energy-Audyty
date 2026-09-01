/* Smart Energy Audyty - testy silnika wymiarowania i kontroli pomiarów.
 * Uruchomienie:  node tests/test-pomiary.js
 * Wymaga jednorazowo:  npm install jsdom
 *
 * Ten zestaw ładuje CAŁE index.html do sztucznej przeglądarki i wywołuje
 * prawdziwe funkcje aplikacji (recalculateRooms, runAuditChecks). Nie ma tu
 * przepisanej logiki - jeśli test przechodzi, to znaczy że działa kod,
 * który trafi na tablet.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.log('Ten zestaw potrzebuje biblioteki jsdom. Zainstaluj raz:\n\n    npm install jsdom\n');
  process.exit(2);
}

// ===================== ŁADOWANIE APLIKACJI =====================
function pustyKontekst2D() {
  const nic = () => {};
  const ctx = {
    canvas: { width: 3000, height: 3000 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }),
    createPattern: () => null,
    getImageData: () => ({ data: [] }),
    setLineDash: nic
  };
  return new Proxy(ctx, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

// Zbieramy błędy, które aplikacja zgłasza podczas wczytywania.
const bledyStartu = [];
const { VirtualConsole } = require('jsdom');
const konsola = new VirtualConsole();
konsola.on('jsdomError', e => bledyStartu.push(e.message));
konsola.on('error', (...a) => bledyStartu.push(a.join(' ')));

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  virtualConsole: konsola,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.org/',
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => pustyKontekst2D();
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    w.alert = () => {};
    w.confirm = () => true;
    w.prompt = () => null;
    w.scrollTo = () => {};
  }
});

const app = kod => dom.window.eval('(function(){' + kod + '})()');

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

// Czysty szkic przed każdym scenariuszem
function reset(kind) {
  app(`
    sketches = [{ id: 1, name: "Parter", kind: ${JSON.stringify(kind || 'rzut')}, objects:
      { lines: [], freehand: [], labels: [], rooms: [], openings: [], customDims: {},
        envTags: {}, noteLines: [], apexDims: {}, hatches: [], slopes: [] },
      panX: 0, panY: 0, zoomLevel: 1, showDimensions: true }];
    currentSketchIndex = 0;
    objects = sketches[0].objects;
  `);
}

// Prostokąt o podanych bokach [m], lewy górny róg w (100,100).
// dims: które boki wymiarujemy - 'top','right','bottom','left'
function prostokat(szer, wys, dims, odchylkaPx) {
  return app(`
    const P = PIXELS_PER_METER, dx = ${odchylkaPx || 0};
    const A = {x:100, y:100};
    const B = {x:100 + ${szer}*P, y:100 + dx};
    const C = {x:100 + ${szer}*P, y:100 + ${wys}*P};
    const D = {x:100, y:100 + ${wys}*P};
    objects.lines = [
      {x1:A.x,y1:A.y,x2:B.x,y2:B.y}, {x1:B.x,y1:B.y,x2:C.x,y2:C.y},
      {x1:C.x,y1:C.y,x2:D.x,y2:D.y}, {x1:D.x,y1:D.y,x2:A.x,y2:A.y}];
    const klucze = {
      top:   getSegKey(A.x,A.y,B.x,B.y), right: getSegKey(B.x,B.y,C.x,C.y),
      bottom:getSegKey(C.x,C.y,D.x,D.y), left:  getSegKey(D.x,D.y,A.x,A.y) };
    const wym = ${JSON.stringify(dims)};
    Object.keys(wym).forEach(k => { objects.customDims[klucze[k]] = { val: String(wym[k]) }; });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie', polygon:[A,B,C,D] }];
    recalculateRooms();
    return { area: objects.rooms[0].area, needsDim: !!objects.rooms[0].needsDim, klucze: klucze,
             naroza: {A:A,B:B,C:C,D:D} };
  `);
}

const kontrola = () => app('return runAuditChecks();');
const bledyKontroli = () => kontrola().filter(i => i.level === 'error');
const ostrzezenia = () => kontrola().filter(i => i.level === 'warn');
const zawiera = (lista, fragment) => lista.some(i => i.text.includes(fragment));

// ===================== START APLIKACJI =====================
console.log('--- start aplikacji ---');
sprawdz('aplikacja wczytuje się bez błędów w konsoli', bledyStartu.length === 0, bledyStartu.join(' | '));
['runAuditChecks', 'recalculateRooms', 'computeRoomGeometry', 'getSegKey', 'obliczU']
  .forEach(fn => sprawdz('funkcja ' + fn + ' jest dostępna', typeof dom.window[fn] === 'function'));

// ===================== SILNIK WYMIAROWANIA =====================
console.log('--- silnik wymiarowania ---');

// Prostokąt = 2 pomiary, nie 4
reset();
{
  const r = prostokat(5, 5, { top: 5.00, right: 5.00 });
  sprawdz('prostokąt 5×5 z dwóch pomiarów daje 25,00 m²', r.area === '25.00', r.area);
  sprawdz('prostokąt z dwóch pomiarów nie prosi o więcej', r.needsDim === false);
}
reset();
{
  const r = prostokat(4, 3, { top: 4.00, right: 3.00 });
  sprawdz('prostokąt 4×3 daje 12,00 m²', r.area === '12.00', r.area);
}

// Jeden pomiar to za mało - program nie zgaduje z rysunku
reset();
{
  const r = prostokat(5, 5, { top: 5.00 });
  sprawdz('przy jednym pomiarze powierzchnia nie jest liczona', r.needsDim === true, r.area);
  sprawdz('brak pomiaru daje komunikat, nie liczbę', r.area === 'Wymaga pomiaru!', r.area);
}

// Krzywy rysunek nie może zmieniać wyniku (regresja: 24,95 zamiast 25,00)
reset();
{
  const r = prostokat(5, 5, { top: 5.00, right: 5.00 }, 2);
  sprawdz('krzywizna 2 px nie psuje pola prostokąta', r.area === '25.00', r.area);
}
reset();
{
  const r = prostokat(5, 5, { top: 5.00, right: 5.00 }, 4);
  sprawdz('krzywizna 4 px nadal daje 25,00', r.area === '25.00', r.area);
}

// Wpisany wymiar rządzi, nie rysunek
reset();
{
  const r = prostokat(5, 5, { top: 8.00, right: 5.00 });
  sprawdz('liczy się wpisany wymiar, nie długość z rysunku', r.area === '40.00', r.area);
}

// ===================== KONTROLA POMIARÓW =====================
console.log('--- kontrola pomiarów ---');

// Poprawny szkic nie może generować sprzeczności
reset();
prostokat(5, 4, { top: 5.00, right: 4.00 });
app("sketches[0].height = '2.60';");
{
  const err = bledyKontroli();
  sprawdz('poprawny szkic nie zgłasza sprzeczności', err.length === 0, err.map(e => e.text).join(' | '));
}

// Powtórzony numer pomieszczenia
reset();
prostokat(5, 4, { top: 5.00, right: 4.00 });
app(`
  const r = objects.rooms[0];
  objects.rooms.push(Object.assign({}, r, { id: 2, polygon: r.polygon, manual: true, x: 200, y: 200, area: '10.00' }));
  recalculateRooms();
`);
sprawdz('powtórzony numer pomieszczenia to sprzeczność',
  zawiera(bledyKontroli(), 'użyty dwa razy'), bledyKontroli().map(e => e.text).join(' | '));

// Otwór szerszy niż ściana
reset();
{
  const r = prostokat(5, 4, { top: 5.00, right: 4.00 });
  app(`
    objects.openings = [{ id:'O1', x:${r.naroza.A.x} + 2*PIXELS_PER_METER, y:${r.naroza.A.y},
                          width: 600, height: 140, uValue: 1.1 }];
    recalculateRooms();
  `);
  sprawdz('otwór szerszy od ściany to sprzeczność',
    zawiera(bledyKontroli(), 'szerszy niż ściana'), bledyKontroli().map(e => e.text).join(' | '));
}

// Otwór mieszczący się w ścianie - bez alarmu
reset();
{
  const r = prostokat(5, 4, { top: 5.00, right: 4.00 });
  app(`
    objects.openings = [{ id:'O1', x:${r.naroza.A.x} + 2*PIXELS_PER_METER, y:${r.naroza.A.y},
                          width: 150, height: 140, uValue: 1.1 }];
    recalculateRooms();
  `);
  sprawdz('normalny otwór nie jest zgłaszany', bledyKontroli().length === 0,
    bledyKontroli().map(e => e.text).join(' | '));
}

// Otwór o nietypowych wymiarach - ostrzeżenie, nie blokada
reset();
{
  const r = prostokat(5, 4, { top: 5.00, right: 4.00 });
  app(`
    objects.openings = [{ id:'O1', x:${r.naroza.A.x} + 2*PIXELS_PER_METER, y:${r.naroza.A.y},
                          width: 15, height: 140, uValue: 1.1 }];
    recalculateRooms();
  `);
  sprawdz('otwór 15 cm daje ostrzeżenie', zawiera(ostrzezenia(), 'poza typowym zakresem'));
}

// Suma odcinków sprzeczna z całą ścianą
reset();
app(`
  const P = PIXELS_PER_METER;
  const A={x:100,y:100}, M={x:100+2*P,y:100}, B={x:100+5*P,y:100};
  const C={x:100+5*P,y:100+4*P}, D={x:100,y:100+4*P};
  objects.lines = [{x1:A.x,y1:A.y,x2:B.x,y2:B.y},{x1:B.x,y1:B.y,x2:C.x,y2:C.y},
                   {x1:C.x,y1:C.y,x2:D.x,y2:D.y},{x1:D.x,y1:D.y,x2:A.x,y2:A.y},
                   {x1:M.x,y1:M.y,x2:M.x,y2:M.y+1*P}];   // ścianka działowa dzieli górną ścianę
  objects.customDims[getSegKey(A.x,A.y,B.x,B.y)] = { val: '5.00' };
  objects.customDims[getSegKey(A.x,A.y,M.x,M.y)] = { val: '2.00' };
  objects.customDims[getSegKey(M.x,M.y,B.x,B.y)] = { val: '2.80' };   // 2,00 + 2,80 = 4,80 != 5,00
  recalculateRooms();
`);
sprawdz('suma odcinków niezgodna z całą ścianą to sprzeczność',
  zawiera(bledyKontroli(), 'zmierzona sprzecznie'), bledyKontroli().map(e => e.text).join(' | '));

// Ta sama ściana, ale odcinki się zgadzają - cisza
reset();
app(`
  const P = PIXELS_PER_METER;
  const A={x:100,y:100}, M={x:100+2*P,y:100}, B={x:100+5*P,y:100};
  const C={x:100+5*P,y:100+4*P}, D={x:100,y:100+4*P};
  objects.lines = [{x1:A.x,y1:A.y,x2:B.x,y2:B.y},{x1:B.x,y1:B.y,x2:C.x,y2:C.y},
                   {x1:C.x,y1:C.y,x2:D.x,y2:D.y},{x1:D.x,y1:D.y,x2:A.x,y2:A.y},
                   {x1:M.x,y1:M.y,x2:M.x,y2:M.y+1*P}];
  objects.customDims[getSegKey(A.x,A.y,B.x,B.y)] = { val: '5.00' };
  objects.customDims[getSegKey(A.x,A.y,M.x,M.y)] = { val: '2.00' };
  objects.customDims[getSegKey(M.x,M.y,B.x,B.y)] = { val: '3.00' };
  recalculateRooms();
`);
sprawdz('zgodne odcinki nie są zgłaszane', bledyKontroli().length === 0,
  bledyKontroli().map(e => e.text).join(' | '));

// Zgubiony przecinek - pomiar odbiegający od proporcji rysunku
reset();
app(`
  const P = PIXELS_PER_METER;
  const A={x:100,y:100}, B={x:100+5*P,y:100}, C={x:100+5*P,y:100+4*P}, D={x:100,y:100+4*P};
  objects.lines = [{x1:A.x,y1:A.y,x2:B.x,y2:B.y},{x1:B.x,y1:B.y,x2:C.x,y2:C.y},
                   {x1:C.x,y1:C.y,x2:D.x,y2:D.y},{x1:D.x,y1:D.y,x2:A.x,y2:A.y}];
  objects.customDims[getSegKey(A.x,A.y,B.x,B.y)] = { val: '5.00' };
  objects.customDims[getSegKey(B.x,B.y,C.x,C.y)] = { val: '4.00' };
  objects.customDims[getSegKey(C.x,C.y,D.x,D.y)] = { val: '50.00' };   // miało być 5,00
  objects.customDims[getSegKey(D.x,D.y,A.x,A.y)] = { val: '4.00' };
  objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie', polygon:[A,B,C,D] }];
  recalculateRooms();
`);
sprawdz('pomiar 50 m przy pozostałych 4-5 m daje ostrzeżenie',
  zawiera(ostrzezenia(), 'odbiega od proporcji'), ostrzezenia().map(e => e.text).join(' | '));

// Zakres rozsądnych długości ścian
reset();
prostokat(5, 4, { top: 5.00, right: 4.00 });
sprawdz('typowa ściana 5 m nie jest zgłaszana jako nietypowa',
  !ostrzezenia().some(i => /^Ściana /.test(i.text)), ostrzezenia().map(e => e.text).join(' | '));
reset();
prostokat(40, 4, { top: 40.00, right: 4.00 });
sprawdz('ściana 40 m daje ostrzeżenie', zawiera(ostrzezenia(), 'więcej niż'),
  ostrzezenia().map(e => e.text).join(' | '));
reset();
prostokat(5, 4, { top: 5.00, right: 0.10 });
sprawdz('ściana 10 cm daje ostrzeżenie', zawiera(ostrzezenia(), 'mniej niż'),
  ostrzezenia().map(e => e.text).join(' | '));

// Wysokość kondygnacji poza zakresem
reset();
prostokat(5, 4, { top: 5.00, right: 4.00 });
app("sketches[0].height = '12';");
sprawdz('wysokość 12 m daje ostrzeżenie', zawiera(ostrzezenia(), 'wysokość') || zawiera(ostrzezenia(), 'Wysokość'),
  ostrzezenia().map(e => e.text).join(' | '));
app("sketches[0].height = '2.60';");
sprawdz('wysokość 2,60 m nie jest zgłaszana',
  !ostrzezenia().some(i => i.text.toLowerCase().includes('wysokość kondygnacji')));

// Brak wysokości - to tylko brak, nie błąd
reset();
prostokat(5, 4, { top: 5.00, right: 4.00 });
app("delete sketches[0].height;");
{
  const info = kontrola().filter(i => i.level === 'info');
  sprawdz('brak wysokości kondygnacji jest zgłaszany jako brak', zawiera(info, 'Brak wysokości'));
  sprawdz('brak wysokości nie jest traktowany jak sprzeczność', bledyKontroli().length === 0);
}

// Piętro większe od parteru
reset();
prostokat(5, 4, { top: 5.00, right: 4.00 });   // parter 20 m²
app(`
  const P = PIXELS_PER_METER;
  const A={x:100,y:100}, B={x:100+10*P,y:100}, C={x:100+10*P,y:100+8*P}, D={x:100,y:100+8*P};
  sketches.push({ id:2, name:'Piętro', kind:'rzut', panX:0, panY:0, zoomLevel:1, showDimensions:true,
    objects: { lines:[{x1:A.x,y1:A.y,x2:B.x,y2:B.y},{x1:B.x,y1:B.y,x2:C.x,y2:C.y},
                      {x1:C.x,y1:C.y,x2:D.x,y2:D.y},{x1:D.x,y1:D.y,x2:A.x,y2:A.y}],
      freehand:[], labels:[], openings:[], envTags:{}, noteLines:[], apexDims:{}, hatches:[], slopes:[],
      customDims: (function(){ const d={}; d[getSegKey(A.x,A.y,B.x,B.y)]={val:'10.00'};
        d[getSegKey(B.x,B.y,C.x,C.y)]={val:'8.00'}; return d; })(),
      rooms: [{ id:9, num:'10', name:'Pokój', heated:'Tak', ac:'Nie', polygon:[A,B,C,D] }] } });
  const zap = objects; objects = sketches[1].objects; recalculateRooms(); objects = zap;
`);
sprawdz('piętro większe od parteru daje ostrzeżenie',
  zawiera(ostrzezenia(), 'większy od'), ostrzezenia().map(e => e.text).join(' | '));

// Kontrola nie wywraca się na pustym szkicu ani na szkicu bez pomieszczeń
reset();
sprawdz('pusty szkic nie wywraca kontroli', Array.isArray(kontrola()));
reset();
app(`
  const P = PIXELS_PER_METER;
  objects.lines = [{x1:100,y1:100,x2:100+5*P,y2:100}];
`);
{
  const info = kontrola().filter(i => i.level === 'info');
  sprawdz('narysowane ściany bez pomieszczeń dają informację', zawiera(info, 'nie opisano jeszcze'));
}

// Przekrój nie jest sprawdzany regułami dla rzutów
reset('przekroj');
app(`
  const P = PIXELS_PER_METER;
  const A={x:100,y:100}, B={x:100+8*P,y:100}, C={x:100+8*P,y:100+3*P}, D={x:100,y:100+3*P};
  objects.lines = [{x1:A.x,y1:A.y,x2:B.x,y2:B.y},{x1:B.x,y1:B.y,x2:C.x,y2:C.y},
                   {x1:C.x,y1:C.y,x2:D.x,y2:D.y},{x1:D.x,y1:D.y,x2:A.x,y2:A.y}];
  objects.customDims[getSegKey(A.x,A.y,B.x,B.y)] = { val: '8.00' };
  objects.customDims[getSegKey(B.x,B.y,C.x,C.y)] = { val: '3.00' };
  objects.rooms = [{ id:1, num:'1', name:'Elewacja', heated:'—', ac:'—', polygon:[A,B,C,D] }];
  recalculateRooms();
`);
sprawdz('na przekroju nie ma alarmu o braku okien',
  !zawiera(ostrzezenia(), 'nie ma żadnego okna'), ostrzezenia().map(e => e.text).join(' | '));
sprawdz('na przekroju nie ma alarmu o wysokości kondygnacji',
  !ostrzezenia().some(i => i.text.toLowerCase().includes('wysokość kondygnacji')));

// ===================== PRZEGRODY =====================
console.log('--- przegrody (opis warstwowy) ---');

// Formularz sekcji 3 - po usunięciu starego modelu zostaje opis własny, grubość, U i warstwy
reset();
app(`
  sketches[0].objects.envTags = { 'a': { cat:'SZ', num:1 }, 'b': { cat:'S', num:1 } };
  renderEnvelopeFields();
`);
{
  const pole = n => dom.window.document.querySelector('[name="' + n + '"]');
  sprawdz('przegroda ma pole opisu własnego', !!pole('SZ1_desc'));
  sprawdz('przegroda ma pole grubości', !!pole('SZ1_totalthick'));
  sprawdz('przegroda ma pole U', !!pole('SZ1_uvalue'));
  sprawdz('pole U jest polem liczbowym', pole('SZ1_uvalue') && pole('SZ1_uvalue').type === 'number');
  sprawdz('przegroda ma przycisk warstw',
    !!dom.window.document.getElementById('warstwyInfo_SZ1'));

  // stary model: lista budowy i lista izolacji
  sprawdz('nie ma już listy budowy przegrody', !pole('SZ1_type'));
  sprawdz('nie ma już listy izolacji', !pole('SZ1_insulation'));
  sprawdz('nie ma już grubości izolacji', !pole('SZ1_insthick'));
  sprawdz('drugie oznaczenie też dostaje pola', !!pole('S1_desc') && !!pole('S1_uvalue'));
}

// Złożenie warstw wypełnia U i grubość w formularzu
app(`
  layersKey = 'SZ1'; layersCat = 'SZ';
  layersDraft = [{ mat:'Cegła pełna zwykła', gr:25 },
                 { mat:'Płyta styropianowa EPS 70-038 FASADA', gr:12 }];
  saveLayers();
`);
{
  const u = dom.window.document.querySelector('[name="SZ1_uvalue"]').value;
  const gr = dom.window.document.querySelector('[name="SZ1_totalthick"]').value;
  sprawdz('warstwy wpisują U do formularza', parseFloat(u) > 0.26 && parseFloat(u) < 0.29, u);
  sprawdz('warstwy wpisują grubość całkowitą', gr === '37.0', gr);
}

// Przegroda opisana warstwami trafia do raportu razem z U
{
  const rows = app(`
    const audit = {
      SZ1_layers: JSON.stringify([{mat:'Cegła pełna zwykła',gr:25},
                                  {mat:'Płyta styropianowa EPS 70-038 FASADA',gr:12}]),
      SZ1_uvalue: '0.274', SZ1_totalthick: '37.0',
      S1_desc: 'strop drewniany, nieocieplony', S1_totalthick: '20'
    };
    return rowsFromEnvelopes(audit).map(r => ({
      id: r.id, section: r.section, warstw: r.warstwy.length,
      u: r.u, uObl: r.uObliczone, budowa: budowaPrzegrody(r, x => x) }));
  `);
  sprawdz('do raportu trafiają obie przegrody', rows.length === 2, rows.length);
  const sz = rows.find(r => r.id === 'SZ1'), st = rows.find(r => r.id === 'S1');
  sprawdz('przegroda warstwowa niesie swoje warstwy', sz && sz.warstw === 2);
  sprawdz('U z formularza trafia do raportu', sz && sz.u === '0.274', sz && sz.u);
  sprawdz('U jest też przeliczane z warstw', sz && sz.uObl > 0.26 && sz.uObl < 0.29, sz && sz.uObl);
  sprawdz('budowa wypisuje materiały z grubościami',
    sz && sz.budowa.includes('Cegła pełna zwykła — 25 cm') && sz.budowa.includes('RAZEM 37.0 cm'), sz && sz.budowa);
  sprawdz('przegroda bez warstw pokazuje opis własny',
    st && st.budowa.includes('strop drewniany'), st && st.budowa);
  sprawdz('rodzaj przegrody bierze się z oznaczenia, nie z listy',
    sz && sz.section === 'Ściany Zewnętrzne', sz && sz.section);
}

// Archiwalna kopia zapasowa (stary model) nadal daje się wydrukować
{
  const r = app(`
    const audit = { SZ1_type:'Cegła pełna zwykła + Tynk', SZ1_insulation:'Wełna mineralna 0,036',
                    SZ1_insthick:'10', SZ1_totalthick:'35' };
    const w = rowsFromEnvelopes(audit)[0];
    return { ile: rowsFromEnvelopes(audit).length, budowa: budowaPrzegrody(w, x => x) };
  `);
  sprawdz('stary audyt nadal jest rozpoznawany', r.ile === 1, r.ile);
  sprawdz('stary opis budowy nie ginie w raporcie',
    r.budowa.includes('Cegła pełna zwykła + Tynk'), r.budowa);
  sprawdz('stare ocieplenie nie ginie w raporcie',
    r.budowa.includes('ocieplenie: Wełna mineralna 0,036 10 cm'), r.budowa);
}

// Pusty audyt nie tworzy widmowych przegród
sprawdz('pusty audyt nie daje żadnych przegród',
  app('return rowsFromEnvelopes({}).length;') === 0);
sprawdz('samo "Wybierz..." nie tworzy przegrody',
  app("return rowsFromEnvelopes({ SZ1_type: 'Wybierz budowę...' }).length;") === 0);

// ===================== PODSUMOWANIE =====================
console.log('');
if (bledy.length) {
  console.log('BŁĘDY (' + bledy.length + '):');
  bledy.forEach(b => console.log('  ✗ ' + b));
  console.log('\nPrzeszło: ' + ok + ', nie przeszło: ' + bledy.length);
  process.exit(1);
} else {
  console.log('✓ Wszystkie testy przeszły (' + ok + ' sprawdzeń).');
}
dom.window.close();
