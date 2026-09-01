/* Smart Energy Audyty - testy bazy materiałów, źródeł ciepła i obliczeń U.
 * Uruchomienie:  node tests/test-warstwy.js
 * Test wyciąga tablice MATERIALY / ZRODLA_CIEPLA / OPORY_PRZEJMOWANIA wprost
 * z index.html, więc nie da się przez przypadek przetestować starej kopii.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) { ok++; }
  else { bledy.push(nazwa + (szczegol ? ' -> ' + szczegol : '')); }
}

// --- wyciąganie literałów z index.html ---
function wytnij(nazwaStalej, otwierajacy, zamykajacy) {
  const start = html.indexOf('const ' + nazwaStalej + ' = ' + otwierajacy);
  if (start < 0) throw new Error('nie znaleziono ' + nazwaStalej + ' w index.html');
  let i = html.indexOf(otwierajacy, start), glebokosc = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === otwierajacy) glebokosc++;
    else if (html[j] === zamykajacy) { glebokosc--; if (!glebokosc) return html.slice(i, j + 1); }
  }
  throw new Error('nie domknięto literału ' + nazwaStalej);
}

const MATERIALY = eval(wytnij('MATERIALY', '[', ']'));
const ZRODLA = eval(wytnij('ZRODLA_CIEPLA', '[', ']'));
const OPORY = eval('(' + wytnij('OPORY_PRZEJMOWANIA', '{', '}') + ')');

// --- odtworzenie logiki liczenia U (musi być zgodna z index.html) ---
function materialByName(n) { return MATERIALY.find(m => m.n === n) || null; }

function oporWarstwy(w) {
  const g = parseFloat(w.gr);
  if (w.l > 0) return (g > 0) ? (g / 100) / w.l : null;
  const mat = materialByName(w.mat);
  if (!mat) return null;
  if (mat.R !== undefined) return mat.R;
  if (!(g > 0) || !(mat.l > 0)) return null;
  return (g / 100) / mat.l;
}

function obliczU(cat, warstwy) {
  if (!warstwy || !warstwy.length) return null;
  const op = OPORY[cat] || OPORY.SZ;
  let suma = 0;
  for (const w of warstwy) {
    const r = oporWarstwy(w);
    if (r === null) return null;
    suma += r;
  }
  const total = op.rsi + suma + op.rse;
  return total > 0 ? 1 / total : null;
}

// ===================== BAZA MATERIAŁÓW =====================
console.log('--- baza materiałów (' + MATERIALY.length + ' pozycji) ---');

sprawdz('baza materiałów nie skurczyła się', MATERIALY.length >= 63, 'jest ' + MATERIALY.length);

const nazwyMat = MATERIALY.map(m => m.n);
const dubleMat = nazwyMat.filter((n, i) => nazwyMat.indexOf(n) !== i);
sprawdz('brak zdublowanych nazw materiałów', dubleMat.length === 0, dubleMat.join(', '));

MATERIALY.forEach(m => {
  sprawdz('materiał ma nazwę i grupę', !!m.n && !!m.g, JSON.stringify(m));
  const maDane = (m.l > 0) || (m.R !== undefined && m.R > 0);
  sprawdz('materiał "' + m.n + '" ma λ albo stały opór R', maDane);
  if (m.l > 0) {
    // λ poza tym zakresem to prawie na pewno literówka (np. przecinek zamiast kropki)
    sprawdz('λ materiału "' + m.n + '" w rozsądnym zakresie 0,01-3,0', m.l >= 0.01 && m.l <= 3.0, 'λ = ' + m.l);
  }
});

// Materiały dopisane bez potwierdzenia w tabelach audytora muszą być oznaczone.
const dopisane = MATERIALY.filter(m => m.dodane);
sprawdz('dopisane materiały są oznaczone flagą', dopisane.length === 4, 'oznaczonych: ' + dopisane.length);

['Żużel paleniskowy', 'Papa asfaltowa', 'Płyta pilśniowa miękka'].forEach(n => {
  sprawdz('w bazie jest "' + n + '"', !!materialByName(n));
});
sprawdz('w bazie jest eternit', nazwyMat.some(n => n.toLowerCase().includes('eternit')));

// ===================== ZGODNOŚĆ Z materialy.json =====================
console.log('--- zgodność index.html z materialy.json ---');
const matJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'materialy.json'), 'utf8'));
sprawdz('materialy.json ma tyle samo pozycji co aplikacja',
  matJson.materialy.length === MATERIALY.length,
  'json ' + matJson.materialy.length + ' vs app ' + MATERIALY.length);

matJson.materialy.forEach(mj => {
  const ma = materialByName(mj.nazwa);
  sprawdz('materiał z JSON "' + mj.nazwa + '" jest w aplikacji', !!ma);
  if (ma && mj.lambda != null && ma.l != null) {
    sprawdz('λ zgodna dla "' + mj.nazwa + '"', Math.abs(ma.l - mj.lambda) < 1e-9,
      'json ' + mj.lambda + ' vs app ' + ma.l);
  }
});
sprawdz('materialy.json nie ma już nieuzupełnionych braków',
  (matJson._braki_do_uzupelnienia || []).length === 0,
  (matJson._braki_do_uzupelnienia || []).join(', '));

// ===================== ŹRÓDŁA CIEPŁA =====================
console.log('--- źródła ciepła (' + ZRODLA.length + ' pozycji) ---');
const nazwyZr = ZRODLA.map(z => z.n);
const dubleZr = nazwyZr.filter((n, i) => nazwyZr.indexOf(n) !== i);
sprawdz('brak zdublowanych nazw źródeł', dubleZr.length === 0, dubleZr.join(', '));

ZRODLA.forEach(z => {
  sprawdz('źródło "' + z.n + '" ma sprawność', typeof z.e === 'number' && z.e > 0);
  if (z.cop) {
    sprawdz('COP pompy "' + z.n + '" w zakresie 1,5-6,0', z.e >= 1.5 && z.e <= 6.0, 'COP = ' + z.e);
  } else {
    // sprawność spalania/wytwarzania nie może przekraczać 1,0 (kondensacja liczona wg wartości opałowej i tak < 1)
    sprawdz('sprawność "' + z.n + '" w zakresie 0,3-1,0', z.e >= 0.3 && z.e <= 1.0, 'η = ' + z.e);
  }
});

const zrJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'zrodla.json'), 'utf8'));
zrJson.zrodla.forEach(zj => {
  sprawdz('źródło z JSON "' + zj.nazwa + '" jest w aplikacji',
    nazwyZr.includes(zj.nazwa) || (zj._uwaga || '').includes('duplikat'));
});

// ===================== OBLICZENIA U =====================
console.log('--- obliczenia U ---');

// 1. Ściana: 25 cm cegły pełnej (λ 0,78) + 12 cm styropianu 0,038 + 1,5 cm tynku
{
  const w = [
    { mat: 'Cegła pełna zwykła', gr: 25 },
    { mat: 'Płyta styropianowa EPS 70-038 FASADA', gr: 12 },
    { mat: 'Tynk lub gładź cementowo-wapienna', gr: 1.5 }
  ];
  const R = 0.25 / 0.78 + 0.12 / 0.038 + 0.015 / 0.82;
  const oczekiwane = 1 / (0.13 + R + 0.04);
  const u = obliczU('SZ', w);
  sprawdz('U ściany ocieplonej liczone poprawnie', Math.abs(u - oczekiwane) < 1e-9, u);
  sprawdz('U ściany ocieplonej ~0,27 W/(m²·K)', u > 0.25 && u < 0.29, u.toFixed(3));
}

// 2. Ta sama ściana bez ocieplenia - U musi wyraźnie wzrosnąć
{
  const goła = obliczU('SZ', [{ mat: 'Cegła pełna zwykła', gr: 25 }]);
  const ocieplona = obliczU('SZ', [
    { mat: 'Cegła pełna zwykła', gr: 25 },
    { mat: 'Płyta styropianowa EPS 70-038 FASADA', gr: 12 }
  ]);
  sprawdz('ocieplenie obniża U', ocieplona < goła, goła.toFixed(3) + ' -> ' + ocieplona.toFixed(3));
  sprawdz('U gołej cegły 25 cm ~2,0 W/(m²·K)', goła > 1.9 && goła < 2.2, goła.toFixed(3));
}

// 3. Podłoga na gruncie z zasypką z żużla - nowy materiał musi liczyć się poprawnie
{
  const w = [
    { mat: 'Żużel paleniskowy', gr: 20 },
    { mat: 'Podkład z betonu', gr: 10 },
    { mat: 'Podłoga drewniana', gr: 2.5 }
  ];
  const oczekiwane = 1 / (0.17 + 0.20 / 0.25 + 0.10 / 1.0 + 0.025 / 0.3 + 0.04);
  const u = obliczU('PG', w);
  sprawdz('U podłogi z żużlem liczone poprawnie', Math.abs(u - oczekiwane) < 1e-9, u);
  sprawdz('opory przejmowania dla podłogi to Rsi 0,17', OPORY.PG.rsi === 0.17);
}

// 4. Pustka powietrzna ma stały opór, niezależny od wpisanej grubości
{
  const a = obliczU('SZ', [{ mat: 'Niewentylowane warstwy powietrza', gr: 3 }]);
  const b = obliczU('SZ', [{ mat: 'Niewentylowane warstwy powietrza', gr: 30 }]);
  sprawdz('grubość nie zmienia oporu pustki powietrznej', Math.abs(a - b) < 1e-12);
}

// 5. Brak kompletu danych - program nie zgaduje
{
  sprawdz('warstwa bez grubości nie daje U', obliczU('SZ', [{ mat: 'Cegła pełna zwykła', gr: '' }]) === null);
  sprawdz('materiał spoza bazy bez λ nie daje U', obliczU('SZ', [{ mat: 'Kamień z księżyca', gr: 10 }]) === null);
  sprawdz('pusta lista warstw nie daje U', obliczU('SZ', []) === null);
  sprawdz('jedna zła warstwa unieważnia całe U', obliczU('SZ', [
    { mat: 'Cegła pełna zwykła', gr: 25 },
    { mat: 'Kamień z księżyca', gr: 10 }
  ]) === null);
}

// 6. Materiał własny ("Inny") z podaną λ liczy się z pominięciem bazy
{
  const u = obliczU('SZ', [{ mat: 'Inny (wpisz własny)', gr: 20, l: 0.5 }]);
  const oczekiwane = 1 / (0.13 + 0.20 / 0.5 + 0.04);
  sprawdz('własna λ jest respektowana', Math.abs(u - oczekiwane) < 1e-9, u);
}

// 7. Każdy typ przegrody ma swoje opory przejmowania
['SZ', 'S', 'D', 'PG'].forEach(cat => {
  sprawdz('typ przegrody ' + cat + ' ma Rsi i Rse',
    OPORY[cat] && OPORY[cat].rsi > 0 && OPORY[cat].rse > 0);
});

// 8. Każdy materiał z bazy da się policzyć przy 10 cm (wyłapuje literówki w λ)
MATERIALY.forEach(m => {
  const u = obliczU('SZ', [{ mat: m.n, gr: 10 }]);
  sprawdz('materiał "' + m.n + '" daje policzalne U przy 10 cm', u !== null && isFinite(u) && u > 0);
});

// ===================== WERSJA =====================
console.log('--- wersja / cache ---');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const wersja = /CACHE_NAME\s*=\s*'smart-energy-v(\d+)'/.exec(sw);
sprawdz('sw.js ma numer wersji cache', !!wersja);
if (wersja) {
  sprawdz('numer wersji podbity ponad v41', parseInt(wersja[1], 10) >= 42, 'v' + wersja[1]);
  console.log('    wersja cache: v' + wersja[1]);
}

// ===================== BEZPIECZEŃSTWO PACZKI =====================
console.log('--- bezpieczeństwo paczki na GitHub ---');
sprawdz('DEFAULT_API_URL jest pusty', /const DEFAULT_API_URL\s*=\s*""\s*;/.test(html));
sprawdz('w index.html nie ma adresu /exec', !/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/.test(html));
const kod = fs.readFileSync(path.join(ROOT, 'apps-script', 'Kod.gs'), 'utf8');
sprawdz('SHEET_ID to placeholder', /SHEET_ID\s*=\s*'TU_WKLEJ/.test(kod));
sprawdz('PARENT_FOLDER_ID to placeholder', /PARENT_FOLDER_ID\s*=\s*'TU_WKLEJ/.test(kod));

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
