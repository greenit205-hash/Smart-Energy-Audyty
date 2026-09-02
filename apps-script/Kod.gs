// =====================================================================
// SMART ENERGY - AUDYTY | Backend Google Apps Script
// Wersja 4.0
// W folderze klienta powstaja:
//   1. Raport w Dokumentach Google (edytowalny, z logo i podpisem)
//   2. Ten sam raport jako PDF (wersja dla klienta)
//   3. Karta obiektu .html (wizualne podsumowanie z kafelkami)
//   4. Szkice PNG (po jednym na zakladke) + podpis klienta PNG
//   5. dane-audytu.json (kopia surowych danych)
// Dodatkowo: sformatowany wiersz w arkuszu-rejestrze z linkami do plikow.
// =====================================================================

const SHEET_ID = 'TU_WKLEJ_ID_ARKUSZA';
const PARENT_FOLDER_ID = 'TU_WKLEJ_ID_FOLDERU';

const BRAND_DARK = '#2c3e50';
const BRAND_GOLD = '#d4af37';

const ENVELOPES = [
  { id: 'SZ', name: 'Sciany zewnetrzne' },
  { id: 'S',  name: 'Stropy' },
  { id: 'PG', name: 'Podlogi' },
  { id: 'D',  name: 'Dachy' },
  { id: 'O',  name: 'Okna' },
  { id: 'DZ', name: 'Drzwi' }
];

// Folder na paczki wymieniane miedzy tabletami (audytor <-> pomocnik)
const EXCHANGE_FOLDER_NAME = 'WYMIANA (tablety)';

function getExchangeFolder() {
  const parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const it = parent.getFoldersByName(EXCHANGE_FOLDER_NAME);
  return it.hasNext() ? it.next() : parent.createFolder(EXCHANGE_FOLDER_NAME);
}

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  if (p.action === 'pull') return textOut(JSON.stringify(pullParts(p.code)));
  return textOut('Smart Energy API dziala. Wersja 5.0. Uzyj metody POST z aplikacji.');
}

// Pomocnik wysyla swoja czesc inwentaryzacji pod wspolnym kodem zlecenia
function pushPart(data) {
  const code = String(data.code || '').trim().toUpperCase();
  if (!code) return 'ERROR: brak kodu zlecenia';
  const device = sanitizeName(String(data.deviceId || 'tablet'));
  const folder = getExchangeFolder();
  const name = 'part_' + code + '_' + device + '.json';

  // nadpisujemy poprzednia paczke z tego samego tabletu
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);

  const body = JSON.stringify({
    code: code, deviceId: device, role: str(data.role),
    deviceName: str(data.deviceName),
    savedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    payload: data.payload || {}
  });
  folder.createFile(Utilities.newBlob(body, 'application/json', name));
  return 'SUCCESS';
}

// Audytor pobiera wszystkie paczki dla danego kodu zlecenia
function pullParts(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'brak kodu zlecenia' };
  const folder = getExchangeFolder();
  const out = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const n = f.getName();
    if (n.indexOf('part_' + c + '_') !== 0) continue;
    try {
      const obj = JSON.parse(f.getBlob().getDataAsString());
      obj.fileId = f.getId();
      out.push(obj);
    } catch (err) { Logger.log('pull: ' + err); }
  }
  return { ok: true, parts: out };
}

// Po scaleniu audytor potwierdza odbior - paczki ida do kosza
function ackParts(data) {
  (data.fileIds || []).forEach(function (id) {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (err) { Logger.log('ack: ' + err); }
  });
  return 'SUCCESS';
}

// ---------------------------------------------------------------------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const data = JSON.parse(e.postData.contents);

    // Wymiana danych miedzy tabletami - obsluga przed zwyklym eksportem raportu
    if (data.action === 'pushPart') return textOut(pushPart(data));
    if (data.action === 'ackParts') return textOut(ackParts(data));

    // 0. ZABEZPIECZENIE PRZED DUPLIKATAMI
    // Aplikacja przy problemie z odczytem odpowiedzi ponawia wysylke "w ciemno"
    // (tryb no-cors). Bez tego kroku powstalby DRUGI folder klienta, drugi raport
    // i drugi wiersz w rejestrze. Ten sam exportId = ten sam wynik.
    const props = PropertiesService.getScriptProperties();
    const exportId = str(data.exportId).trim();
    if (exportId) {
      const prev = props.getProperty('exp_' + exportId);
      if (prev) return textOut('SUCCESS|' + prev);
    }

    // 1. FOLDER KLIENTA
    const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm');
    const clientName = str(data.fullName).trim() || 'Klient bez nazwy';
    const folder = parentFolder.createFolder(sanitizeName(clientName) + ' (' + stamp + ')');
    const folderUrl = folder.getUrl();

    // 2. SZKICE PNG
    const imageBlobs = [];
    (data.sketchImages || []).forEach(function (img, i) {
      try {
        const blob = dataUrlToBlob(img.dataUrl, sanitizeName(img.name || ('Szkic ' + (i + 1))) + '.png');
        folder.createFile(blob);
        imageBlobs.push(blob);
      } catch (err) {
        Logger.log('Szkic ' + i + ': ' + err);
        imageBlobs.push(null);
      }
    });

    // 3. KOPIA SUROWYCH DANYCH
    const backup = JSON.parse(JSON.stringify(data));
    delete backup.sketchImages; delete backup.cardHtml; delete backup.logo;
    folder.createFile(Utilities.newBlob(JSON.stringify(backup, null, 2), 'application/json', 'dane-audytu.json'));

    // 4. KARTA OBIEKTU (HTML) - szablon przychodzi z aplikacji, tu wstawiamy obrazy
    let cardUrl = '';
    let cardHtmlPelna = '';   // karta z podstawionymi rysunkami - z niej robimy PDF
    if (data.cardHtml) {
      try {
        const html = String(data.cardHtml).replace(/\[\[SKETCH_(\d+)\]\]/g, function (m, idx) {
          const im = (data.sketchImages || [])[Number(idx)];
          return im ? im.dataUrl : '';
        });
        cardHtmlPelna = html;
        const cardFile = folder.createFile(
          Utilities.newBlob(html, 'text/html', 'Karta obiektu - ' + clientName + '.html'));
        cardUrl = cardFile.getUrl();
      } catch (err) {
        Logger.log('Karta obiektu: ' + err);
      }
    }

    // 5. RAPORT: DOKUMENT GOOGLE + PDF
    const docs = buildGoogleDoc(data, folder, imageBlobs, clientName, stamp, cardHtmlPelna);

    // 6. REJESTR
    try {
      appendToSheet(data, folderUrl, docs.docUrl, docs.pdfUrl, cardUrl);
    } catch (err) {
      Logger.log('Arkusz: ' + err);
    }

    if (exportId) {
      try { props.setProperty('exp_' + exportId, folderUrl); } catch (err) { Logger.log('exportId: ' + err); }
    }

    return textOut('SUCCESS|' + folderUrl);

  } catch (err) {
    return textOut('ERROR: ' + (err && err.message ? err.message : err));
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ---------------------------------------------------------------------
// RAPORT W DOKUMENTACH GOOGLE + EKSPORT PDF
// ---------------------------------------------------------------------
function buildGoogleDoc(data, folder, imageBlobs, clientName, stamp, kartaHtml) {
  const docName = 'Audyt - ' + clientName + ' (' + stamp + ')';
  const doc = DocumentApp.create(docName);
  const body = doc.getBody();
  body.setMarginTop(45).setMarginBottom(45).setMarginLeft(50).setMarginRight(50);

  let logoBlob = null;
  if (data.logo) {
    try { logoBlob = dataUrlToBlob(data.logo, 'logo.png'); } catch (err) { logoBlob = null; }
  }

  try {
    const header = doc.addHeader();
    if (logoBlob) {
      const p = header.appendParagraph('');
      const img = p.appendInlineImage(logoBlob);
      img.setWidth(42).setHeight(42);
      p.appendText('   SMART ENERGY').setBold(true).setForegroundColor(BRAND_DARK);
    } else {
      header.appendParagraph('SMART ENERGY').setBold(true).setForegroundColor(BRAND_DARK);
    }
  } catch (err) { Logger.log('Naglowek: ' + err); }

  try {
    doc.addFooter().appendParagraph('Smart Energy - protokol z audytu energetycznego')
       .setForegroundColor('#8a939c').setFontSize(8);
  } catch (err) {}

  const title = body.appendParagraph('PROTOKOL Z AUDYTU ENERGETYCZNEGO');
  title.setHeading(DocumentApp.ParagraphHeading.TITLE).setForegroundColor(BRAND_DARK);
  body.appendParagraph('Data sporzadzenia: ' + (data.timestamp || stamp))
      .setForegroundColor('#6c757d').setFontSize(9);
  body.appendHorizontalRule();

  head(body, '1. Dane ogolne i budynek');
  kvTable(body, [
    ['Klient', data.fullName], ['Telefon', data.phone], ['E-mail', data.email],
    ['Adres inwestycji', data.address], ['Rok budowy', data.year],
    ['Liczba mieszkancow', data.residents], ['Moc instalacji PV [kW]', data.pv],
    ['Wentylacja', data.ventilation]
  ]);

  head(body, '2. Instalacje');
  kvTable(body, [
    ['Zrodlo ciepla C.O.', data.heating],
    ['Piece kaflowe', data.kaflowe_check ? ('TAK - ilosc: ' + str(data.kaflowe_ilosc)) : 'NIE'],
    ['Opis instalacji C.O.', data.coDesc],
    ['Zrodlo C.W.U.', data.cwu]
  ]);

  const envRows = collectEnvelopes(data);
  if (envRows.length) {
    head(body, '3. Przegrody budowlane');
    const rows = [['Symbol', 'Rodzaj', 'Budowa', 'Grubosc [cm]', 'U [W/m2K]']];
    envRows.forEach(function (r) {
      const gr = r.thick || (r.warstwy && r.warstwy.length
        ? r.warstwy.reduce(function (t, w) { return t + (parseFloat(w.gr) || 0); }, 0).toFixed(1) : '');
      rows.push([r.id, r.section, budowaEnv(r) || '-', gr || '-', r.u || '-']);
    });
    styledTable(body, rows);
  }

  head(body, '4. Preferencje inwestora');
  body.appendParagraph(str(data.preferences) || '-');

  const st = computeStats(data);
  head(body, '5. Podsumowanie powierzchni');
  kvTable(body, [
    ['Powierzchnia lacznie', st.total.toFixed(2) + ' m2'],
    ['w tym ogrzewana', st.heated.toFixed(2) + ' m2'],
    ['w tym nieogrzewana', st.unheated.toFixed(2) + ' m2'],
    ['Liczba pomieszczen', String(st.roomCount)],
    ['Okna (szt. / pow.)', st.winCount + ' szt. / ' + st.winArea.toFixed(2) + ' m2'],
    ['Drzwi', String(st.doorCount)],
    ['Pomieszczenia bez kompletu wymiarow', String(st.needsDim)]
  ]);

  head(body, '6. Szkice, pomieszczenia i otwory');
  st.sketches.forEach(function (sk, idx) {
    const skH = (sk.height !== undefined && sk.height !== null && sk.height !== '' && !isNaN(parseFloat(sk.height)))
      ? parseFloat(sk.height) : null;
    const isSect = (sk.kind === 'przekroj');
    body.appendParagraph(str(sk.name) + (isSect ? '   (przekroj / elewacja)'
        : (skH !== null ? '   (wysokosc kondygnacji: ' + skH.toFixed(2) + ' m)' : '')))
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);
    const blob = imageBlobs[idx];
    if (blob) {
      try {
        const inserted = body.appendImage(blob);
        const maxW = 460;
        if (inserted.getWidth() > maxW) {
          const ratio = maxW / inserted.getWidth();
          inserted.setWidth(maxW).setHeight(Math.round(inserted.getHeight() * ratio));
        }
      } catch (err) {
        body.appendParagraph('[nie udalo sie osadzic szkicu]').setForegroundColor('#dc3545');
      }
    }

    const rooms = (sk.objects && sk.objects.rooms) || [];
    if (rooms.length) {
      // Przegrody oznaczone na tym szkicu - opis tuz pod rysunkiem, zeby
      // czytajac raport nie trzeba bylo szukac, co oznacza SZ1 czy D2.
      const et = (data.envTables && data.envTables[idx]) ? data.envTables[idx] : null;
      if (et && et.length) {
        const eRows = [['Ozn.', 'Rodzaj', 'Budowa', 'U [W/m2K]']];
        et.forEach(function (v) {
          var budowa;
          if (v.warstwy && v.warstwy.length) {
            // opis warstwowy - kazda warstwa w osobnej linii, na koncu suma grubosci
            budowa = v.warstwy.map(function (w) { return w.mat + ' - ' + w.gr + ' cm'; }).join('\n');
            if (v.gruboscWarstw) budowa += '\nRAZEM ' + Number(v.gruboscWarstw).toFixed(1) + ' cm';
          } else {
            budowa = budowaEnv(v);
          }
          eRows.push([str(v.id), str(v.catName), budowa || '-', str(v.u) || '-']);
        });
        body.appendParagraph('Przegrody oznaczone na rysunku').setFontSize(10).setForegroundColor('#6c757d');
        styledTable(body, eRows);
      }

      // Zestawienie dlugosci scian - policzone w aplikacji, tu tylko wypisane
      const wt = (data.wallTables && data.wallTables[idx]) ? data.wallTables[idx] : null;
      if (wt && wt.length) {
        const wRows = [['Ozn.', 'Pom.', 'Polozenie', 'Dlugosc [m]', 'Zrodlo']];
        wt.forEach(function (r) {
          wRows.push([str(r.label), str(r.roomNum), str(r.position),
                      (r.value !== null && r.value !== undefined) ? Number(r.value).toFixed(2) : '-',
                      str(r.source)]);
        });
        body.appendParagraph('Sciany - zestawienie dlugosci (oznaczenia 1a, 1b... sa na rysunku powyzej)').setFontSize(10).setForegroundColor('#6c757d');
        styledTable(body, wRows);
      }

      if (isSect) {
        // Przekroj / elewacja - obszary pomocnicze, poza bilansem powierzchni budynku
        const rows = [['Nr', 'Opis', 'Powierzchnia [m2]']];
        let total = 0;
        rooms.forEach(function (r) {
          const a = parseFloat(r.area);
          if (r.area !== 'Wymaga pomiaru!') total += a || 0;
          rows.push([str(r.num), str(r.name), str(r.area)]);
        });
        rows.push(['', 'RAZEM', total.toFixed(2)]);
        styledTable(body, rows);
        body.appendParagraph('Obszary z przekroju/elewacji - nie wliczaja sie do powierzchni budynku.')
            .setFontSize(8).setForegroundColor('#6c757d');
      } else {
        const rows = [['Nr', 'Typ pomieszczenia', 'Ogrzewane', 'Klimatyzacja', 'Powierzchnia [m2]', 'Kubatura [m3]']];
        const style = [];
        let total = 0, volTotal = 0;
        rooms.forEach(function (r) {
          const a = parseFloat(r.area);
          if (r.area !== 'Wymaga pomiaru!') total += a || 0;
          const v = (!isNaN(a) && skH !== null) ? a * skH : null;
          if (v !== null) volTotal += v;
          rows.push([str(r.num), str(r.name), str(r.heated), str(r.ac),
                     str(r.area), v !== null ? v.toFixed(2) : '-']);
          style.push(r.heated === 'Nie' ? STYL_NIEOGRZEWANE
                   : (r.ac === 'Tak' ? STYL_KLIMATYZOWANE : null));
        });
        rows.push(['', '', '', 'SUMA', total.toFixed(2), volTotal.toFixed(2)]);
        style.push(null);
        styledTable(body, rows, style);
      }
    }

    const ops = (sk.objects && sk.objects.openings) || [];
    if (ops.length) {
      const rows = [['ID', 'Szt.', 'Szerokosc [cm]', 'Wysokosc [cm]', 'Pow. szt. [m2]', 'Pow. razem [m2]', 'U [W/m2K]']];
      let opTotal = 0;
      groupOpenings(ops).forEach(function (g) {
        opTotal += g.totalArea;
        rows.push([str(g.id), String(g.count), str(g.width), str(g.height),
                   g.unitArea.toFixed(2), g.totalArea.toFixed(2), str(g.uValue || '-')]);
      });
      rows.push(['', '', '', '', 'RAZEM', opTotal.toFixed(2), '']);
      styledTable(body, rows);

      const groups = summarizeOpenings(ops);
      if (groups.length > 1) {
        const gRows = [['Kategoria', 'Szt.', 'Laczna powierzchnia [m2]']];
        groups.forEach(function (g) { gRows.push([g.name, String(g.count), g.area.toFixed(2)]); });
        styledTable(body, gRows);
      }
    }
  });

  head(body, '7. Uwagi audytora');
  // Wpisane uwagi drukujemy akapit po akapicie; bez nich zostawiamy
  // wolne miejsce na dopiski odreczne.
  if (str(data.auditorNotes).trim()) {
    str(data.auditorNotes).split(/\r?\n/).forEach(function (linia) {
      body.appendParagraph(linia).setFontSize(10);
    });
  } else {
    body.appendParagraph(' ');
    body.appendParagraph(' ');
  }

  head(body, '8. Potwierdzenie');
  body.appendParagraph('Potwierdzam zgodnosc powyzszych danych ze stanem faktycznym oraz zgadzam sie na ich ' +
                       'wykorzystanie w celu sporzadzenia audytu energetycznego.').setFontSize(9);
  if (data.signature) {
    try {
      const sigBlob = dataUrlToBlob(data.signature, 'podpis-klienta.png');
      const sig = body.appendImage(sigBlob);
      const maxH = 70;
      if (sig.getHeight() > maxH) {
        const ratio = maxH / sig.getHeight();
        sig.setHeight(maxH).setWidth(Math.round(sig.getWidth() * ratio));
      }
      folder.createFile(dataUrlToBlob(data.signature, 'podpis-klienta.png'));
    } catch (err) { Logger.log('Podpis: ' + err); }
  } else {
    body.appendParagraph(' ');
  }
  body.appendParagraph('Podpis klienta: ' + str(data.fullName)).setFontSize(9).setForegroundColor('#6c757d');
  body.appendParagraph(' ');
  body.appendParagraph('Podpis audytora: ......................................').setFontSize(9).setForegroundColor('#6c757d');

  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  docFile.moveTo(folder);

  let pdfUrl = '';
  try {
    // PDF robimy z KARTY OBIEKTU, nie z Dokumentu Google - karta ma czytelniejszy
    // uklad (kafelki, tabele obok szkicow, kolory). Dokument Google zostaje
    // jako wersja do edycji.
    if (kartaHtml) {
      const htmlPdf = HtmlService.createHtmlOutput(String(kartaHtml))
                                 .getBlob().getAs('application/pdf')
                                 .setName(docName + '.pdf');
      pdfUrl = folder.createFile(htmlPdf).getUrl();
    } else {
      const pdf = docFile.getAs('application/pdf').setName(docName + '.pdf');
      pdfUrl = folder.createFile(pdf).getUrl();
    }
  } catch (err) {
    Logger.log('PDF z karty nie wyszedl, biore Dokument Google: ' + err);
    try {
      const pdf = docFile.getAs('application/pdf').setName(docName + '.pdf');
      pdfUrl = folder.createFile(pdf).getUrl();
    } catch (e2) { Logger.log('PDF: ' + e2); }
  }

  return { docUrl: doc.getUrl(), pdfUrl: pdfUrl };
}

// ---------------------------------------------------------------------
// STATYSTYKI
// ---------------------------------------------------------------------
function computeStats(data) {
  let sketches = [];
  try { sketches = JSON.parse(data.sketchesJSON || '[]'); } catch (err) { sketches = []; }
  let heated = 0, unheated = 0, roomCount = 0, winArea = 0, winCount = 0, doorCount = 0, needsDim = 0;
  sketches.forEach(function (sk) {
    if (sk.kind === 'przekroj') return;   // przekroje nie licza sie do powierzchni budynku
    ((sk.objects && sk.objects.rooms) || []).forEach(function (r) {
      roomCount++;
      const a = parseFloat(r.area);
      if (isNaN(a)) { needsDim++; return; }
      if (r.heated === 'Tak') heated += a; else unheated += a;
    });
    ((sk.objects && sk.objects.openings) || []).forEach(function (o) {
      const a = (o.width * o.height) / 10000;
      if (String(o.id).indexOf('D') === 0) doorCount++; else { winCount++; winArea += a; }
    });
  });
  return { sketches: sketches, heated: heated, unheated: unheated, total: heated + unheated,
           roomCount: roomCount, winArea: winArea, winCount: winCount, doorCount: doorCount, needsDim: needsDim };
}

// ---------------------------------------------------------------------
// REJESTR W ARKUSZU
// ---------------------------------------------------------------------
function appendToSheet(data, folderUrl, docUrl, pdfUrl, cardUrl) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const st = computeStats(data);

  const headers = ['Data', 'Klient', 'Telefon', 'E-mail', 'Adres', 'Rok budowy', 'Mieszkancy',
                   'Pow. ogrzewana [m2]', 'Pow. lacznie [m2]', 'Pomieszczen', 'Okna [szt.]',
                   'PV [kW]', 'Zrodlo C.O.', 'Zrodlo C.W.U.', 'Preferencje',
                   'Folder', 'Raport', 'PDF', 'Karta'];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold').setBackground(BRAND_DARK).setFontColor('#ffffff')
         .setVerticalAlignment('middle').setWrap(true);
    sheet.setRowHeight(1, 42);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2);
    const widths = [130, 190, 110, 190, 250, 90, 95, 130, 130, 100, 95, 90, 200, 200, 280, 90, 90, 90, 90];
    widths.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
    try { sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).createFilter(); } catch (err) {}
  }

  sheet.appendRow([
    new Date(), str(data.fullName), str(data.phone), str(data.email), str(data.address),
    str(data.year), str(data.residents),
    Number(st.heated.toFixed(2)), Number(st.total.toFixed(2)), st.roomCount, st.winCount,
    str(data.pv), str(data.heating), str(data.cwu), str(data.preferences),
    link(folderUrl, 'Folder'), link(docUrl, 'Raport'), link(pdfUrl, 'PDF'), link(cardUrl, 'Karta')
  ]);

  const row = sheet.getLastRow();
  const range = sheet.getRange(row, 1, 1, headers.length);
  range.setVerticalAlignment('top');
  if (row % 2 === 0) range.setBackground('#f6f8fa');
  sheet.getRange(row, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(row, 8, 1, 2).setNumberFormat('0.00');
  sheet.getRange(row, 2).setFontWeight('bold');
  sheet.getRange(row, 15).setWrap(true);
  if (st.needsDim > 0) {
    sheet.getRange(row, 8, 1, 2).setFontColor('#dc3545')
         .setNote(st.needsDim + ' pomieszczen bez kompletu wymiarow - powierzchnia niepelna');
  }
  sheet.setRowHeight(row, 34);
}

function link(url, label) {
  return url ? '=HYPERLINK("' + url + '";"' + label + '")' : '-';
}

// ---------------------------------------------------------------------
// POMOCNICZE
// ---------------------------------------------------------------------
function str(v) { return (v === undefined || v === null) ? '' : String(v); }

// Kategorie otworow - musza byc zgodne z aplikacja (index.html).
// Najdluzszy pasujacy prefiks wygrywa, zeby "DZ1" nie trafilo do kategorii "D".
const OPENING_CATS = [
  { pref: 'OPZ', name: 'Okna polaciowe' },
  { pref: 'DZ',  name: 'Drzwi zewnetrzne' },
  { pref: 'DW',  name: 'Drzwi wewnetrzne' },
  { pref: 'O',   name: 'Okna' }
];

function openingCatOf(id) {
  const up = String(id).toUpperCase();
  let best = null;
  OPENING_CATS.forEach(function (c) {
    if (up.indexOf(c.pref) === 0 && (!best || c.pref.length > best.pref.length)) best = c;
  });
  return best || { pref: '?', name: 'Inne' };
}

// Grupuje identyczne otwory (to samo ID i wymiary) w jeden wiersz z liczba sztuk.
function groupOpenings(openings) {
  const map = {}; const order = [];
  (openings || []).forEach(function (op) {
    const k = String(op.id).toUpperCase() + '|' + op.width + '|' + op.height + '|' + (op.uValue || '');
    if (!map[k]) { map[k] = { id: op.id, width: op.width, height: op.height, uValue: op.uValue, count: 0 }; order.push(k); }
    map[k].count++;
  });
  return order.map(function (k) {
    const g = map[k];
    g.unitArea = (g.width * g.height) / 10000;
    g.totalArea = g.unitArea * g.count;
    return g;
  });
}

function summarizeOpenings(openings) {
  const map = {};
  (openings || []).forEach(function (op) {
    const cat = openingCatOf(op.id);
    if (!map[cat.name]) map[cat.name] = { name: cat.name, pref: cat.pref, count: 0, area: 0 };
    map[cat.name].count++;
    map[cat.name].area += (op.width * op.height) / 10000;
  });
  const order = ['O', 'OPZ', 'DZ', 'DW', '?'];
  return Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return order.indexOf(a.pref) - order.indexOf(b.pref); });
}

function dataUrlToBlob(dataUrl, name) {
  const parts = String(dataUrl).split(',');
  const mime = (parts[0].match(/data:([^;]+)/) || [null, 'image/png'])[1];
  return Utilities.newBlob(Utilities.base64Decode(parts[1]), mime, name);
}

function sanitizeName(name) {
  return String(name).replace(/[\\\/:*?"<>|]/g, '-').substring(0, 80);
}

function textOut(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function head(body, text) {
  const p = body.appendParagraph(text);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  p.setForegroundColor(BRAND_DARK);
  return p;
}

function kvTable(body, pairs) {
  const rows = pairs.map(function (p) { return [str(p[0]), str(p[1]) || '-']; });
  const table = body.appendTable(rows);
  table.setBorderColor('#adb5bd');
  for (let i = 0; i < table.getNumRows(); i++) {
    const cell = table.getRow(i).getCell(0);
    cell.setBackgroundColor('#eceff1').setWidth(170);
    cell.editAsText().setBold(true);
  }
  table.editAsText().setFontSize(10);
  return table;
}

// rowStyles (opcjonalne) - tablica rowna liczbie wierszy DANYCH (bez naglowka),
// kazdy element to null albo { bg: '#..', fg: '#..' }. Dzieki temu w Dokumencie
// Google pomieszczenia nieogrzewane sa czerwone, a klimatyzowane niebieskie -
// tak samo jak w karcie obiektu i w PDF.
function styledTable(body, rows, rowStyles) {
  const clean = rows.map(function (r) { return r.map(function (c) { return str(c); }); });
  const table = body.appendTable(clean);
  table.setBorderColor('#adb5bd');
  const headerRow = table.getRow(0);
  for (let c = 0; c < headerRow.getNumCells(); c++) {
    headerRow.getCell(c).setBackgroundColor('#eceff1').editAsText().setBold(true);
  }
  table.editAsText().setFontSize(9);
  if (rowStyles && rowStyles.length) {
    for (let r = 0; r < rowStyles.length; r++) {
      const st = rowStyles[r];
      if (!st) continue;
      const row = table.getRow(r + 1);   // +1, bo wiersz 0 to naglowek
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        if (st.bg) cell.setBackgroundColor(st.bg);
        if (st.fg) cell.editAsText().setForegroundColor(st.fg).setBold(true);
      }
    }
  }
  return table;
}

// Te same kolory co w karcie obiektu: nieogrzewane czerwone, klimatyzowane niebieskie.
const STYL_NIEOGRZEWANE = { bg: '#fdecea', fg: '#a4262c' };
const STYL_KLIMATYZOWANE = { bg: '#e8f1fb', fg: '#0b4a8f' };

function collectEnvelopes(data) {
  // Oznaczen na przekroju moze byc dowolnie duzo (SZ6, S12...), wiec skanujemy
  // realne klucze przyslane z aplikacji zamiast sztywnych zakresow 1..count.
  // Przegroda liczy sie, gdy ma warstwy albo cokolwiek wpisane recznie.
  // Pola _type/_insulation/_insthick pochodza ze starego modelu opisu przegrod -
  // czytamy je wylacznie po to, zeby archiwalne audyty nadal sie drukowaly.
  const nameById = {};
  ENVELOPES.forEach(function (s) { nameById[s.id] = s.name; });
  const found = {};
  Object.keys(data).forEach(function (k) {
    const m = k.match(/^(SZ|DZ|PG|S|D|O)(\d+)_(layers|desc|totalthick|uvalue|type|insulation|insthick)$/);
    if (!m) return;
    const v = data[k];
    if (!v || String(v).indexOf('Wybierz') === 0) return;
    found[m[1] + m[2]] = { cat: m[1], num: parseInt(m[2], 10) };
  });
  const order = ['SZ', 'S', 'PG', 'D', 'O', 'DZ'];
  return Object.keys(found).map(function (key) {
    const f = found[key];
    var warstwy = [];
    try { const raw = data[key + '_layers']; if (raw) warstwy = JSON.parse(raw) || []; } catch (e) {}
    return {
      id: key,
      cat: f.cat,
      num: f.num,
      section: nameById[f.cat] || f.cat,
      warstwy: warstwy,
      desc: str(data[key + '_desc']),
      thick: str(data[key + '_totalthick']),
      archiwalne: archiwalnyOpisEnv(data, key),
      u: str(data[key + '_uvalue'])
    };
  }).sort(function (a, b) {
    return (order.indexOf(a.cat) - order.indexOf(b.cat)) || (a.num - b.num);
  });
}

// Sklejka pol starego modelu opisu przegrod - tylko do odczytu archiwalnych audytow.
function archiwalnyOpisEnv(data, key) {
  const czesci = [];
  const typ = data[key + '_type'];
  const izol = data[key + '_insulation'];
  const izolGr = data[key + '_insthick'];
  if (typ && String(typ).indexOf('Wybierz') !== 0) czesci.push(str(typ));
  if (izol && String(izol).indexOf('Wybierz') !== 0 && String(izol) !== 'Brak') {
    czesci.push('ocieplenie: ' + str(izol) + (izolGr ? ' ' + str(izolGr) + ' cm' : ''));
  }
  return czesci.join(' - ');
}

// Budowa przegrody w jednej komorce tabeli: warstwy albo opis wlasny.
function budowaEnv(v) {
  if (v.warstwy && v.warstwy.length) {
    var t = v.warstwy.map(function (w) { return w.mat + ' - ' + w.gr + ' cm'; }).join('\n');
    if (v.gruboscWarstw) t += '\nRAZEM ' + Number(v.gruboscWarstw).toFixed(1) + ' cm';
    return t;
  }
  return [v.desc, v.thick ? 'gr. ' + v.thick + ' cm' : '', v.archiwalne]
         .filter(function (x) { return x; }).join('; ');
}
