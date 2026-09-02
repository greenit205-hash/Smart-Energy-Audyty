/* Smart Energy Audyty - typy przegród, przegroda niejednorodna, szablony.
 * Uruchomienie:  node tests/test-przegrody.js     (wymaga: npm install)
 *
 * Punktem odniesienia jest przegroda ze zrzutów z ArCADia-TERMOCAD:
 * strop drewniany na belkach, wycinek A (wypełnienie) i B (belka).
 * Jeśli nasze liczby zgadzają się z tamtymi, silnik liczy tak jak powinien.
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
    w.alert = m => { w.__alert = m; };
    w.confirm = () => true;
    w.prompt = () => w.__prompt !== undefined ? w.__prompt : 'Szablon';
    w.scrollTo = () => {};
  }
});
const app = kod => dom.window.eval('(function(){' + kod + '})()');
const doc = dom.window.document;

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}
const blisko = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);

// ===================== TYPY PRZEGRÓD =====================
console.log('--- typy przegród i opory przejmowania ---');
{
  const typy = app('return PRZEGRODA_TYPY.map(t => t.n);');
  ['Ściana zewnętrzna', 'Ściana wewnętrzna', 'Ściana na gruncie', 'Dach', 'Strop zewnętrzny',
   'Strop wewnętrzny', 'Strop nad przejazdem', 'Podłoga na gruncie', 'Okno zewnętrzne',
   'Okno wewnętrzne', 'Okno połaciowe', 'Drzwi zewnętrzne', 'Drzwi wewnętrzne'].forEach(n => {
    sprawdz('typ na liście: ' + n, typy.includes(n), typy.join(', '));
  });

  // wartości z tabeli PN-EN ISO 6946
  const par = [
    ['SC_ZEW', 0.13, 0.04], ['SC_WEW', 0.13, 0.13], ['SC_GRUNT', 0.13, 0.00],
    ['DACH', 0.10, 0.04], ['STR_WEW', 0.10, 0.10],
    ['STR_PRZEJ', 0.17, 0.04], ['PODL_GR', 0.17, 0.00]
  ];
  par.forEach(([id, rsi, rse]) => {
    const op = app(`return oporyPrzegrody({ typ:'${id}' }, 'SZ');`);
    sprawdz('opory dla ' + id + ' = ' + rsi + '/' + rse,
      blisko(op.rsi, rsi, 0.001) && blisko(op.rse, rse, 0.001), JSON.stringify(op));
  });
}

// Typ stropu zmienia opory (ze zrzutów z programu obliczeniowego)
console.log('--- typ stropu ---');
{
  const poddasze = app("return oporyPrzegrody({ typ:'STR_WEW', typStropu:'Pod nieogrzewanym poddaszem' }, 'S');");
  sprawdz('pod nieogrzewanym poddaszem: 0,10 / 0,10',
    blisko(poddasze.rsi, 0.10, 0.001) && blisko(poddasze.rse, 0.10, 0.001), JSON.stringify(poddasze));

  const piwnica = app(`return oporyPrzegrody({ typ:'STR_WEW',
    typStropu:'Nad nieogrzewanymi piwnicami i zamkniętymi przestrzeniami podpodłogowymi' }, 'S');`);
  sprawdz('nad nieogrzewanymi piwnicami: 0,17 / 0,17',
    blisko(piwnica.rsi, 0.17, 0.001) && blisko(piwnica.rse, 0.17, 0.001), JSON.stringify(piwnica));

  const miedzy = app("return oporyPrzegrody({ typ:'STR_WEW', typStropu:'Międzykondygnacyjny' }, 'S');");
  sprawdz('międzykondygnacyjny: 0,10 / 0,10',
    blisko(miedzy.rsi, 0.10, 0.001) && blisko(miedzy.rse, 0.10, 0.001), JSON.stringify(miedzy));

  // ręczne nadpisanie ma pierwszeństwo
  const reczne = app("return oporyPrzegrody({ typ:'SC_ZEW', rsi:0.20, rse:0.08 }, 'SZ');");
  sprawdz('ręcznie wpisane opory mają pierwszeństwo',
    blisko(reczne.rsi, 0.20, 0.001) && blisko(reczne.rse, 0.08, 0.001), JSON.stringify(reczne));
}

// ===================== PRZEGRODA NIEJEDNORODNA =====================
console.log('--- przegroda niejednorodna (przykład z programu obliczeniowego) ---');
{
  // Wycinek A: deska 4 / pustka / trociny 5 / deska 2 / tynk 1,5
  // Wycinek B: deska 4 / belka 15 / deska 2 / tynk 1,5
  // Rsi = Rse = 0,10 (strop wewnętrzny), L_A = 0,90 m, L_B = 0,15 m
  const scenariusz = `
    const A = [
      { mat:'Deska', gr:'4.0' },
      { mat:'Niewentylowane warstwy powietrza', gr:'10.0' },
      { mat:'Trociny drzewne luzem', gr:'5.0' },
      { mat:'Deska', gr:'2.0' },
      { mat:'Tynk lub gładź cementowo-wapienna', gr:'1.5' }
    ];
    const B = [
      { mat:'Deska', gr:'4.0' },
      { mat:'Bale drewniane', gr:'15.0' },
      { mat:'Deska', gr:'2.0' },
      { mat:'Tynk lub gładź cementowo-wapienna', gr:'1.5' }
    ];
    const meta = { typ:'STR_WEW', typStropu:'Pod nieogrzewanym poddaszem',
                   niejednorodna:true, LA:'0.90', LB:'0.15', warstwyB:B };
    return { w: obliczPrzegrode(meta, A, 'S'), A, B, meta };
  `;
  const { w } = app(scenariusz);
  sprawdz('przegroda niejednorodna daje wynik', w !== null);
  // wartości odczytane ze zrzutów: R_TA = 1,13   R_TB = 0,92
  sprawdz('opór wycinka A = 1,13 m²K/W', blisko(w.RA, 1.13, 0.01), w.RA && w.RA.toFixed(4));
  sprawdz('opór wycinka B = 0,92 m²K/W', blisko(w.RB, 0.92, 0.01), w.RB && w.RB.toFixed(4));
  sprawdz('udział wycinka A = 86%', blisko(w.fA, 0.857, 0.002), w.fA);
  sprawdz('udział wycinka B = 14%', blisko(w.fB, 0.143, 0.002), w.fB);
  sprawdz('udziały sumują się do 1', blisko(w.fA + w.fB, 1, 1e-9));

  // kres górny: 1/R' = fA/RA + fB/RB
  const oczek = 1 / (w.fA / w.RA + w.fB / w.RB);
  sprawdz('kres górny liczony równolegle', blisko(w.Rgorna, oczek, 1e-9), w.Rgorna);
  // wycinki mają tę samą grubość (22,5 cm), więc liczony jest też kres dolny
  sprawdz('ta sama grubość wycinków = oba kresy', w.granice === true);
  sprawdz('kres dolny nie przekracza górnego', w.Rdolna <= w.Rgorna,
    w.Rdolna.toFixed(4) + ' vs ' + w.Rgorna.toFixed(4));
  sprawdz('wynik to średnia z kresów', blisko(w.R, (w.Rgorna + w.Rdolna) / 2, 1e-9), w.R);
  sprawdz('U wychodzi ok. 0,95 W/(m²·K)', blisko(w.U, 0.950, 0.01), w.U && w.U.toFixed(4));

  // przegroda niejednorodna musi dawać U pomiędzy wynikami obu wycinków
  sprawdz('U mieści się między wycinkami',
    w.U > 1 / w.RA && w.U < 1 / w.RB, (1 / w.RA).toFixed(3) + ' < ' + w.U.toFixed(3) + ' < ' + (1 / w.RB).toFixed(3));
}

// Wycinki o tym samym układzie warstw - norma pozwala uśrednić granice
{
  const w = app(`
    const A = [{ mat:'Deska', gr:'4.0' }, { mat:'Wełna mineralna 0,036', gr:'15.0' }];
    const B = [{ mat:'Deska', gr:'4.0' }, { mat:'Bale drewniane', gr:'15.0' }];
    return obliczPrzegrode({ typ:'STR_WEW', niejednorodna:true, LA:'0.60', LB:'0.10', warstwyB:B }, A, 'S');
  `);
  sprawdz('zgodny układ warstw = liczone są obie granice', w.granice === true);
  sprawdz('granica dolna jest mniejsza od górnej', w.Rdolna < w.Rgorna,
    w.Rdolna && (w.Rdolna.toFixed(3) + ' / ' + w.Rgorna.toFixed(3)));
  sprawdz('wynik to średnia z obu granic',
    blisko(w.R, (w.Rgorna + w.Rdolna) / 2, 1e-9), w.R);
}

// Braki danych - program nie zgaduje
{
  sprawdz('brak szerokości wycinków nie daje U',
    app(`return obliczPrzegrode({ typ:'STR_WEW', niejednorodna:true,
      warstwyB:[{mat:'Deska',gr:'4.0'}] }, [{mat:'Deska',gr:'4.0'}], 'S');`) === null);
  sprawdz('pusty wycinek B nie daje U',
    app(`return obliczPrzegrode({ typ:'STR_WEW', niejednorodna:true, LA:'0.9', LB:'0.15',
      warstwyB:[] }, [{mat:'Deska',gr:'4.0'}], 'S');`) === null);
  sprawdz('materiał bez λ w wycinku B nie daje U',
    app(`return obliczPrzegrode({ typ:'STR_WEW', niejednorodna:true, LA:'0.9', LB:'0.15',
      warstwyB:[{mat:'Kamień z księżyca',gr:'4.0'}] }, [{mat:'Deska',gr:'4.0'}], 'S');`) === null);
}

// Przegroda jednorodna liczy się jak dotąd
console.log('--- przegroda jednorodna ---');
{
  const w = app(`
    return obliczPrzegrode({ typ:'SC_ZEW' }, [
      { mat:'Cegła pełna zwykła', gr:'25' },
      { mat:'Płyta styropianowa EPS 70-038 FASADA', gr:'12' }], 'SZ');
  `);
  const oczek = 1 / (0.13 + 0.25 / 0.78 + 0.12 / 0.038 + 0.04);
  sprawdz('ściana ocieplona liczona jak dotąd', blisko(w.U, oczek, 1e-9), w.U);
  sprawdz('bez zaznaczenia niejednorodności wycinek B jest pomijany', w.RB === null);

  // ten sam układ jako strop nad piwnicą = inne opory, inne U
  const strop = app(`
    return obliczPrzegrode({ typ:'STR_WEW',
      typStropu:'Nad nieogrzewanymi piwnicami i zamkniętymi przestrzeniami podpodłogowymi' }, [
      { mat:'Cegła pełna zwykła', gr:'25' },
      { mat:'Płyta styropianowa EPS 70-038 FASADA', gr:'12' }], 'S');
  `);
  sprawdz('zmiana typu przegrody zmienia U', !blisko(strop.U, w.U, 1e-6),
    w.U.toFixed(4) + ' vs ' + strop.U.toFixed(4));
  sprawdz('strop nad piwnicą ma wyższe opory, więc niższe U', strop.U < w.U);
}


// Drugi wzorzec ze zrzutu: ten sam strop, ale po dwie warstwy w każdym wycinku.
// Deska 4 cm + pustka 15 cm (wycinek A, 0,90 m) oraz deska 4 cm + belka 15 cm
// (wycinek B, 0,15 m). Program obliczeniowy pokazał R_TA = 0,49 i R_TB = 0,83.
{
  const w = app(`
    const A = [{ mat:'Deska', gr:'4.0' }, { mat:'Niewentylowane warstwy powietrza', gr:'15.0' }];
    const B = [{ mat:'Deska', gr:'4.0' }, { mat:'Bale drewniane', gr:'15.0' }];
    return obliczPrzegrode({ typ:'STR_WEW', typStropu:'Pod nieogrzewanym poddaszem',
      niejednorodna:true, LA:'0.90', LB:'0.15', warstwyB:B }, A, 'S');
  `);
  sprawdz('wycinek A: R = 0,49 m²K/W', blisko(w.RA, 0.4933, 0.001), w.RA.toFixed(5));
  sprawdz('wycinek B: R = 0,83 m²K/W', blisko(w.RB, 0.8333, 0.001), w.RB.toFixed(5));
  sprawdz('pustka 15 cm w stropie liczona jako 0,16',
    blisko(w.RA - 0.20 - 0.04 / 0.3, 0.16, 0.0001), (w.RA - 0.20 - 0.04 / 0.3).toFixed(5));
  sprawdz('belka 15 cm liczona jako 0,50',
    blisko(w.RB - 0.20 - 0.04 / 0.3, 0.50, 0.0001));
  // przy dwóch warstwach o zgodnych grubościach norma pozwala uśrednić granice
  sprawdz('liczone są obie granice', w.granice === true);
}


// Pełna przegroda STW 3 z pliku .thb: wycinki mają RÓŻNĄ liczbę warstw
// (5 i 4), ale tę samą grubość - norma pozwala wtedy policzyć oba kresy,
// tnąc przegrodę płaszczyznami wspólnymi dla obu wycinków.
{
  const w = app(`
    const A = [{ mat:'Deska', gr:'4.0' },
               { mat:'Niewentylowane warstwy powietrza', gr:'10.0' },
               { mat:'Izolacja', gr:'5.0', l:0.09 },
               { mat:'Deska', gr:'2.0' },
               { mat:'Tynk lub gładź cementowo-wapienna', gr:'1.5' }];
    const B = [{ mat:'Deska', gr:'4.0' },
               { mat:'Bale drewniane', gr:'15.0' },
               { mat:'Deska', gr:'2.0' },
               { mat:'Tynk lub gładź cementowo-wapienna', gr:'1.5' }];
    return obliczPrzegrode({ typ:'STR_WEW', typStropu:'Pod nieogrzewanym poddaszem',
      niejednorodna:true, LA:'0.90', LB:'0.15', warstwyB:B }, A, 'S');
  `);
  // wzorce odczytane z pliku .thb audytora
  sprawdz('STW 3 — opór wycinka A = 1,1338', blisko(w.RA, 1.1338, 0.001), w.RA.toFixed(4));
  sprawdz('STW 3 — opór wycinka B = 0,9183', blisko(w.RB, 0.9183, 0.001), w.RB.toFixed(4));
  // kres górny podany przez program obliczeniowy: 1,10
  sprawdz('STW 3 — kres górny zgodny z programem (1,10)',
    blisko(w.Rgorna, 1.10, 0.005), w.Rgorna.toFixed(4));
  sprawdz('różna liczba warstw nie blokuje kresu dolnego', w.granice === true);
  // PN-EN ISO 6946 wymaga, żeby kres dolny NIE był większy od górnego
  sprawdz('kres dolny nie przekracza górnego', w.Rdolna <= w.Rgorna,
    w.Rdolna.toFixed(4) + ' vs ' + w.Rgorna.toFixed(4));
  sprawdz('wynik to średnia z obu kresów',
    blisko(w.R, (w.Rgorna + w.Rdolna) / 2, 1e-9), w.R.toFixed(4));
}

// Wycinki o różnej grubości - nie ma wspólnych płaszczyzn cięcia,
// więc kres dolny nie jest liczony i zostaje sam kres górny.
{
  const w = app(`
    const A = [{ mat:'Deska', gr:'4.0' }, { mat:'Bale drewniane', gr:'15.0' }];
    const B = [{ mat:'Deska', gr:'4.0' }, { mat:'Bale drewniane', gr:'20.0' }];
    return obliczPrzegrode({ typ:'STR_WEW', niejednorodna:true, LA:'0.90', LB:'0.15', warstwyB:B }, A, 'S');
  `);
  sprawdz('różna grubość wycinków = tylko kres górny', w.granice === false);
  sprawdz('wynik równy kresowi górnemu', blisko(w.R, w.Rgorna, 1e-9));
}

// ===================== OKNO WARSTW =====================
console.log('--- okno warstw ---');
{
  app(`
    sketches = [{ id:1, name:'Parter', kind:'przekroj', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 envTags:{ a:{cat:'S',num:1} }, noteLines:[], apexDims:{}, hatches:[], slopes:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects;
    renderEnvelopeFields();
    openLayersDialog('S1', 'S');
  `);
  sprawdz('okno warstw ma listę typów przegrody',
    doc.querySelectorAll('#layerTypSelect option').length === 13,
    doc.querySelectorAll('#layerTypSelect option').length);
  sprawdz('dla stropu podpowiada się typ "Strop wewnętrzny"',
    doc.getElementById('layerTypSelect').value === 'STR_WEW');
  sprawdz('przy stropie pojawia się wybór typu stropu',
    doc.getElementById('layerTypStropuBox').style.display === 'block');
  sprawdz('opory wypełniają się z normy',
    doc.getElementById('layerRsi').value === '0.10' && doc.getElementById('layerRse').value === '0.10',
    doc.getElementById('layerRsi').value + '/' + doc.getElementById('layerRse').value);

  // zmiana na ścianę zewnętrzną chowa typ stropu i zmienia opory
  app("document.getElementById('layerTypSelect').value = 'SC_ZEW'; onTypPrzegrodyChange();");
  sprawdz('dla ściany typ stropu znika',
    doc.getElementById('layerTypStropuBox').style.display === 'none');
  sprawdz('opory zmieniają się na 0,13 / 0,04',
    doc.getElementById('layerRsi').value === '0.13' && doc.getElementById('layerRse').value === '0.04');

  // wycinki
  app("document.getElementById('layerNiejednorodna').checked = true; onNiejednorodnaChange();");
  sprawdz('zaznaczenie niejednorodności pokazuje wycinki',
    doc.getElementById('layerWycinkiBox').style.display === 'block');

  app(`
    setWycinek('A');
    document.getElementById('layerMatInput').value = 'Deska';
    document.getElementById('layerThickInput').value = '4';
    addLayer();
    setWycinek('B');
    document.getElementById('layerMatInput').value = 'Bale drewniane';
    document.getElementById('layerThickInput').value = '15';
    addLayer();
  `);
  const stan = app("return { A: layersDraft.length, B: layersDraftB.length, aMat: layersDraft[0].mat, bMat: layersDraftB[0].mat };");
  sprawdz('warstwa trafia do wycinka, który jest otwarty',
    stan.A === 1 && stan.B === 1 && stan.aMat === 'Deska' && stan.bMat === 'Bale drewniane',
    JSON.stringify(stan));

  // zapis do formularza
  app(`
    document.getElementById('layerLA').value = '0.90';
    document.getElementById('layerLB').value = '0.15';
    saveLayers();
  `);
  const meta = app("return readMeta('S1');");
  sprawdz('typ przegrody zapisany', meta.typ === 'SC_ZEW', JSON.stringify(meta));
  sprawdz('niejednorodność zapisana', meta.niejednorodna === true);
  sprawdz('szerokości wycinków zapisane', meta.LA === '0.90' && meta.LB === '0.15');
  sprawdz('warstwy wycinka B zapisane', (meta.warstwyB || []).length === 1);
  sprawdz('warstwy wycinka A zostają w swoim polu',
    app("return readLayers('S1').length;") === 1);
  const uPole = doc.querySelector('[name="S1_uvalue"]').value;
  sprawdz('U trafiło do formularza', parseFloat(uPole) > 0, uPole);
}

// ===================== SZABLONY =====================
console.log('--- szablony przegród ---');
{
  app("localStorage.removeItem('przegrodySzablony');");
  app(`
    openLayersDialog('S1', 'S');
    window.__prompt = 'Strop drewniany na belkach';
    saveAsTemplate();
  `);
  const arr = app("return getSzablony();");
  sprawdz('szablon został zapisany', arr.length === 1, JSON.stringify(arr.map(t => t.nazwa)));
  sprawdz('szablon pamięta nazwę', arr[0].nazwa === 'Strop drewniany na belkach');
  sprawdz('szablon pamięta warstwy obu wycinków',
    arr[0].warstwy.length === 1 && arr[0].warstwyB.length === 1);
  sprawdz('szablon pamięta typ i niejednorodność',
    arr[0].typ === 'SC_ZEW' && arr[0].niejednorodna === true);
  sprawdz('szablon pamięta szerokości', arr[0].LA === '0.90' && arr[0].LB === '0.15');

  // użycie szablonu na innej przegrodzie
  app(`
    objects.envTags = { a:{cat:'S',num:1}, b:{cat:'SZ',num:1} };
    renderEnvelopeFields();
    openLayersDialog('SZ1', 'SZ');
  `);
  sprawdz('nowa przegroda startuje pusta', app("return layersDraft.length;") === 0);
  app("applyTemplate(0);");
  const po = app("return { A: layersDraft.length, B: layersDraftB.length, typ: document.getElementById('layerTypSelect').value, niejed: document.getElementById('layerNiejednorodna').checked, LA: document.getElementById('layerLA').value };");
  sprawdz('szablon wypełnia warstwy', po.A === 1 && po.B === 1, JSON.stringify(po));
  sprawdz('szablon ustawia typ przegrody', po.typ === 'SC_ZEW', po.typ);
  sprawdz('szablon ustawia niejednorodność i szerokości', po.niejed === true && po.LA === '0.90');

  // lista szablonów w oknie
  sprawdz('szablon widać na liście w oknie warstw',
    doc.getElementById('layerTemplateList').innerHTML.includes('Strop drewniany na belkach'));

  // usuwanie
  app("deleteTemplate(0);");
  sprawdz('szablon da się usunąć', app("return getSzablony().length;") === 0);
  app("localStorage.removeItem('przegrodySzablony');");
}

// ===================== RAPORT =====================
console.log('--- przegroda niejednorodna w raporcie ---');
{
  const r = app(`
    const B = [{ mat:'Bale drewniane', gr:'15.0' }];
    const audit = {
      S1_layers: JSON.stringify([{ mat:'Deska', gr:'4.0' }, { mat:'Trociny drzewne luzem', gr:'5.0' }]),
      S1_przegroda: JSON.stringify({ typ:'STR_WEW', typStropu:'Pod nieogrzewanym poddaszem',
                                     niejednorodna:true, LA:'0.90', LB:'0.15', warstwyB:B })
    };
    const w = rowsFromEnvelopes(audit)[0];
    return { id:w.id, typ:w.typNazwa, niejed:w.niejednorodna, u:w.uObliczone,
             budowa: budowaPrzegrody(w, x => x) };
  `);
  sprawdz('przegroda trafia do raportu', r.id === 'S1');
  sprawdz('raport zna typ przegrody', r.typ === 'Strop wewnętrzny', r.typ);
  sprawdz('raport wie, że przegroda jest niejednorodna', r.niejed === true);
  sprawdz('U policzone metodą dla niejednorodnej', r.u > 0, r.u);
  sprawdz('opis wymienia oba wycinki',
    r.budowa.includes('Wycinek A') && r.budowa.includes('Wycinek B') && r.budowa.includes('Bale drewniane'),
    r.budowa);
  sprawdz('opis podaje typ przegrody', r.budowa.includes('Strop wewnętrzny'));
}


// ===================== ZGODNOŚĆ Z PLIKIEM Z ARCADIA-TERMOCAD =====================
// Przegrody wyjęte z prawdziwego pliku .thb audytora. U policzone przez program
// obliczeniowy jest tu wzorcem — nasz silnik musi trafiać w te same liczby.
console.log('--- zgodność z plikiem .thb ---');
{
  const wzorce = [
    { n:'SZ 1 - styropian 10 cm', typ:'SC_ZEW', U:0.2975, warstwy:[
      ['Tynk mineralny',0.3], ['EPS 70-042',10, 0.042], ['Beton komórkowy',30, 0.38], ['Tynk c-w',1.5] ] },
    { n:'SZ 2 - 2x cegła', typ:'SC_ZEW', U:1.2487, warstwy:[
      ['Tynk cementowy',1, 1.0], ['Cegła',47, 0.78], ['Tynk c-w',1.5] ] },
    { n:'SZ 3 - 1x cegła', typ:'SC_ZEW', U:1.7155, warstwy:[
      ['Tynk cementowy',1, 1.0], ['Cegła',30, 0.78], ['Tynk c-w',1.5] ] },
    { n:'PG - podłoga na gruncie', typ:'PODL_GR', U:1.1885, warstwy:[
      ['Wykładzina',1, 0.2], ['Wylewka',5, 1.0], ['Podkład betonowy',10, 1.4], ['Piasek',20, 0.4] ] },
    { n:'SG - ściana na gruncie', typ:'SC_GRUNT', U:3.5439, warstwy:[
      ['Beton zbrojony',35, 2.3] ] }
  ];
  wzorce.forEach(wz => {
    const warstwy = wz.warstwy.map(([nazwa, gr, lam]) =>
      lam !== undefined ? { mat:nazwa, gr:String(gr), l:lam } : { mat:'Tynk lub gładź cementowo-wapienna', gr:String(gr) });
    const w = app(`return obliczPrzegrode({ typ:'${wz.typ}' }, ${JSON.stringify(warstwy)}, 'SZ');`);
    sprawdz(wz.n + ' — U zgodne z programem obliczeniowym (' + wz.U + ')',
      w !== null && blisko(w.U, wz.U, 0.001), w && w.U.toFixed(4));
  });

  // pustka powietrzna w stropie: program obliczeniowy przyjął R = 0,16 przy 15 cm
  const rp = app("return oporPustki(15, 'w górę');");
  sprawdz('pustka 15 cm w stropie: R = 0,16', blisko(rp, 0.16, 0.001), rp);
  sprawdz('ta sama pustka w ścianie: R = 0,18', blisko(app("return oporPustki(15, 'poziomy');"), 0.18, 0.011),
    app("return oporPustki(15, 'poziomy');"));
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
