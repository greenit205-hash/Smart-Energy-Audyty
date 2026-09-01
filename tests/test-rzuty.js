/* Smart Energy Audyty - testy na odwzorowaniu prawdziwych rzutów audytora.
 * Uruchomienie:  node tests/test-rzuty.js     (wymaga: npm install)
 *
 * Dwa układy przerysowane z rzutów zrobionych u klientów: 6-7 pomieszczeń,
 * ściany wspólne, mały pokój w środku rzutu, obrys w kształcie litery L.
 * To są znacznie trudniejsze przypadki niż pojedynczy prostokąt.
 *
 * UWAGA: powierzchni NIE porównujemy z liczbami odczytanymi z rysunku, tylko
 * z polem policzonym niezależnie (wzór Gaussa na współrzędnych). Dzięki temu
 * test sprawdza silnik, a nie moje odczytanie wymiarów z obrazka.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('Ten zestaw potrzebuje biblioteki jsdom. Zainstaluj raz:\n\n    npm install\n');
  process.exit(2);
}

function pustyKontekst2D() {
  const nic = () => {};
  const ctx = { canvas: { width: 4000, height: 4000 }, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic };
  return new Proxy(ctx, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
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

// Pole wielokąta liczone niezależnie od aplikacji - punkt odniesienia dla testu
function poleWzorem(pkt) {
  let acc = 0;
  for (let i = 0; i < pkt.length; i++) {
    const a = pkt[i], b = pkt[(i + 1) % pkt.length];
    acc += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(acc / 2);
}

/* Rysuje układ ścian (odcinki w metrach), rozpoznaje pomieszczenia klikając
 * w podane punkty i wpisuje wymiary WSZYSTKICH ścian - tak jak audytor, który
 * obszedł mieszkanie z dalmierzem. Zwraca policzone powierzchnie. */
function rysujRzut(sciany, punktyKlikniec, drzenie) {
  return app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 envTags:{}, noteLines:[], apexDims:{}, hatches:[], slopes:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    const P = PIXELS_PER_METER, O = 120, D = ${drzenie || 0};
    const R = () => (D ? Math.random() * 2 * D - D : 0);

    // 1. rysowanie ścian - przez prawdziwe przyciąganie i prostowanie aplikacji
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
      objects.lines.push({ x1:start.x, y1:start.y, x2:snapTo1cm(t.x), y2:snapTo1cm(t.y) });
    }

    ${JSON.stringify(sciany)}.forEach(s => {
      rysujSciane({ x:O + s[0]*P + R(), y:O + s[1]*P + R() },
                  { x:O + s[2]*P + R(), y:O + s[3]*P + R() });
    });

    // 2. wpisanie pomiarów - audytor dotyka ściany i wpisuje odczyt z dalmierza.
    //    Wartość bierzemy z PRAWDZIWEJ długości odcinka, nie z rysunku.
    // Ściana przecięta inną ścianą dzieli się na odcinki - audytor dotyka
    // każdego z nich osobno (tak działa wybór wymiaru w aplikacji).
    objects.lines.forEach(l => {
      const czesci = getSegmentsForLine(l);
      const lista = czesci.length ? czesci : [{ x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2 }];
      lista.forEach(seg => {
        const dlPx = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
        if (dlPx < 5) return;
        objects.customDims[getSegKey(seg.x1, seg.y1, seg.x2, seg.y2)] = { val: (dlPx / P).toFixed(2) };
      });
      const calaPx = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      if (lista.length > 1 && calaPx > 5) {
        objects.customDims[getSegKey(l.x1, l.y1, l.x2, l.y2)] = { val: (calaPx / P).toFixed(2) };
      }
    });

    // 3. rozpoznanie pomieszczeń - kliknięcie w środku, jak 🏠 Pomieszcz.
    const klikniecia = ${JSON.stringify(punktyKlikniec)};
    const nieznalezione = [];
    klikniecia.forEach((k, idx) => {
      const pt = { x:O + k[0]*P, y:O + k[1]*P };
      let face = null, best = Infinity;
      findPlanarFaces().forEach(f => {
        const p = simplifyPolygon(f);
        if (p.length >= 3 && pointInPolygon(pt, p)) {
          const a = Math.abs(polygonSignedArea(p));
          if (a > 1 && a < best) { best = a; face = p; }
        }
      });
      if (!face) { nieznalezione.push(idx + 1); return; }
      objects.rooms.push({ id: idx + 1, num: String(idx + 1), name: 'Pom ' + (idx + 1),
                           heated: 'Tak', ac: 'Nie', polygon: face });
    });

    recalculateRooms();
    const ostrz = runAuditChecks();
    return {
      nieznalezione,
      pokoje: objects.rooms.map(r => {
        let acc = 0;
        for (let i = 0; i < r.polygon.length; i++) {
          const a = r.polygon[i], b = r.polygon[(i + 1) % r.polygon.length];
          acc += a.x * b.y - b.x * a.y;
        }
        return { num: r.num, area: r.area, rogi: r.polygon.length,
                 poleRysunku: Math.abs(acc / 2) / (P * P) };
      }),
      bledy: ostrz.filter(i => i.level === 'error').map(i => i.text),
      ukosne: ostrz.filter(i => i.level === 'warn' && i.text.includes('ukośnie')).length
    };
  `);
}

/* ==================================================================
 * RZUT 1 - obrys w kształcie litery L, 7 pomieszczeń.
 * Górny pas podzielony na dwa pokoje, po lewej duży pokój, w środku
 * dwa małe pomieszczenia, po prawej pokój, na dole doklejone skrzydło.
 * ================================================================== */
const RZUT1 = {
  sciany: [
    // obrys zewnętrzny (litera L)
    [0,0, 4.66,0], [4.66,0, 9.91,0],           // góra, przerwana ścianą działową
    [9.91,0, 9.91,9.99],                        // prawa
    [9.91,9.99, 4.26,9.99],                     // dół skrzydła
    [4.26,9.99, 4.26,8.44],                     // lewa krawędź skrzydła
    [4.26,8.44, 0,8.44],                        // dół części głównej
    [0,8.44, 0,0],                              // lewa
    // ściany wewnętrzne
    [4.66,0, 4.66,3.81],                        // pokój 1 | pokój 2
    [0,3.81, 4.66,3.81], [4.66,3.81, 9.91,3.81],// pas poziomy
    [4.26,3.81, 4.26,8.44],                     // prawa ściana dużego pokoju
    [6.18,3.81, 6.18,7.42],                     // lewa ściana pokoju po prawej
    [6.18,7.42, 9.91,7.42],                     // dół pokoju po prawej
    [6.18,7.42, 6.18,8.44],                     // prawa ściana dolnego małego pomieszczenia
    [4.26,8.44, 6.18,8.44],                     // dół małego pomieszczenia = góra skrzydła
    [4.26,5.40, 6.18,5.40]                      // podział dwóch małych pomieszczeń
  ],
  klikniecia: [[2.3,1.9], [7.3,1.9], [2.1,6.1], [8.0,5.6], [5.2,4.6], [5.2,6.9], [7.0,9.2]],
  // pole liczone niezależnie, z tych samych współrzędnych
  obrysy: [
    [[0,0],[4.66,0],[4.66,3.81],[0,3.81]],
    [[4.66,0],[9.91,0],[9.91,3.81],[4.66,3.81]],
    [[0,3.81],[4.26,3.81],[4.26,8.44],[0,8.44]],
    [[6.18,3.81],[9.91,3.81],[9.91,7.42],[6.18,7.42]],
    [[4.26,3.81],[6.18,3.81],[6.18,5.40],[4.26,5.40]],
    [[4.26,5.40],[6.18,5.40],[6.18,8.44],[4.26,8.44]],
    [[4.26,8.44],[6.18,8.44],[6.18,7.42],[9.91,7.42],[9.91,9.99],[4.26,9.99]]
  ]
};

/* ==================================================================
 * RZUT 2 - obrys prostokątny, 8 pomieszczeń w trzech pasach.
 * ================================================================== */
const RZUT2 = {
  sciany: [
    [0,0, 4.39,0], [4.39,0, 8.43,0],
    [8.43,0, 8.43,8.80],
    [8.43,8.80, 5.70,8.80], [5.70,8.80, 4.30,8.80], [4.30,8.80, 0,8.80],
    [0,8.80, 0,0],
    [4.39,0, 4.39,3.92],                        // pokój 7 | pokój 8
    [0,3.92, 4.39,3.92], [4.39,3.92, 8.43,3.92],// pas pod górnym rzędem
    [0,6.70, 4.30,6.70], [4.30,6.70, 5.70,6.70], [5.70,6.70, 8.43,6.70],
    [2.49,3.92, 2.49,6.70],                     // pokój 6 | środek
    [4.39,3.92, 4.39,6.70],                     // środek | pokój 4
    [4.30,6.70, 4.30,8.80],                     // dolny rząd: podziały
    [5.70,6.70, 5.70,8.80],
    [2.49,5.30, 4.39,5.30]                      // mały pokój w środku
  ],
  klikniecia: [[2.1,1.9], [6.4,1.9], [1.2,5.3], [3.4,4.6], [3.4,6.0], [6.4,5.3], [2.1,7.7], [5.0,7.7], [7.0,7.7]],
  obrysy: [
    [[0,0],[4.39,0],[4.39,3.92],[0,3.92]],
    [[4.39,0],[8.43,0],[8.43,3.92],[4.39,3.92]],
    [[0,3.92],[2.49,3.92],[2.49,6.70],[0,6.70]],
    [[2.49,3.92],[4.39,3.92],[4.39,5.30],[2.49,5.30]],
    [[2.49,5.30],[4.39,5.30],[4.39,6.70],[2.49,6.70]],
    [[4.39,3.92],[8.43,3.92],[8.43,6.70],[4.39,6.70]],
    [[0,6.70],[4.30,6.70],[4.30,8.80],[0,8.80]],
    [[4.30,6.70],[5.70,6.70],[5.70,8.80],[4.30,8.80]],
    [[5.70,6.70],[8.43,6.70],[8.43,8.80],[5.70,8.80]]
  ]
};

function zbadaj(nazwa, rzut, drzenie) {
  const w = rysujRzut(rzut.sciany, rzut.klikniecia, drzenie);
  const etykieta = nazwa + (drzenie ? ' (drżenie ±' + drzenie + ' px)' : '');

  sprawdz(etykieta + ' — wszystkie pomieszczenia rozpoznane',
    w.nieznalezione.length === 0, 'nie rozpoznano: ' + w.nieznalezione.join(', '));
  if (!drzenie) {
    sprawdz(etykieta + ' — kontrola nie zgłasza sprzeczności',
      w.bledy.length === 0, w.bledy.join(' | '));
  } else {
    // przy niedokładnym rysunku kontrola MOŻE zgłosić rozjazd sumy odcinków -
    // to jej zadanie; nie może natomiast zgłaszać niczego innego
    const inne = w.bledy.filter(t => !t.includes('zmierzona sprzecznie'));
    sprawdz(etykieta + ' — brak sprzeczności innych niż rozjazd pomiarów',
      inne.length === 0, inne.join(' | '));
  }

  // Silnik odtwarza figurę z WPISANYCH długości i kątów odczytanych ze szkicu,
  // a długości są zaokrąglane do 1 cm. Przy kilkunastu ścianach te zaokrąglenia
  // się sumują, więc porównujemy z tolerancją, nie co do grosza.
  const tolerancja = ideal => drzenie ? Math.max(0.20, ideal * 0.05)
                                      : Math.max(0.05, ideal * 0.02);

  let policzone = 0, prosiOPomiar = 0, zle = [], odtworzenie = [];
  let najwiekszeOdchylenie = 0;
  rzut.obrysy.forEach((obrys, i) => {
    const pokoj = w.pokoje[i];
    if (!pokoj) return;
    const ideal = poleWzorem(obrys);
    // czy rozpoznany obrys to ten, który zaprojektowałem (kontrola rekonstrukcji)
    if (!drzenie && Math.abs(pokoj.poleRysunku - ideal) > 0.15) {
      odtworzenie.push('pom. ' + pokoj.num + ': obrys ' + pokoj.poleRysunku.toFixed(2) +
                       ' zamiast ' + ideal.toFixed(2));
    }
    if (pokoj.area === 'Wymaga pomiaru!') { prosiOPomiar++; return; }
    const policzona = parseFloat(pokoj.area);
    const odchyl = Math.abs(policzona - ideal);
    najwiekszeOdchylenie = Math.max(najwiekszeOdchylenie, odchyl / ideal);
    if (odchyl <= tolerancja(ideal)) policzone++;
    else zle.push('pom. ' + pokoj.num + ': ' + pokoj.area + ' zamiast ' + ideal.toFixed(2));
  });
  if (!drzenie) {
    sprawdz(etykieta + ' — obrysy rozpoznane zgodnie z układem', odtworzenie.length === 0,
      odtworzenie.join('; '));
  }

  // Najważniejsze: żadna powierzchnia nie może być inna niż prawdziwa.
  sprawdz(etykieta + ' — żadna powierzchnia nie jest błędna', zle.length === 0, zle.join('; '));
  if (!drzenie) {
    sprawdz(etykieta + ' — wszystkie powierzchnie policzone',
      prosiOPomiar === 0, 'prosi o pomiar: ' + prosiOPomiar + '/' + rzut.obrysy.length);
  } else {
    sprawdz(etykieta + ' — prawie wszystkie powierzchnie policzone',
      prosiOPomiar <= 2, 'prosi o pomiar: ' + prosiOPomiar + '/' + rzut.obrysy.length);
  }

  return { policzone, prosiOPomiar, zle: zle.length, ukosne: w.ukosne,
           odchylenie: najwiekszeOdchylenie,
           suma: w.pokoje.reduce((t, p) => t + (parseFloat(p.area) || 0), 0) };
}

console.log('--- rzut 1: obrys L, 7 pomieszczeń ---');
const r1 = zbadaj('rzut 1', RZUT1);
console.log('    policzone: ' + r1.policzone + '/7, suma: ' + r1.suma.toFixed(2) +
            ' m², największe odchylenie: ' + (r1.odchylenie * 100).toFixed(2) + '%');

console.log('--- rzut 2: 8 pomieszczeń w trzech pasach ---');
const r2 = zbadaj('rzut 2', RZUT2);
console.log('    policzone: ' + r2.policzone + '/9, suma: ' + r2.suma.toFixed(2) +
            ' m², największe odchylenie: ' + (r2.odchylenie * 100).toFixed(2) + '%');

// Świadomie NIE powtarzamy tych rzutów z drżeniem ręki. Wpisywane tu wymiary
// biorą się z długości narysowanych odcinków, więc przy drżeniu podawalibyśmy
// silnikowi wartości już obarczone błędem rysunku i nie dałoby się odróżnić
// pomyłki programu od pomyłki w danych wejściowych. Odporność na niedokładny
// szkic (z dokładnymi pomiarami) sprawdza test-obrysy.js.

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
