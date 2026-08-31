/* Smart Energy Audyty - test spójności paczki.
 * Uruchomienie:  node tests/test-paczka.js
 * Sprawdza to, co po nieudanej edycji index.html wywala aplikację od razu na starcie:
 * składnię skryptów, kompletność plików PWA, obecność kluczowych funkcji.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol ? ' -> ' + szczegol : ''));
}

// ===================== SKŁADNIA SKRYPTÓW =====================
console.log('--- składnia skryptów w index.html ---');

const skrypty = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  const przed = html.slice(0, m.index);
  skrypty.push({ kod: m[1], linia: przed.split('\n').length });
}
sprawdz('index.html zawiera skrypty wbudowane', skrypty.length > 0);

skrypty.forEach((s, i) => {
  try {
    new vm.Script(s.kod, { filename: 'index.html:script[' + i + ']' });
    ok++;
  } catch (e) {
    bledy.push('skrypt #' + i + ' (od linii ' + s.linia + ') ma błąd składni -> ' + e.message);
  }
});

const kodJS = skrypty.map(s => s.kod).join('\n');

// ===================== KLUCZOWE FUNKCJE =====================
console.log('--- kluczowe funkcje aplikacji ---');
[
  'obliczU',              // liczenie współczynnika przenikania
  'oporWarstwy',          // opór pojedynczej warstwy
  'fillMaterialOptions',  // lista materiałów w oknie warstw
  'openLayersDialog',     // okno warstw przy przegrodzie
  'materialByName',
  'zrodloByName'
].forEach(fn => {
  sprawdz('istnieje funkcja ' + fn + '()', new RegExp('function\\s+' + fn + '\\s*\\(').test(kodJS));
});

// ===================== POWTÓRZONE ID W HTML =====================
console.log('--- identyfikatory elementów ---');
const idy = [...html.matchAll(/\sid="([^"{}]+)"/g)].map(x => x[1]);
const duble = [...new Set(idy.filter((x, i) => idy.indexOf(x) !== i))];
sprawdz('brak powtórzonych id w HTML', duble.length === 0, duble.join(', '));

// ===================== PLIKI PWA =====================
console.log('--- pliki PWA ---');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

// Każdy lokalny plik z APP_SHELL musi istnieć, inaczej cache instaluje się niekompletny.
const shell = [...sw.matchAll(/'\.\/([^']*)'/g)].map(x => x[1]).filter(Boolean);
shell.forEach(f => {
  sprawdz('plik z APP_SHELL istnieje: ' + f, fs.existsSync(path.join(ROOT, f)));
});

manifest.icons.forEach(ic => {
  sprawdz('ikona z manifestu istnieje: ' + ic.src, fs.existsSync(path.join(ROOT, ic.src)));
});
sprawdz('manifest ma ikonę maskable', manifest.icons.some(ic => ic.purpose === 'maskable'));
sprawdz('index.html podpina manifest', /rel="manifest"/.test(html));
sprawdz('index.html rejestruje service workera', /serviceWorker\s*\.\s*register/.test(kodJS));

// Service worker nie może cache'ować zapytań innych niż GET - inaczej wysyłka na Dysk pada.
sprawdz('sw.js przepuszcza zapytania inne niż GET', /req\.method\s*!==\s*'GET'/.test(sw));
sprawdz('sw.js omija backend Apps Script', /script\.google\.com/.test(sw));

// ===================== DOKUMENTACJA I REPOZYTORIUM =====================
console.log('--- repozytorium ---');
[
  '.nojekyll',
  '.github/workflows/pages.yml',
  'apps-script/Kod.gs',
  'docs/INSTRUKCJA.md',
  'docs/PRZEKAZANIE-PROJEKTU.md',
  'materialy.json',
  'zrodla.json'
].forEach(f => sprawdz('plik w repozytorium: ' + f, fs.existsSync(path.join(ROOT, f))));

sprawdz('workflow publikuje przez GitHub Actions',
  /deploy-pages/.test(fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8')));

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
