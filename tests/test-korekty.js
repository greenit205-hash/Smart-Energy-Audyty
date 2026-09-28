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
  // Szerokość tekstu przybliżamy długością napisu - inaczej nie da się
  // sprawdzić łamania długich opisów.
  const ctx = { canvas: { width: 3000, height: 3000 },
    measureText: (t) => ({ width: String(t || '').length * 8 }),
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
    w.prompt = () => (w.__prompt !== undefined ? w.__prompt : null);
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

  // wyraźny skos ma zostać skosem - ale tylko przy wyłączonej blokadzie kąta prostego
  const skos = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [];
    ortoLock = false;
    const w = koniecSciany({ x:O, y:O }, { x:O+3*P, y:O+3*P });
    ortoLock = true;
    return w;
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



// ===================== KILKA OZNACZEŃ NA JEDNEJ ŚCIANIE =====================
// Na przekroju bywa kilka rodzajów podłogi na gruncie wzdłuż jednej linii.
console.log('--- kilka przegród na jednej ścianie ---');
nowySzkic();
{
  app(`
    sketches[0].kind = 'przekroj';
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
    objects.envTags = {};
    envTagSelectedKey = getSegKey(O, O, O+6*P, O);
    envTagEditKey = null;
    assignEnvTag('PG');
  `);
  sprawdz('pierwsze oznaczenie ma zwykły klucz odcinka',
    app("return Object.keys(objects.envTags).length;") === 1);
  const pierwszy = app("return Object.keys(objects.envTags)[0];");
  sprawdz('klucz pierwszego oznaczenia jest bez sufiksu', pierwszy.indexOf('#') === -1, pierwszy);

  // drugie oznaczenie na tej samej ścianie
  app(`
    const P = PIXELS_PER_METER, O = 200;
    envTagSelectedKey = getSegKey(O, O, O+6*P, O);
    envTagEditKey = null;
    assignEnvTag('PG');
  `);
  const klucze = app("return Object.keys(objects.envTags);");
  sprawdz('da się dodać drugie oznaczenie do tej samej ściany', klucze.length === 2, klucze.join(', '));
  sprawdz('drugie oznaczenie dostaje sufiks', klucze.some(k => k.indexOf('#2') !== -1), klucze.join(', '));

  const tagi = app("return Object.values(objects.envTags).map(t => t.cat + t.num).sort();");
  sprawdz('oba oznaczenia mają różne numery', tagi[0] !== tagi[1], tagi.join(', '));
  sprawdz('oba są podłogami na gruncie', tagi.every(t => t.startsWith('PG')), tagi.join(', '));

  // trzecie, innego rodzaju
  app(`
    const P = PIXELS_PER_METER, O = 200;
    envTagSelectedKey = getSegKey(O, O, O+6*P, O);
    envTagEditKey = null;
    assignEnvTag('S');
  `);
  sprawdz('trzecie oznaczenie też wchodzi', app("return Object.keys(objects.envTags).length;") === 3);

  // wszystkie trafiają do sekcji 3
  app("renderEnvelopeFields();");
  const pola = app("return Object.values(objects.envTags).map(t => t.cat + t.num).filter(l => !!document.querySelector('[name=\"' + l + '_desc\"]')).length;");
  sprawdz('każde oznaczenie dostaje swoje pola w sekcji 3', pola === 3, pola);

  // żadne nie jest uznane za osierocone
  sprawdz('oznaczenia z sufiksem nie są zgłaszane jako osierocone',
    app("return envTagOrphans().length;") === 0, JSON.stringify(app("return envTagOrphans();")));

  // kasowanie jednego zostawia pozostałe
  const doUsuniecia = app("return Object.keys(objects.envTags).filter(k => k.indexOf('#2') !== -1)[0];");
  app(`removeEnvTagByKey(0, ${JSON.stringify(doUsuniecia)});`);
  sprawdz('kasowanie jednego oznaczenia zostawia pozostałe',
    app("return Object.keys(objects.envTags).length;") === 2);

  // dodane po kasowaniu odzyskuje wolny klucz
  app(`
    const P = PIXELS_PER_METER, O = 200;
    envTagSelectedKey = getSegKey(O, O, O+6*P, O);
    envTagEditKey = null;
    assignEnvTag('D');
  `);
  sprawdz('po skasowaniu wolny klucz wraca do użycia',
    app("return Object.keys(objects.envTags).length;") === 3);

  // odnalezienie oznaczenia na rysunku działa też dla klucza z sufiksem
  const zSufiksem = app("return Object.keys(objects.envTags).find(k => k.indexOf('#') !== -1);");
  sprawdz('oznaczenie z sufiksem da się odnaleźć na rysunku',
    app(`return !!envTagMidpoint(sketches[0], ${JSON.stringify(zSufiksem)});`) === true);
}

// ===================== KOMENTARZ ZE STRZAŁKĄ =====================
console.log('--- komentarz ze strzałką ---');
nowySzkic();
{
  const d = dom.window.document;
  app(`
    currentMode = 'callout';
    openCalloutDialog({ x: 400, y: 300 });
    document.getElementById('calloutInput').value = 'ślady zawilgocenia';
    saveCallout();
  `);
  const lista = app("return objects.callouts;");
  sprawdz('komentarz trafia na szkic', lista.length === 1, lista.length);
  sprawdz('grot strzałki stoi we wskazanym punkcie',
    lista[0].tx === 400 && lista[0].ty === 300, JSON.stringify(lista[0]));
  sprawdz('chmurka stoi obok, żeby nie zasłaniać',
    lista[0].x !== lista[0].tx || lista[0].y !== lista[0].ty);
  sprawdz('treść komentarza jest zapisana', lista[0].text === 'ślady zawilgocenia');

  // trafianie palcem w chmurkę i w grot
  sprawdz('dotknięcie chmurki ją znajduje',
    app("return calloutHit({ x: objects.callouts[0].x, y: objects.callouts[0].y });") === 0);
  sprawdz('dotknięcie grotu znajduje strzałkę',
    app("return calloutTipHit({ x: 400, y: 300 });") === 0);
  sprawdz('dotknięcie z boku nie trafia w nic',
    app("return calloutHit({ x: 40, y: 900 });") === -1);

  // przesunięcie grotu w inne miejsce
  app("objects.callouts[0].tx = 250; objects.callouts[0].ty = 500;");
  sprawdz('grot da się przestawić',
    app("return objects.callouts[0].tx;") === 250);

  // poprawianie treści
  app(`
    openCalloutForEdit(0);
    document.getElementById('calloutInput').value = 'zawilgocenie — sprawdzić izolację';
    saveCallout();
  `);
  const po = app("return objects.callouts;");
  sprawdz('poprawka nie tworzy drugiego komentarza', po.length === 1, po.length);
  sprawdz('treść została poprawiona', po[0].text.includes('sprawdzić izolację'), po[0].text);
  sprawdz('grot został na przestawionym miejscu', po[0].tx === 250 && po[0].ty === 500);

  // wielolinijkowy komentarz
  app(`
    openCalloutDialog({ x: 100, y: 100 });
    document.getElementById('calloutInput').value = ['pierwsza linia','druga linia'].join(String.fromCharCode(10));
    saveCallout();
  `);
  sprawdz('komentarz może mieć kilka linii',
    app("return objects.callouts[1].text.split(String.fromCharCode(10)).length;") === 2);

  // pusta treść usuwa komentarz
  app(`
    openCalloutForEdit(1);
    document.getElementById('calloutInput').value = '  ';
    saveCallout();
  `);
  sprawdz('wyczyszczenie treści usuwa komentarz', app("return objects.callouts.length;") === 1);

  // usuwanie z okna i gumką
  app("openCalloutForEdit(0); deleteCalloutFromDialog();");
  sprawdz('komentarz da się usunąć z okna', app("return objects.callouts.length;") === 0);

  // rysowanie nie wywraca się na komentarzach
  app(`
    objects.callouts = [{ tx:300, ty:300, x:400, y:250, text:'test' }];
    renderCanvas();
  `);
  sprawdz('rysowanie z komentarzem nie wywraca płótna',
    app("return objects.callouts.length;") === 1);

  // szkic bez pola callouts (stary zapis) nie może psuć rysowania
  app("delete objects.callouts; renderCanvas();");
  sprawdz('stary szkic bez komentarzy rysuje się normalnie',
    app("return objects.callouts === undefined;") === true);
}



// ===================== OPISY, KOLORY, PRZESZKODY =====================
console.log('--- czytelność opisów i kolory ---');
nowySzkic();
{
  const ctx = app("return canvas.getContext('2d');") ? null : null;

  // łamanie długiego opisu na linie
  const linie = app(`
    const c = canvas.getContext('2d');
    c.font = 'bold 20px Arial';
    return lamTekst(c, 'bardzo długi opis przegrody który nie mieści się w jednej linii na ekranie tabletu', MAX_TEKST_PX);
  `);
  sprawdz('długi opis jest łamany na kilka linii', linie.length > 1, linie.length);
  sprawdz('łamanie nie gubi treści',
    linie.join(' ').includes('nie mieści się') && linie.join(' ').includes('tabletu'), linie.join(' | '));

  const zRecznymi = app(`
    const c = canvas.getContext('2d');
    c.font = 'bold 20px Arial';
    return lamTekst(c, ['pierwsza','druga'].join(String.fromCharCode(10)), MAX_TEKST_PX);
  `);
  sprawdz('ręczne przejścia do nowej linii są respektowane', zRecznymi.length === 2, zRecznymi.join(' | '));

  const krotki = app(`
    const c = canvas.getContext('2d');
    c.font = 'bold 20px Arial';
    return lamTekst(c, 'krótki', MAX_TEKST_PX);
  `);
  sprawdz('krótki opis zostaje w jednej linii', krotki.length === 1);

  // odsuwanie nachodzących opisów
  const wolne = app(`
    dimLabelRects = [{ x: 90, y: 90, w: 100, h: 40 }];
    return findFreeLabelSpot(140, 110, 100, 40, 0, 1);
  `);
  sprawdz('opis wpadający na zajęte miejsce jest odsuwany',
    wolne && Math.abs(wolne.y - 110) > 1, JSON.stringify(wolne));
  const bezKolizji = app(`
    dimLabelRects = [];
    return findFreeLabelSpot(500, 500, 100, 40, 0, 1);
  `);
  sprawdz('gdy jest wolno, opis zostaje na swoim miejscu',
    bezKolizji && bezKolizji.x === 500 && bezKolizji.y === 500, JSON.stringify(bezKolizji));

  // kolor ściany
  app("setWallColor('#dc3545', null);");
  sprawdz('kolor ściany da się ustawić', app("return currentWallColor;") === '#dc3545');
  app(`
    objects.lines = [];
    startPos = { x:200, y:200 }; currentPos = { x:400, y:200 };
    drawing = true; currentMode = 'line';
    stopDraw({ pointerType:'mouse', isPrimary:true });
  `);
  sprawdz('narysowana ściana zapamiętuje kolor',
    app("return objects.lines[0] && objects.lines[0].kolor;") === '#dc3545',
    app("return JSON.stringify(objects.lines[0]);"));
  app("setWallColor('#212529', null);");

  // przeszkoda jako obszar kreskowany z kolorem
  app("setHatchColor('#6f42c1', null);");
  sprawdz('kolor przeszkody da się ustawić', app("return currentHatchColor;") === '#6f42c1');
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    objects.lines = []; objects.hatches = [];
    L(0,0, 2,0); L(2,0, 2,2); L(2,2, 0,2); L(0,2, 0,0);
    window.__prompt = 'Komin';
    handleHatchClick({ x:O+1*P, y:O+1*P });
    window.__prompt = undefined;
  `);
  const przeszkody = app("return objects.hatches;");
  sprawdz('przeszkoda zostaje dodana', przeszkody.length === 1, przeszkody.length);
  sprawdz('przeszkoda ma własny opis', przeszkody[0].label === 'Komin', przeszkody[0].label);
  sprawdz('przeszkoda zapamiętuje kolor', przeszkody[0].kolor === '#6f42c1', przeszkody[0].kolor);
  sprawdz('przeszkoda ma obrys', (przeszkody[0].polygon || []).length >= 3);

  // rysowanie z przeszkodą i kolorową ścianą nie wywraca płótna
  app("renderCanvas();");
  sprawdz('rysunek z przeszkodą się renderuje', app("return objects.hatches.length;") === 1);

  // narzędzie jest dostępne w pasku
  sprawdz('jest przycisk narzędzia przeszkody',
    !!dom.window.document.getElementById('btnModeHatch'));
  sprawdz('paleta kolorów ściany istnieje',
    !!dom.window.document.getElementById('wallColors'));
  sprawdz('paleta kolorów przeszkody istnieje',
    !!dom.window.document.getElementById('hatchColors'));

  // stare szkice bez kolorów muszą działać
  app(`
    objects.lines = [{ x1:100, y1:100, x2:300, y2:100 }];
    objects.hatches = [{ id:1, polygon:[{x:100,y:100},{x:200,y:100},{x:200,y:200}], label:'Skos' }];
    renderCanvas();
  `);
  sprawdz('szkic bez zapisanych kolorów rysuje się normalnie',
    app("return objects.lines[0].kolor === undefined && objects.hatches[0].kolor === undefined;") === true);
}

// Raport nie może ucinać długich opisów
console.log('--- długie opisy w raporcie ---');
{
  const dlugi = 'Bardzo długi opis przegrody, który wcześniej był ucinany w tabeli raportu i nie dawało się go przeczytać do końca.';
  const raport = app(`return buildReportHtml({ fullName:'X', auditorNotes:${JSON.stringify(dlugi)} }, [], []);`);
  sprawdz('raport zawiera cały długi opis', raport.includes('nie dawało się go przeczytać do końca'));
  sprawdz('tabele raportu zawijają tekst', raport.includes('overflow-wrap: break-word'));
  // Kluczowe: NIE wolno łamać słów w środku - nazwy materiałów muszą zostać całe
  sprawdz('raport nie łamie słów litera po literze', !raport.includes('overflow-wrap: anywhere'));
  sprawdz('kolumny raportu dopasowują się do treści', raport.includes('table-layout: auto'));

  const karta = app(`return buildObjectCardHtml({ fullName:'X', preferences:${JSON.stringify(dlugi)} }, [], []);`);
  sprawdz('karta obiektu też zawija tekst', karta.includes('overflow-wrap:break-word'));
  sprawdz('karta nie łamie słów litera po literze', !karta.includes('overflow-wrap:anywhere'));
  sprawdz('grubości warstw zostają w jednej linii', karta.includes('table.warstwy td.num'));
  // tabela przegród obok rysunku pojawia się tylko przy oznaczonych przegrodach
  const kartaZPrzegroda = app(`
    sketches = [{ id:1, name:'przekrój', kind:'przekroj', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 envTags:{ a:{cat:'SZ',num:1} }, noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects;
    const audit = { fullName:'X', preferences:'-',
      sketchesJSON: JSON.stringify(sketches),
      SZ1_layers: JSON.stringify([{ mat:'Mur z betonu komórkowego na zaprawie cementowo-wapiennej', gr:'24.0' }]),
      SZ1_przegroda: JSON.stringify({ typ:'SC_ZEW' }) };
    return buildObjectCardHtml(audit, [{ sketchIndex:0, dataUrl:'data:,' }], true);
  `);
  sprawdz('tabela przegród ma ustalone szerokości kolumn', kartaZPrzegroda.includes('<colgroup>'));
  sprawdz('długa nazwa materiału trafia do tabeli w całości',
    kartaZPrzegroda.includes('Mur z betonu komórkowego na zaprawie cementowo-wapiennej'));
}


// ===================== ODLEGŁOŚĆ OD NAROŻNIKA =====================
// Podpowiedź musi trzymać się rogu, od którego zacząłeś jechać palcem.
// Wcześniej przeskakiwała na drugi róg po minięciu połowy ściany.
console.log('--- odległość od narożnika ---');
nowySzkic();
{
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
    currentMode = 'line'; zoomLevel = 1; wallHoverKotwica = null;
  `);
  const przy = m => app(`
    const P = PIXELS_PER_METER, O = 200;
    updateWallHover({ x: O + ${m}*P, y: O });
    return wallHover ? { dist: +wallHover.dist.toFixed(2), odA: wallHover.odA } : null;
  `);

  // wjazd od lewej strony
  let r = przy(1);
  sprawdz('start przy lewym rogu mierzy od lewego', r && r.odA === true, JSON.stringify(r));
  sprawdz('przy 1 m od lewego pokazuje 1,00', r && Math.abs(r.dist - 1) < 0.01, r && r.dist);

  r = przy(4);
  sprawdz('po minięciu połowy nadal mierzy od lewego rogu', r && r.odA === true, JSON.stringify(r));
  sprawdz('przy 4 m od lewego pokazuje 4,00 (nie 2,00)',
    r && Math.abs(r.dist - 4) < 0.01, r && r.dist);

  r = przy(5.5);
  sprawdz('przy końcu ściany nadal liczy od lewego', r && Math.abs(r.dist - 5.5) < 0.01, r && r.dist);

  r = przy(5.95);
  sprawdz('tuż przy prawym rogu nadal liczy od lewego (bez przeskoku)',
    r && r.odA === true && Math.abs(r.dist - 5.95) < 0.01, JSON.stringify(r));

  // żeby mierzyć od drugiej strony, schodzimy ze ściany i wracamy przy prawym rogu
  app("updateWallHover({ x: 50, y: 900 });");
  r = przy(5.8);
  sprawdz('po zejściu i najechaniu przy prawym rogu mierzy od prawego',
    r && r.odA === false && Math.abs(r.dist - 0.2) < 0.01, JSON.stringify(r));
  r = przy(2);
  sprawdz('i trzyma prawy róg aż do końca ściany',
    r && r.odA === false && Math.abs(r.dist - 4) < 0.01, JSON.stringify(r));

  // zejście ze ściany kasuje zapamiętany róg
  app("updateWallHover({ x: 50, y: 900 });");
  sprawdz('zejście ze ściany kasuje zapamiętany róg',
    app("return wallHoverKotwica;") === null);
  r = przy(1);
  sprawdz('po ponownym najechaniu znowu bierze bliższy róg', r && r.odA === true, JSON.stringify(r));
}

// ===================== SUMOWANIE POMIARÓW Z DALMIERZA =====================
console.log('--- sumowanie pomiarów ---');
{
  app("setDistoSuma(true);");
  sprawdz('tryb sumowania da się włączyć', app("return distoSumaWl;") === true);
  app("distoDeliverMeasurement(1.0); distoDeliverMeasurement(1.0); distoDeliverMeasurement(1.0);");
  sprawdz('trzy pomiary po 1 m dają sumę 3 m',
    Math.abs(app("return distoSumaWartosc();") - 3) < 0.001, app("return distoSumaWartosc();"));
  sprawdz('składniki są zapamiętane osobno', app("return distoSkladniki.length;") === 3);

  app("distoCofnijSkladnik();");
  sprawdz('cofnięcie odcinka zmniejsza sumę',
    Math.abs(app("return distoSumaWartosc();") - 2) < 0.001);

  // w trybie sumowania pojedynczy odczyt NIE trafia do pola
  app(`
    window.__wpisane = null;
    distoWpiszDoPolaOrg = distoWpiszDoPola;
    distoWpiszDoPola = function (m) { window.__wpisane = m; };
    distoDeliverMeasurement(0.5);
  `);
  sprawdz('pojedynczy pomiar nie wchodzi do pola, tylko do sumy',
    app("return window.__wpisane;") === null);

  app("distoZatwierdzSume();");
  sprawdz('zatwierdzenie wpisuje sumę',
    Math.abs(app("return window.__wpisane;") - 2.5) < 0.001, app("return window.__wpisane;"));
  sprawdz('po zatwierdzeniu suma jest czyszczona', app("return distoSkladniki.length;") === 0);

  // wyłączenie trybu wraca do zachowania jak dotąd
  app("setDistoSuma(false); window.__wpisane = null; distoDeliverMeasurement(2.2);");
  sprawdz('bez sumowania pomiar idzie wprost do pola',
    Math.abs(app("return window.__wpisane;") - 2.2) < 0.001);
  app("distoWpiszDoPola = distoWpiszDoPolaOrg;");
}

// ===================== OTWORY =====================
console.log('--- otwory: typy, wymiary, odległość od rogu ---');
nowySzkic();
{
  const d = dom.window.document;
  const typy = [...d.querySelectorAll('#openingTypeSelect option')].map(o => o.value);
  sprawdz('jest typ drzwi wewnętrznych', typy.includes('DW'), typy.join(', '));
  sprawdz('jest typ otworu budowlanego', typy.includes('OB'), typy.join(', '));
  sprawdz('otwór budowlany ma własną kategorię w zestawieniach',
    app("return openingCatOf('OB1').pref;") === 'OB');
  sprawdz('DZ nie jest mylone z DW',
    app("return openingCatOf('DW2').pref;") === 'DW');

  sprawdz('jest pole odległości od narożnika', !!d.getElementById('openingOffset'));
  sprawdz('da się wybrać, od którego narożnika', !!d.getElementById('openingOffsetSide'));

  // wstawienie otworu 90 cm w odległości 100 cm od lewego rogu ściany 6 m
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
    objects.openings = [];
    editingOpeningIndex = -1;
    pendingOpeningSeg = { a:{x:O,y:O}, b:{x:O+6*P,y:O} };
    pendingOpeningPos = { x:O+3*P, y:O };
    pendingOpeningAngle = 0;
    document.getElementById('openingIdInput').value = 'DW1';
    document.getElementById('openingWidth').value = '90';
    document.getElementById('openingHeight').value = '200';
    document.getElementById('openingOffset').value = '100';
    document.getElementById('openingOffsetSide').value = 'A';
    addOpeningToCanvas();
  `);
  const op = app("return objects.openings[0];");
  sprawdz('otwór został wstawiony', !!op);
  // środek otworu = 100 cm + połowa z 90 cm = 145 cm od lewego rogu
  sprawdz('otwór stoi 1,45 m od lewego rogu (100 cm + pół szerokości)',
    op && Math.abs((op.x - 200) / 50 - 1.45) < 0.01, op && ((op.x - 200) / 50).toFixed(3));
  sprawdz('odległość od rogu jest zapamiętana', op && op.odlOdRogu === 100, op && op.odlOdRogu);
  sprawdz('zapamiętano, od którego rogu', op && op.stronaRogu === 'A');

  // to samo od prawego rogu
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.openings = [];
    editingOpeningIndex = -1;
    pendingOpeningSeg = { a:{x:O,y:O}, b:{x:O+6*P,y:O} };
    pendingOpeningPos = { x:O+3*P, y:O }; pendingOpeningAngle = 0;
    document.getElementById('openingIdInput').value = 'DW2';
    document.getElementById('openingWidth').value = '90';
    document.getElementById('openingHeight').value = '200';
    document.getElementById('openingOffset').value = '100';
    document.getElementById('openingOffsetSide').value = 'B';
    addOpeningToCanvas();
  `);
  const op2 = app("return objects.openings[0];");
  sprawdz('od prawego rogu liczone jest lustrzanie',
    op2 && Math.abs((op2.x - 200) / 50 - (6 - 1.45)) < 0.01, op2 && ((op2.x - 200) / 50).toFixed(3));

  // otwór budowlany nie wymaga wysokości
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.openings = [];
    editingOpeningIndex = -1;
    pendingOpeningSeg = { a:{x:O,y:O}, b:{x:O+6*P,y:O} };
    pendingOpeningPos = { x:O+3*P, y:O }; pendingOpeningAngle = 0;
    document.getElementById('openingIdInput').value = 'OB1';
    document.getElementById('openingWidth').value = '120';
    document.getElementById('openingHeight').value = '';
    document.getElementById('openingOffset').value = '';
    addOpeningToCanvas();
  `);
  sprawdz('otwór budowlany wstawia się bez podawania wysokości',
    app("return objects.openings.length;") === 1, app("return objects.openings.length;"));
  sprawdz('otwór budowlany ma szerokość', app("return objects.openings[0].width;") === 120);

  // rysunek z otworami się renderuje
  app("renderCanvas();");
  sprawdz('szkic z otworem budowlanym się rysuje', app("return objects.openings.length;") === 1);
}

console.log('--- automatyczna kopia na Dysk ---');
// ===================== AUTOMATYCZNA KOPIA NA DYSK =====================
async function testyKopii() {
  const _ = 0;
  const d = dom.window.document;
  // podstawiamy fetch, żeby nie ruszać sieci i sprawdzić, co naprawdę leci
  app(`
    window.__wyslane = [];
    window.fetch = function (url, opts) {
      window.__wyslane.push({ url: url, body: opts && opts.body });
      return Promise.resolve({ ok: true, text: () => Promise.resolve('SUCCESS|kopia.json') });
    };
    localStorage.setItem('apiUrl', 'https://example.org/exec');
    localStorage.removeItem('ostatniaKopiaDysk');
    localStorage.removeItem('autoKopiaWlaczona');
    saveLocalAudits([{ fullName:'Jan Kowalski', address:'Testowa 1' }]);
    saveSzablony([{ nazwa:'Ściana testowa', warstwy:[{mat:'Cegła pełna zwykła',gr:'25'}], warstwyB:[] }]);
  `);

  sprawdz('kopia automatyczna jest domyślnie włączona', app("return autoKopiaWlaczona();") === true);
  sprawdz('na starcie nie ma jeszcze żadnej kopii', app("return ostatniaKopia();") === null);

  // treść kopii
  const tresc = JSON.parse(app("return trescKopii();"));
  sprawdz('kopia zawiera audyty', tresc.audyty.length === 1);
  sprawdz('kopia zawiera szablony przegród', tresc.szablonyPrzegrod.length === 1);
  sprawdz('kopia niesie informację o roli tabletu', !!tresc.rola, tresc.rola);
  sprawdz('kopia ma znacznik formatu', tresc.format === 'smart-energy-backup');

  // pierwsza próba automatyczna - powinna wysłać
  await app("return autoKopiaJesliPora();");
  const wyslane = app("return window.__wyslane;");
  sprawdz('kopia poleciała na Dysk', wyslane.length === 1, wyslane.length);
  if (wyslane.length) {
    const paczka = JSON.parse(wyslane[0].body);
    sprawdz('paczka ma akcję "backup"', paczka.action === 'backup', paczka.action);
    sprawdz('paczka niesie treść kopii', !!paczka.payload && paczka.payload.includes('Jan Kowalski'));
  }
  sprawdz('data ostatniej kopii została zapamiętana', app("return ostatniaKopia() !== null;") === true);

  // druga próba od razu po pierwszej - odstęp nie minął, nic nie wysyłamy
  await app("return autoKopiaJesliPora();");
  sprawdz('przed upływem odstępu kopia się nie powtarza',
    app("return window.__wyslane.length;") === 1);

  // po upływie odstępu - znowu wysyła
  app(`
    const dawno = new Date(Date.now() - (BACKUP_ODSTEP_H + 1) * 3600000);
    localStorage.setItem('ostatniaKopiaDysk', dawno.toISOString());
  `);
  await app("return autoKopiaJesliPora();");
  sprawdz('po upływie odstępu kopia leci ponownie',
    app("return window.__wyslane.length;") === 2);

  // wyłącznik
  app(`
    ustawAutoKopie(false);
    localStorage.setItem('ostatniaKopiaDysk', new Date(Date.now() - 48 * 3600000).toISOString());
  `);
  await app("return autoKopiaJesliPora();");
  sprawdz('wyłączona kopia automatyczna nic nie wysyła',
    app("return window.__wyslane.length;") === 2);
  sprawdz('przełącznik zapamiętuje wyłączenie', app("return autoKopiaWlaczona();") === false);
  app("ustawAutoKopie(true);");

  // brak adresu Dysku = nie próbujemy
  app(`
    localStorage.removeItem('apiUrl');
    localStorage.setItem('ostatniaKopiaDysk', new Date(Date.now() - 48 * 3600000).toISOString());
  `);
  await app("return autoKopiaJesliPora();");
  sprawdz('bez ustawionego Dysku kopia nie jest wysyłana',
    app("return window.__wyslane.length;") === 2);
  app("localStorage.setItem('apiUrl', 'https://example.org/exec');");

  // brak internetu = odkładamy na później, bez komunikatów
  app(`
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    localStorage.setItem('ostatniaKopiaDysk', new Date(Date.now() - 48 * 3600000).toISOString());
  `);
  await app("return autoKopiaJesliPora();");
  sprawdz('bez internetu kopia nie jest wysyłana',
    app("return window.__wyslane.length;") === 2);
  app("Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });");

  // pasek stanu na pulpicie
  app("renderBackupStatus();");
  const pasek = d.getElementById('backupStatus').innerHTML;
  sprawdz('pulpit pokazuje datę ostatniej kopii', pasek.includes('Kopia na Dysku'), pasek.slice(0, 80));
  sprawdz('pulpit ma przycisk ręcznej wysyłki', pasek.includes('wyslijKopieNaDysk'));
  sprawdz('pulpit ma przełącznik automatu', pasek.includes('autoKopiaSwitch'));

  // stara kopia = ostrzeżenie na czerwono
  app(`
    localStorage.setItem('ostatniaKopiaDysk', new Date(Date.now() - 5 * 86400000).toISOString());
    renderBackupStatus();
  `);
  sprawdz('kopia sprzed 5 dni jest zaznaczona na czerwono',
    d.getElementById('backupStatus').innerHTML.includes('text-danger'));

  // brak kopii w ogóle też
  app("localStorage.removeItem('ostatniaKopiaDysk'); renderBackupStatus();");
  sprawdz('brak kopii jest zaznaczony na czerwono',
    d.getElementById('backupStatus').innerHTML.includes('text-danger') &&
    d.getElementById('backupStatus').innerHTML.includes('jeszcze nie było'));

  app("localStorage.removeItem('auditsDB'); localStorage.removeItem('przegrodySzablony'); localStorage.removeItem('apiUrl');");
}


// ===================== BLOKADA KATA PROSTEGO =====================
// "chce narysowac linie pod katem prostym a aplikacja caly czas ustawia ja pod katem"
console.log('--- kąt prosty przy rysowaniu ściany ---');
{
  sprawdz('pasek narzędzi ma przełącznik kąta prostego',
    !!doc.getElementById('btnOrto'));

  // domyślnie włączony
  app("ortoLock = true; guideLines = []; zoomLevel = 1;");

  // 1. Palec poszedł skośnie (30 st.) - ściana i tak ma być pozioma
  nowySzkic();
  let r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:400,y:315});");
  sprawdz('ruch pod 30° daje ścianę dokładnie poziomą', r.pt.y === 200, JSON.stringify(r.pt));
  sprawdz('długość idzie za palcem w poziomie', r.pt.x === 400, JSON.stringify(r.pt));

  // 2. Przewaga pionu - ściana pionowa
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:290,y:500});");
  sprawdz('ruch bardziej w pionie daje ścianę dokładnie pionową', r.pt.x === 200, JSON.stringify(r.pt));

  // 3. Kiedyś psuło: istniejąca ściana w pobliżu końca (połączenie T).
  //    findSnapPoint zwracał punkt leżący nawet 30 px od osi i linia znów była ukośna.
  nowySzkic();
  app("objects.lines.push({x1:420, y1:100, x2:420, y2:600});");   // pionowa ściana
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:405,y:210});");
  sprawdz('koniec na istniejącej ścianie nie łamie poziomu', r.pt.y === 200, JSON.stringify(r.pt));
  sprawdz('koniec dociąga się do tej ściany', r.pt.x === 420, JSON.stringify(r.pt));

  // 3b. Ukośna ściana obok - nie wolno jej pociągnąć końca ze osi
  nowySzkic();
  app("objects.lines.push({x1:380, y1:120, x2:460, y2:280});");
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:410,y:203});");
  sprawdz('ukośna ściana obok nie przekrzywia rysowanej', r.pt.y === 200, JSON.stringify(r.pt));

  // 4. Kiedyś psuło: prowadnica wyrównująca przesuwała TĘ współrzędną,
  //    która trzyma linię prosto.
  nowySzkic();
  app("objects.lines.push({x1:600, y1:195, x2:700, y2:195});");   // węzeł o y=195, 5 px od osi
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:450,y:206});");
  sprawdz('prowadnica nie rusza osi ściany poziomej', r.pt.y === 200, JSON.stringify(r.pt));

  // 5. Domykanie narożnika nadal działa
  nowySzkic();
  app("objects.lines.push({x1:450, y1:203, x2:450, y2:400});");
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:447,y:201});");
  sprawdz('narożnik domyka się do istniejącego węzła',
    Math.hypot(r.pt.x - 450, r.pt.y - 203) < 1 || (r.pt.x === 450 && r.pt.y === 200),
    JSON.stringify(r.pt));

  // 6. Wyłączona blokada = dawne zachowanie, ukos zostaje ukosem
  nowySzkic();
  app("ortoLock = false;");
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:400,y:400});");
  sprawdz('po wyłączeniu blokady ukos 45° zostaje ukosem',
    r.pt.x === 400 && r.pt.y === 400, JSON.stringify(r.pt));
  r = app("guideLines=[]; return koniecSciany({x:200,y:200}, {x:400,y:205});");
  sprawdz('po wyłączeniu blokady mały odchył nadal się prostuje', r.pt.y === 200, JSON.stringify(r.pt));

  // 7. Przełącznik zapamiętuje ustawienie
  app("ortoLock = true; localStorage.removeItem('se_orto'); toggleOrto();");
  sprawdz('wyłączenie zapisuje się w pamięci urządzenia',
    dom.window.localStorage.getItem('se_orto') === '0');
  sprawdz('etykieta przycisku pokazuje WYŁ',
    doc.getElementById('btnOrto').textContent.includes('WYŁ'),
    doc.getElementById('btnOrto').textContent);
  app("toggleOrto();");
  sprawdz('ponowne włączenie zapisuje się w pamięci urządzenia',
    dom.window.localStorage.getItem('se_orto') === '1');
  sprawdz('etykieta przycisku wraca na WŁ',
    doc.getElementById('btnOrto').textContent.includes('WŁ'));

  app("ortoLock = true; localStorage.removeItem('se_orto');");
}

function podsumowanie() {
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
}

testyKopii().then(podsumowanie).catch(e => {
  console.log('BŁĄD w testach kopii:', e.message);
  dom.window.close();
  process.exit(1);
});
