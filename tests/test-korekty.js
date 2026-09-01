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
