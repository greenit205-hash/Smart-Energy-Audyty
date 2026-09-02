/* Smart Energy Audyty - zgodność z rozporządzeniami.
 * Uruchomienie:  node tests/test-rozporzadzenia.js     (wymaga: npm install)
 *
 * Dokumenty nadrzędne:
 *  - Dz.U. 2022 poz. 2816 - karta audytu energetycznego budynku (tabela 2)
 *  - Dz.U. 2023 poz. 697  - wzór świadectwa + tabela współczynników wi
 *
 * Test pilnuje, żeby aplikacja zbierała komplet danych, których te wzory
 * wymagają, i żeby wartości wi zgadzały się z tabelą z rozporządzenia.
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
  const ctx = { canvas: { width: 3000, height: 3000 }, measureText: () => ({ width: 10 }),
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
const doc = dom.window.document;

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}
const pole = n => doc.querySelector('[name="' + n + '"]');

// ===================== KARTA AUDYTU: DANE OGÓLNE =====================
// Dz.U. 2022 poz. 2816, tabela 2, część 1
console.log('--- karta audytu: dane ogólne budynku ---');
{
  const wymagane = {
    'konstrukcja': 'Konstrukcja/technologia budynku',
    'kondygnacje': 'Liczba kondygnacji',
    'lokale': 'Liczba lokali mieszkalnych',
    'osoby': 'Liczba osób użytkujących budynek',
    'ventilation': 'Rodzaj wentylacji',
    'year': 'Rok budowy'
  };
  Object.keys(wymagane).forEach(n => {
    sprawdz('jest pole: ' + wymagane[n], !!pole(n));
  });
}

// Część 5 karty: charakterystyka systemu wentylacji
console.log('--- karta audytu: wentylacja ---');
{
  sprawdz('jest pole: sposób doprowadzenia i odprowadzenia powietrza', !!pole('wentylacjaOpis'));
  sprawdz('jest pole: strumień powietrza zewnętrznego [m³/h]', !!pole('strumienPowietrza'));
  sprawdz('jest pole: krotność wymian powietrza [1/h]', !!pole('krotnoscWymian'));
  sprawdz('strumień powietrza jest polem liczbowym',
    pole('strumienPowietrza') && pole('strumienPowietrza').type === 'number');
}

// ===================== SPRAWNOŚCI SKŁADOWE =====================
// Dz.U. 2022 poz. 2816, tabela 2, części 3 i 4.
// Karta wymaga CZTERECH sprawności składowych, nie jednej łącznej.
console.log('--- karta audytu: sprawności składowe ---');
{
  const co = { etaCoWytw:'wytwarzania', etaCoPrzesyl:'przesyłu',
               etaCoReg:'regulacji i wykorzystania', etaCoAkum:'akumulacji' };
  Object.keys(co).forEach(n => sprawdz('ogrzewanie — sprawność ' + co[n], !!pole(n)));

  const cwu = { etaCwuWytw:'wytwarzania', etaCwuPrzesyl:'przesyłu',
                etaCwuReg:'regulacji i wykorzystania', etaCwuAkum:'akumulacji' };
  Object.keys(cwu).forEach(n => sprawdz('c.w.u. — sprawność ' + cwu[n], !!pole(n)));

  sprawdz('jest pole: przerwy na ogrzewanie w okresie tygodnia', !!pole('przerwyTydzien'));
  sprawdz('jest pole: przerwy na ogrzewanie w ciągu doby', !!pole('przerwyDoba'));
}

// Sprawność z bazy urządzeń ma trafiać także do pola "wytwarzania"
{
  app(`
    document.getElementById('heatingModel').value = 'Kocioł węglowy';
    document.getElementById('heatingEta').value = '';
    document.getElementById('etaCoWytw').value = '';
    onSourcePicked('heating');
  `);
  sprawdz('wybór urządzenia wypełnia sprawność wytwarzania',
    parseFloat(pole('etaCoWytw').value) > 0, pole('etaCoWytw').value);
  sprawdz('krótkie pole sprawności nadal działa',
    parseFloat(pole('heatingEta').value) > 0, pole('heatingEta').value);
}

// ===================== WSPÓŁCZYNNIK wi =====================
// Dz.U. 2023 poz. 697, pkt 3.1.3, tabela 1
console.log('--- świadectwo: współczynnik nakładu wi ---');
{
  const tab = app('return NOSNIKI_WI;');
  const wzorzec = {
    'Olej opałowy': 1.10, 'Gaz ziemny': 1.10, 'Gaz płynny': 1.10,
    'Węgiel kamienny': 1.10, 'Węgiel brunatny': 1.10,
    'Energia słoneczna': 0.00, 'Energia wiatrowa': 0.00, 'Energia geotermalna': 0.00,
    'Biomasa': 0.20, 'Biogaz': 0.50,
    'Ciepło sieciowe z kogeneracji — węgiel lub gaz': 0.80,
    'Ciepło sieciowe z kogeneracji — biomasa, biogaz': 0.15,
    'Ciepło sieciowe z ciepłowni — węgiel kamienny': 1.30,
    'Ciepło sieciowe z ciepłowni — gaz lub olej': 1.20,
    'Energia elektryczna z sieci': 2.50
  };
  sprawdz('tabela wi ma wszystkie 15 pozycji z rozporządzenia',
    tab.length === Object.keys(wzorzec).length, tab.length);
  Object.keys(wzorzec).forEach(n => {
    const x = tab.find(t => t.n === n);
    sprawdz('wi dla „' + n + '" = ' + wzorzec[n].toFixed(2),
      x && Math.abs(x.wi - wzorzec[n]) < 0.001, x && x.wi);
  });

  // wybór nośnika podstawia wi, ale da się nadpisać (dostawca podaje własne)
  app(`
    fillNosnikOptions();
    document.querySelector('[name="nosnikCo"]').value = 'Energia elektryczna z sieci';
    onNosnikChange('nosnikCo', 'wiCo');
  `);
  sprawdz('wybór nośnika podstawia wi z tabeli', pole('wiCo').value === '2.50', pole('wiCo').value);
  app(`document.querySelector('[name="wiCo"]').value = '1.80';`);
  sprawdz('wi da się nadpisać wartością od dostawcy', pole('wiCo').value === '1.80');

  sprawdz('nośnik da się wybrać osobno dla c.w.u.', !!pole('nosnikCwu') && !!pole('wiCwu'));
}

// ===================== PRZEGRODY W KARCIE AUDYTU =====================
// Dz.U. 2022 poz. 2816, tabela 2, część 2 - kategorie przegród
console.log('--- karta audytu: kategorie przegród ---');
{
  const typy = app('return PRZEGRODA_TYPY.map(t => t.n);');
  const potrzebne = [
    ['Ściany zewnętrzne', 'Ściana zewnętrzna'],
    ['Dach/stropodach', 'Dach'],
    ['Strop pod nieogrzewanymi poddaszami', 'Strop wewnętrzny'],
    ['Strop nad przejazdami', 'Strop nad przejazdem'],
    ['Podłoga na gruncie', 'Podłoga na gruncie'],
    ['Okna, drzwi balkonowe', 'Okno zewnętrzne'],
    ['Drzwi zewnętrzne/bramy', 'Drzwi zewnętrzne']
  ];
  potrzebne.forEach(([wiersz, typ]) => {
    sprawdz('karta audytu „' + wiersz + '" ma odpowiednik: ' + typ, typy.includes(typ), typy.join(', '));
  });

  // "Strop nad piwnicą" z karty audytu = strop wewnętrzny nad piwnicą
  const typyStropu = app('return TYPY_STROPU.map(t => t.n);');
  sprawdz('jest wariant stropu nad nieogrzewaną piwnicą',
    typyStropu.some(t => t.toLowerCase().includes('piwnic')), typyStropu.join(' | '));
  sprawdz('jest wariant stropu pod nieogrzewanym poddaszem',
    typyStropu.some(t => t.toLowerCase().includes('poddasz')));
}

// ===================== RAPORT =====================
console.log('--- raport wykazuje dane z rozporządzeń ---');
{
  const h = app(`
    const audit = {
      fullName:'Jan Kowalski', address:'Testowa 1', year:'1975',
      konstrukcja:'murowana, cegła pełna', kondygnacje:'2', lokale:'1', osoby:'4',
      ventilation:'Grawitacyjna', wentylacjaOpis:'kratki nawiewne, kominy',
      strumienPowietrza:'180', krotnoscWymian:'0.5', tempWewn:'20',
      heating:'Kocioł węglowy', cwu:'Zasobnik c.w.u.',
      etaCoWytw:'0.82', etaCoPrzesyl:'0.90', etaCoReg:'0.88', etaCoAkum:'1.00',
      etaCwuWytw:'0.80', etaCwuPrzesyl:'0.60', etaCwuAkum:'0.85',
      przerwyTydzien:'1.0', przerwyDoba:'0.95',
      nosnikCo:'Węgiel kamienny', wiCo:'1.10',
      nosnikCwu:'Energia elektryczna z sieci', wiCwu:'2.50'
    };
    return buildReportHtml(audit, [], []);
  `);
  sprawdz('raport podaje konstrukcję budynku', h.includes('murowana, cegła pełna'));
  sprawdz('raport podaje liczbę kondygnacji', h.includes('Liczba kondygnacji'));
  sprawdz('raport podaje liczbę lokali', h.includes('Liczba lokali'));
  sprawdz('raport podaje liczbę osób', h.includes('Liczba osób'));
  sprawdz('raport podaje strumień powietrza', h.includes('180'));
  sprawdz('raport podaje krotność wymian', h.includes('Krotność wymian'));
  sprawdz('raport ma tabelę sprawności składowych', h.includes('Sprawności składowe'));
  ['Wytwarzania', 'Przesyłu', 'Regulacji i wykorzystania', 'Akumulacji'].forEach(w => {
    sprawdz('raport wykazuje sprawność ' + w.toLowerCase(), h.includes(w));
  });
  sprawdz('raport wykazuje przerwy w ogrzewaniu', h.includes('Przerwy w ogrzewaniu'));
  sprawdz('raport wykazuje nośnik energii', h.includes('Węgiel kamienny'));
  sprawdz('raport wykazuje współczynnik wi', h.includes('2.50'));

  // brak danych nie może wysypać raportu ani zaśmiecać go pustymi wierszami
  const pusty = app("return buildReportHtml({ fullName:'X' }, [], []);");
  sprawdz('raport bez tych danych nadal się generuje', pusty.length > 100);
  sprawdz('bez danych nie ma pustej tabeli sprawności', !pusty.includes('Sprawności składowe'));
  sprawdz('bez danych nie ma pustego wiersza kondygnacji', !pusty.includes('Liczba kondygnacji'));
}


// ===================== UWAGI AUDYTORA =====================
console.log('--- uwagi audytora ---');
{
  sprawdz('jest pole na uwagi audytora', !!pole('auditorNotes'));
  sprawdz('pole na uwagi jest wielolinijkowe',
    pole('auditorNotes') && pole('auditorNotes').tagName === 'TEXTAREA');

  // przycisk dopisujący datę - uwagi powstają w kilku momentach wizyty
  app("document.getElementById('auditorNotes').value = ''; dopiszUwage();");
  const pierwszy = pole('auditorNotes').value;
  sprawdz('dopisanie wstawia stempel z datą', /^\[\d{1,2}\.\d{1,2}\.\d{4} \d{2}:\d{2}\] $/.test(pierwszy), pierwszy);

  app(`document.getElementById('auditorNotes').value += 'kocioł bez izolacji przewodów'; dopiszUwage();`);
  const drugi = pole('auditorNotes').value;
  sprawdz('kolejny wpis nie kasuje poprzedniego', drugi.includes('kocioł bez izolacji przewodów'), drugi);
  sprawdz('kolejny wpis jest oddzielony pustą linią', drugi.split('\n\n').length === 2, JSON.stringify(drugi));

  // uwagi trafiają do wszystkich trzech wyjść
  const notatka = 'Strop nad piwnicą do sprawdzenia.\nWłaściciel wspomniał o zalewaniu.';
  const raport = app(`return buildReportHtml({ fullName:'X', auditorNotes:${JSON.stringify(notatka)} }, [], []);`);
  sprawdz('raport drukuje treść uwag', raport.includes('Strop nad piwnicą do sprawdzenia'));
  sprawdz('raport zachowuje podział na linie', raport.includes('white-space:pre-wrap'));
  sprawdz('raport nie zostawia pustej ramki, gdy są uwagi',
    !/8\. Uwagi audytora<\/h2><p class="box">/.test(raport));

  const karta = app(`return buildObjectCardHtml({ fullName:'X', preferences:'-', auditorNotes:${JSON.stringify(notatka)} }, [], []);`);
  sprawdz('karta obiektu drukuje uwagi', karta.includes('Strop nad piwnicą do sprawdzenia'));

  // bez uwag zostaje wolne miejsce na dopiski odręczne - jak dotąd
  const pusty = app("return buildReportHtml({ fullName:'X' }, [], []);");
  sprawdz('bez uwag raport zostawia wolne miejsce',
    /8\. Uwagi audytora<\/h2><p class="box">/.test(pusty));
  const kartaPusta = app("return buildObjectCardHtml({ fullName:'X', preferences:'-' }, [], []);");
  sprawdz('bez uwag karta nie ma pustej sekcji', !kartaPusta.includes('Uwagi audytora'));
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
