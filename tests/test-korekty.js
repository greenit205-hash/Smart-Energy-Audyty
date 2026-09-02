/* Smart Energy Audyty - poprawianie tego, co już wstawione.
 * Uruchomienie:  node tests/test-korekty.js     (wymaga: npm install)
 *
 * Scenariusze wzięte wprost z audytu:
 *  - wstawione okno okazało się drzwiami,
 *  - pomieszczenie narysowane i zmierzone, a potem wyszła wnęka,
 *  - skasowana ściana, a powierzchnia została stara.
 * We wszystkich trzech chodzi o to samo: poprawić bez cofania całej pracy.
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
    w.prompt = () => null;
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

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 envTags:{}, noteLines:[], apexDims:{}, hatches:[], slopes:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    globalOpeningsMemory = {};
  `);
}

// Prostokątne pomieszczenie 5×4 m, obrys rozpoznany przez samą aplikację
function pokoj5x4() {
  return app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,0, 5,0); L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', heated:'Tak', ac:'Nie',
                       polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[getSegKey(O, O, O+5*P, O)] = { val:'5.00' };
    objects.customDims[getSegKey(O+5*P, O, O+5*P, O+4*P)] = { val:'4.00' };
    recalculateRooms();
    return objects.rooms[0].area;
  `);
}

// ===================== TYPY POMIESZCZEŃ =====================
console.log('--- typy pomieszczeń ---');
{
  const opcje = [...doc.querySelectorAll('#roomTypeSelect option')].map(o => o.value);
  sprawdz('na liście jest Piwnica', opcje.includes('Piwnica'), opcje.join(', '));
  sprawdz('na liście jest Garaż', opcje.includes('Garaż'));
  sprawdz('na liście jest strych / poddasze nieużytkowe',
    opcje.some(o => o.toLowerCase().includes('strych')));
  sprawdz('stare typy nie zniknęły',
    ['Pokój', 'Kuchnia', 'Łazienka', 'Kotłownia', 'Inny'].every(t => opcje.includes(t)));
}

// ===================== POPRAWIANIE OTWORU =====================
console.log('--- poprawianie wstawionego otworu ---');

// Okno wstawione przez pomyłkę zamiast drzwi
nowySzkic();
pokoj5x4();
app(`
  const P = PIXELS_PER_METER, O = 200;
  objects.openings = [{ x:O+2*P, y:O, angle:0, id:'O1', width:120, height:140, uValue:1.1 }];
`);
{
  const przed = app("return { id: objects.openings[0].id, w: objects.openings[0].width };");
  sprawdz('otwór wstawiony jako okno', przed.id === 'O1' && przed.w === 120);

  // audytor klika w otwór narzędziem 🚪 Otwór
  app("openOpeningForEdit(0);");
  sprawdz('kliknięcie w otwór otwiera go do poprawki',
    doc.getElementById('openingOverlay').style.display === 'flex');
  sprawdz('okno wypełnia się danymi tego otworu',
    doc.getElementById('openingIdInput').value === 'O1' &&
    doc.getElementById('openingWidth').value === '120' &&
    doc.getElementById('openingHeight').value === '140');
  sprawdz('tytuł mówi o poprawianiu, nie o wstawianiu',
    doc.getElementById('openingDialogTitle').innerText.includes('Popraw'));
  sprawdz('przy poprawianiu jest przycisk usuwania',
    doc.getElementById('openingDeleteBtn').style.display === 'inline-block');

  // zmiana rodzaju: okno -> drzwi zewnętrzne
  app(`
    document.getElementById('openingTypeSelect').value = 'DZ';
    onOpeningTypeChange();
  `);
  sprawdz('zmiana rodzaju podpowiada nowy numer',
    doc.getElementById('openingIdInput').value === 'DZ1',
    doc.getElementById('openingIdInput').value);
  sprawdz('zmiana rodzaju NIE kasuje wpisanych wymiarów',
    doc.getElementById('openingWidth').value === '120' &&
    doc.getElementById('openingHeight').value === '140');

  // poprawiamy jeszcze wymiary i zapisujemy
  app(`
    document.getElementById('openingWidth').value = '90';
    document.getElementById('openingHeight').value = '200';
    addOpeningToCanvas();
  `);
  const po = app("return objects.openings.map(o => ({ id:o.id, w:o.width, h:o.height, x:o.x, y:o.y }));");
  sprawdz('poprawka nie tworzy drugiego otworu', po.length === 1, po.length);
  sprawdz('rodzaj otworu zmieniony na drzwi', po[0].id === 'DZ1', po[0].id);
  sprawdz('wymiary poprawione', po[0].w === 90 && po[0].h === 200, JSON.stringify(po[0]));
  sprawdz('otwór został na swoim miejscu',
    po[0].x === 200 + 2 * 50 && po[0].y === 200, JSON.stringify(po[0]));
  sprawdz('okno zamyka się po zapisie',
    doc.getElementById('openingOverlay').style.display === 'none');
}

// Wstawianie kolejnego otworu po poprawce musi wrócić do trybu "nowy"
{
  app(`
    editingOpeningIndex = -1; setOpeningDialogMode(false);
    document.getElementById('openingTypeSelect').value = 'O';
    pendingOpeningPos = { x:250, y:400 }; pendingOpeningAngle = 0;
    autoFillOpeningId();
    document.getElementById('openingWidth').value = '150';
    document.getElementById('openingHeight').value = '150';
    addOpeningToCanvas();
  `);
  const wszystkie = app("return objects.openings.map(o => o.id);");
  sprawdz('po poprawce dalej da się wstawiać nowe otwory',
    wszystkie.length === 2, wszystkie.join(', '));
  sprawdz('nowy otwór nie nadpisał poprawionego',
    wszystkie.includes('DZ1'), wszystkie.join(', '));
}

// Usuwanie otworu z okna poprawki
{
  app("openOpeningForEdit(1); deleteOpeningFromDialog();");
  sprawdz('otwór da się usunąć z okna poprawki',
    app("return objects.openings.length;") === 1);
}

// ===================== OBRYS PO ZMIANIE ŚCIAN =====================
console.log('--- obrys pomieszczenia po zmianie ścian ---');

// Sytuacja z audytu: pokój narysowany i zmierzony, potem wychodzi wnęka
nowySzkic();
{
  sprawdz('pokój 5×4 liczy się na 20,00 m²', pokoj5x4() === '20.00');
  sprawdz('świeżo założony obrys jest aktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === false);

  // dorysowanie wnęki 1×1 m w narożniku
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(4,4, 4,3); L(4,3, 5,3);
    recalculateRooms();
  `);
  sprawdz('po dorysowaniu wnęki obrys jest oznaczony jako nieaktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === true);
  sprawdz('powierzchnia bez przeliczenia zostaje stara',
    app("return objects.rooms[0].area;") === '20.00');

  // audytor klika 🔄
  const udane = app("return refreshRoomOutline(0, 0);");
  sprawdz('przeliczenie obrysu się udaje', udane === true);
  const po = app("return { rogi: objects.rooms[0].polygon.length, num: objects.rooms[0].num, typ: objects.rooms[0].name, ogrz: objects.rooms[0].heated };");
  sprawdz('obrys ma teraz 6 rogów', po.rogi === 6, po.rogi);
  sprawdz('numer pomieszczenia zachowany', po.num === '1');
  sprawdz('typ i ogrzewanie zachowane', po.typ === 'Pokój' && po.ogrz === 'Tak');
  sprawdz('po przeliczeniu obrys jest aktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === false);
}

// Skasowanie ściany - powierzchnia musi przestać udawać, że wszystko gra
nowySzkic();
{
  pokoj5x4();
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,4, 0,7); L(0,7, 5,7); L(5,7, 5,4);      // drugi pokój pod spodem
    const f = findEnclosingFace({ x:O+2.5*P, y:O+5.5*P });
    objects.rooms.push({ id:2, num:'2', name:'Kuchnia', heated:'Tak', ac:'Nie',
                         polygon:f, centroid:getVisualCenter(f) });
    objects.customDims[getSegKey(O, O+4*P, O, O+7*P)] = { val:'3.00' };
    objects.customDims[getSegKey(O, O+7*P, O+5*P, O+7*P)] = { val:'5.00' };
    recalculateRooms();
  `);
  sprawdz('drugi pokój 5×3 = 15,00 m²', app("return objects.rooms[1].area;") === '15.00',
    app("return objects.rooms[1].area;"));

  // kasujemy ścianę między pokojami
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const k = objects.lines.findIndex(l => Math.abs(l.y1 - (O+4*P)) < 1 && Math.abs(l.y2 - (O+4*P)) < 1);
    objects.lines.splice(k, 1);
    recalculateRooms();
    objects.rooms.forEach(r => { r._staleOutline = roomOutlineStale(r); });
  `);
  const stan = app("return objects.rooms.map(r => ({ num:r.num, area:r.area, nieakt: !!r._staleOutline }));");
  sprawdz('po skasowaniu ściany oba obrysy są oznaczone jako nieaktualne',
    stan.every(r => r.nieakt), JSON.stringify(stan));

  // przeliczenie zbiorcze
  app("dom_alert = null; refreshAllOutlines(0);");
  const po = app("return objects.rooms.map(r => ({ num:r.num, area:r.area, rogi:r.polygon.length }));");
  // po skasowaniu ściany oba pomieszczenia opisują ten sam, jeden obszar 5×7
  sprawdz('przeliczenie nie wywraca się na skasowanej ścianie', Array.isArray(po) && po.length === 2);
  sprawdz('obrysy zostały przeliczone na nowy kształt',
    po.every(r => r.rogi === 4), JSON.stringify(po));
  const kontrola = app("return runAuditChecks().filter(i => i.level === 'error').map(i => i.text);");
  sprawdz('kontrola wyłapuje, że dwa pomieszczenia opisują ten sam obszar',
    kontrola.some(t => t.includes('ten sam obszar')), kontrola.join(' | '));
}

// Obrys otwarty - program nie może udawać, że przeliczył
nowySzkic();
{
  pokoj5x4();
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines.splice(0, 1);      // kasujemy górną ścianę, obrys się nie domyka
    recalculateRooms();
  `);
  sprawdz('otwarty obrys jest oznaczony jako nieaktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === true);
  const wynik = app("window.__alert = null; return refreshRoomOutline(0, 0, false);");
  sprawdz('przy otwartym obrysie przeliczenie się nie udaje', wynik === false);
  sprawdz('program mówi, o co chodzi',
    (dom.window.__alert || '').includes('zamkniętego obszaru'), dom.window.__alert);
  sprawdz('stary obrys nie został skasowany',
    app("return objects.rooms[0].polygon.length;") === 4);
}

// Pomieszczenie wpisane ręcznie (bez obrysu) nie może być oznaczane
nowySzkic();
{
  app(`
    objects.rooms = [{ id:1, num:'1', name:'Piwnica', heated:'Nie', ac:'Nie',
                       manual:true, x:300, y:300, area:'12.50' }];
  `);
  sprawdz('ręcznie wpisane pomieszczenie nie jest zgłaszane jako nieaktualne',
    app("return roomOutlineStale(objects.rooms[0]);") === false);
  sprawdz('ręcznie wpisana powierzchnia zostaje nietknięta',
    app("recalculateRooms(); return objects.rooms[0].area;") === '12.50');
}


// ===================== POLE TEKSTOWE NA SZKICU =====================
console.log('--- pole tekstowe na szkicu ---');
nowySzkic();
{
  const d = dom.window.document;
  // wstawienie tekstu wielolinijkowego
  app(`
    currentMode = 'text';
    editingLabelIndex = -1;
    labelPosCanvas = { x: 300, y: 300 };
    populateLabelSelect();
    document.getElementById('labelInput').value = ['Strop drewniany','belki co 90 cm','od strony poddasza wełna'].join(String.fromCharCode(10));
    document.getElementById('labelSize').value = '28';
    document.getElementById('labelBox').checked = true;
    addTextToCanvas();
  `);
  const l = app("return objects.labels;");
  sprawdz('tekst trafia na szkic', l.length === 1, l.length);
  sprawdz('tekst zachowuje wszystkie linie',
    l[0].text.split(String.fromCharCode(10)).length === 3, JSON.stringify(l[0].text));
  sprawdz('zapisana jest wielkość liter', l[0].size === 28, l[0].size);
  sprawdz('zapisana jest informacja o ramce', l[0].box === true);

  // poprawianie istniejącego pola
  app("openLabelForEdit(0);");
  sprawdz('kliknięcie w pole otwiera je do poprawki',
    d.getElementById('labelOverlay').style.display === 'flex');
  sprawdz('okno wypełnia się treścią pola',
    d.getElementById('labelInput').value.includes('belki co 90 cm'));
  sprawdz('przy poprawce jest przycisk usuwania',
    d.getElementById('labelDeleteBtn').style.display === 'inline-block');

  app(`
    document.getElementById('labelInput').value = 'Strop drewniany - poprawione';
    document.getElementById('labelBox').checked = false;
    addTextToCanvas();
  `);
  const po = app("return objects.labels;");
  sprawdz('poprawka nie tworzy drugiego pola', po.length === 1, po.length);
  sprawdz('treść została zmieniona', po[0].text === 'Strop drewniany - poprawione', po[0].text);
  sprawdz('ramkę da się wyłączyć', po[0].box === false);
  sprawdz('pole zostało na swoim miejscu', po[0].x === 300 && po[0].y === 300);

  // gotowa pozycja z listy dopisuje się, zamiast kasować tekst
  app(`
    openLabelForEdit(0);
    document.getElementById('labelSelect').value = 'Dach';
    onLabelPresetPicked();
  `);
  sprawdz('podpowiedź z listy dopisuje się do tekstu',
    d.getElementById('labelInput').value.includes('poprawione') &&
    d.getElementById('labelInput').value.includes('Dach'),
    d.getElementById('labelInput').value);
  app("closeLabelDialog();");

  // wyczyszczenie treści = usunięcie pola
  app(`
    openLabelForEdit(0);
    document.getElementById('labelInput').value = '   ';
    addTextToCanvas();
  `);
  sprawdz('wyczyszczenie treści usuwa pole', app("return objects.labels.length;") === 0);

  // stare etykiety (bez pól size/box) muszą się nadal rysować
  app(`
    objects.labels = [{ x:100, y:100, text:'Stara etykieta' }];
    renderCanvas();
  `);
  sprawdz('etykiety ze starych szkiców nie wywracają rysowania',
    app("return objects.labels.length;") === 1);
}


// ===================== WARSTWY NIE GINĄ PRZY PRZEBUDOWIE LISTY =====================
// Sytuacja z audytu: opisane wszystkie przegrody, przy ostatniej błąd, kasowanie
// jej — i znikały warstwy WSZYSTKICH pozostałych. Ukryte pola z warstwami leżały
// w kontenerze przebudowywanym przez innerHTML.
console.log('--- warstwy przegród przy kasowaniu innej przegrody ---');
nowySzkic();
{
  app(`
    sketches[0].kind = 'przekroj';
    objects.envTags = { a:{cat:'SZ',num:1}, b:{cat:'SZ',num:2}, c:{cat:'S',num:1} };
    renderEnvelopeFields();
    ['SZ1','SZ2','S1'].forEach((k, i) => {
      writeLayers(k, [{ mat:'Cegła pełna zwykła', gr:String(20 + i) }]);
      writeMeta(k, { typ:'SC_ZEW' });
      const u = document.querySelector('[name="' + k + '_uvalue"]');
      if (u) u.value = (0.3 + i / 10).toFixed(3);
      const d = document.querySelector('[name="' + k + '_desc"]');
      if (d) d.value = 'opis ' + k;
    });
  `);
  sprawdz('trzy przegrody mają warstwy',
    app("return ['SZ1','SZ2','S1'].map(k => readLayers(k).length).join(',');") === '1,1,1');

  // kasujemy ostatnią przegrodę - tak jak podczas audytu
  app("removeEnvTagByKey(0, 'c');");
  const po = app("return { SZ1: readLayers('SZ1').length, SZ2: readLayers('SZ2').length, S1: readLayers('S1').length };");
  sprawdz('warstwy SZ1 przeżyły kasowanie innej przegrody', po.SZ1 === 1, JSON.stringify(po));
  sprawdz('warstwy SZ2 przeżyły kasowanie innej przegrody', po.SZ2 === 1, JSON.stringify(po));
  sprawdz('skasowana przegroda straciła swoje warstwy', po.S1 === 0, JSON.stringify(po));

  const meta = app("return { SZ1: readMeta('SZ1').typ, SZ2: readMeta('SZ2').typ };");
  sprawdz('typy przegród też przeżyły', meta.SZ1 === 'SC_ZEW' && meta.SZ2 === 'SC_ZEW', JSON.stringify(meta));

  const widoczne = app(`return {
    u: document.querySelector('[name="SZ1_uvalue"]').value,
    d: document.querySelector('[name="SZ2_desc"]').value };`);
  sprawdz('U i opisy pozostałych przegród nietknięte',
    widoczne.u === '0.300' && widoczne.d === 'opis SZ2', JSON.stringify(widoczne));

  // dodanie nowej przegrody też nie może niczego zgubić
  app(`
    objects.envTags['d'] = { cat:'D', num:1 };
    renderEnvelopeFields();
  `);
  sprawdz('dodanie przegrody nie kasuje warstw pozostałych',
    app("return readLayers('SZ1').length + ',' + readLayers('SZ2').length;") === '1,1');
}

// ===================== SZABLONY W KOPII ZAPASOWEJ =====================
console.log('--- szablony w kopii zapasowej ---');
{
  app(`
    localStorage.removeItem('przegrodySzablony');
    saveSzablony([{ nazwa:'Ściana 2x cegła', typ:'SC_ZEW', warstwy:[{mat:'Cegła pełna zwykła',gr:'47'}], warstwyB:[] }]);
    saveLocalAudits([{ fullName:'Jan Kowalski', address:'Testowa 1', timestamp:'2026-09-02T10:00:00' }]);
  `);
  // downloadBackup buduje treść pliku - sprawdzamy, co do niego trafia
  const tresc = app(`
    return JSON.stringify({ format:'smart-energy-backup', wersja:2, data:new Date().toISOString(),
                            audyty:getLocalAudits(), szablonyPrzegrod:getSzablony() });
  `);
  const kopia = JSON.parse(tresc);
  sprawdz('kopia zawiera audyty', kopia.audyty.length === 1);
  sprawdz('kopia zawiera szablony przegród', kopia.szablonyPrzegrod.length === 1,
    JSON.stringify(kopia.szablonyPrzegrod));
  sprawdz('szablon w kopii ma swoje warstwy', kopia.szablonyPrzegrod[0].warstwy.length === 1);

  // wczytanie na "czystym tablecie"
  app("localStorage.removeItem('przegrodySzablony'); localStorage.removeItem('auditsDB');");
  const wynik = app(`
    const wczytane = ${tresc};
    const arr = getSzablony();
    const maja = new Set(arr.map(t => String(t.nazwa).toLowerCase()));
    let dodane = 0;
    wczytane.szablonyPrzegrod.forEach(t => {
      if (t && t.nazwa && !maja.has(String(t.nazwa).toLowerCase())) { arr.push(t); dodane++; }
    });
    saveSzablony(arr);
    return { dodane, razem: getSzablony().length };
  `);
  sprawdz('szablony wracają z kopii', wynik.dodane === 1 && wynik.razem === 1, JSON.stringify(wynik));

  // ponowne wczytanie nie dubluje
  const drugi = app(`
    const wczytane = ${tresc};
    const arr = getSzablony();
    const maja = new Set(arr.map(t => String(t.nazwa).toLowerCase()));
    let dodane = 0;
    wczytane.szablonyPrzegrod.forEach(t => {
      if (t && t.nazwa && !maja.has(String(t.nazwa).toLowerCase())) { arr.push(t); dodane++; }
    });
    saveSzablony(arr);
    return { dodane, razem: getSzablony().length };
  `);
  sprawdz('ponowne wczytanie nie dubluje szablonów', drugi.dodane === 0 && drugi.razem === 1);
  app("localStorage.removeItem('przegrodySzablony'); localStorage.removeItem('auditsDB');");
}

// ===================== PROSTOWANIE ŚCIAN =====================
console.log('--- rysowanie ścian pod kątem prostym ---');
nowySzkic();
{
  // istniejąca ściana pionowa; rysujemy poziomą, której koniec wypada blisko
  // węzła tamtej ściany, ale NIE na jej wysokości
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O+5*P, y1:O-3*P, x2:O+5*P, y2:O-0.4*P }];
    zoomLevel = 1;
  `);
  const koniec = app(`
    const P = PIXELS_PER_METER, O = 200;
    // palec: prawie poziomo, ale w pobliżu dolnego końca istniejącej ściany
    return koniecSciany({ x:O, y:O }, { x:O+5*P, y:O-16 });
  `);
  sprawdz('prawie pozioma ściana zostaje wyprostowana', koniec.prosto === true, JSON.stringify(koniec));
  sprawdz('koniec ma tę samą wysokość co początek', Math.abs(koniec.pt.y - 200) < 0.001,
    koniec.pt.y);

  // ten sam ruch, ale węzeł leży dokładnie na wyprostowanej linii - naroznik ma się domknąć
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O+5*P, y1:O, x2:O+5*P, y2:O+3*P }];
  `);
  const domkniete = app(`
    const P = PIXELS_PER_METER, O = 200;
    return koniecSciany({ x:O, y:O }, { x:O+5*P-6, y:O+4 });
  `);
  sprawdz('narożnik nadal się domyka do istniejącego węzła',
    Math.abs(domkniete.pt.x - (200 + 5 * 50)) < 0.001 && Math.abs(domkniete.pt.y - 200) < 0.001,
    JSON.stringify(domkniete.pt));

  // wyraźny skos ma zostać skosem
  const skos = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [];
    return koniecSciany({ x:O, y:O }, { x:O+3*P, y:O+3*P });
  `);
  sprawdz('wyraźny skos nie jest prostowany', skos.prosto === false, JSON.stringify(skos));
  sprawdz('skos zachowuje kierunek', Math.abs(skos.pt.x - 350) < 1 && Math.abs(skos.pt.y - 350) < 1,
    JSON.stringify(skos.pt));

  // pionowa ściana
  const pion = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [];
    return koniecSciany({ x:O, y:O }, { x:O+14, y:O+4*P });
  `);
  sprawdz('prawie pionowa ściana zostaje wyprostowana',
    pion.prosto === true && Math.abs(pion.pt.x - 200) < 0.001, JSON.stringify(pion));
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
