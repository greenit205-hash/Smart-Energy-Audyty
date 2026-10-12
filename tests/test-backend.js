/* Smart Energy Audyty - backend Apps Script (apps-script/Kod.gs).
 * Uruchomienie:  node tests/test-backend.js
 *
 * Kod.gs uruchamiamy naprawdę - usługi Google (Drive, Dokumenty, Arkusze...)
 * są podstawione atrapami, które zapisują, co backend próbował zrobić.
 * Dzięki temu widać np. to, co wyszło w polu: pakiet, którego backend nie
 * rozumie, zakładał na Dysku pusty folder "Klient bez nazwy".
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

// ---- atrapa Dysku -----------------------------------------------------
function nowyDysk() {
  const root = folder('ROOT');
  function folder(nazwa) {
    const pliki = [], podfoldery = [];
    const f = {
      nazwa, pliki, podfoldery,
      getName: () => nazwa,
      getUrl: () => 'https://drive.test/' + encodeURIComponent(nazwa),
      getId: () => 'id_' + nazwa,
      createFolder: n => { const nf = folder(n); podfoldery.push(nf); return nf; },
      createFile: function () { const nazwaPliku = (arguments[0] && arguments[0].nazwa) || arguments[0] || 'plik';
        const pl = { getName: () => String(nazwaPliku), getUrl: () => 'https://drive.test/plik',
                     getId: () => 'f_' + pliki.length, setTrashed: () => {},
                     getDateCreated: () => new Date(), getBlob: () => ({ getDataAsString: () => '{}' }) };
        pliki.push(pl); return pl; },
      getFoldersByName: n => iter(podfoldery.filter(x => x.getName() === n)),
      getFolders: () => iter(podfoldery.slice()),
      getFiles: () => iter(pliki.slice()),
      getFilesByName: n => iter(pliki.filter(x => x.getName() === n)),
      setTrashed: () => { const i = root.podfoldery.indexOf(f); if (i > -1) root.podfoldery.splice(i, 1); }
    };
    return f;
  }
  function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
  return { root, folder, iter };
}

function nowySandbox() {
  const dysk = nowyDysk();
  const props = {};
  // Atrapa, która przeżyje wszystko: wywołanie, odczyt pola i sklejenie z tekstem.
  const echo = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === 'then') return undefined;
      if (p === Symbol.toPrimitive) return () => '';
      if (p === 'toString' || p === 'valueOf') return () => '';
      return echo;
    },
    apply: () => echo, construct: () => echo
  });
  const wyslane = [];
  const ctx = {
    DriveApp: {
      getFolderById: () => dysk.root,
      // Plik z Dysku: znane metody działają, reszta spada na atrapę.
      getFileById: () => new Proxy({
        setTrashed: () => {}, moveTo: () => {}, getUrl: () => 'https://drive.test/dok',
        getId: () => 'dok', getName: () => 'dok', setName: function () { return this; },
        getAs: () => ({ setName: function () { return this; }, getBytes: () => [] }),
        getBlob: () => ({ getDataAsString: () => '{}', setName: function () { return this; } })
      }, { get: (t, pr) => (pr in t ? t[pr] : echo) })
    },
    DocumentApp: new Proxy({ create: () => echo, ParagraphHeading: echo, Attribute: echo,
                             HorizontalAlignment: echo, ElementType: echo }, { get: (t, p) => (p in t ? t[p] : echo) }),
    SpreadsheetApp: new Proxy({}, { get: () => echo }),
    Utilities: {
      formatDate: () => '2026-10-12 10.00',
      newBlob: (tresc, typ, nazwa) => ({ nazwa: nazwa, getName: () => nazwa, setName: function (n) { this.nazwa = n; return this; },
                                         getBytes: () => [], getDataAsString: () => String(tresc) }),
      base64Decode: () => []
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = v; }
    }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Session: { getScriptTimeZone: () => 'Europe/Warsaw' },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    Logger: { log: () => {} },
    ContentService: {
      MimeType: { TEXT: 'TEXT' },
      createTextOutput: t => { const o = { tresc: String(t), setMimeType: () => o, getContent: () => String(t) }; wyslane.push(o); return o; }
    },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Kod.gs'), 'utf8'), ctx);
  return { ctx, dysk, props, wyslane };
}

function post(s, obj) {
  const wynik = s.ctx.doPost({ postData: { contents: JSON.stringify(obj) } });
  return wynik && wynik.getContent ? wynik.getContent() : String(wynik);
}
function folderyKlientow(s) {
  return s.dysk.root.podfoldery
    .filter(f => f.getName() !== 'KOPIE ZAPASOWE' && f.getName() !== 'WYMIANA (tablety)')
    .map(f => f.getName());
}

const AUDYT = {
  action: 'export', exportId: 'exp_1', fullName: 'Jan Kowalski', address: 'Dębno 205',
  phone: '531800442', sketchImages: [], cardHtml: '', sketchesJSON: '[]'
};

console.log('--- pakiet, którego backend nie rozumie ---');
{
  const s = nowySandbox();
  const odp = post(s, { action: 'cos-nowego', payload: 'x' });
  sprawdz('nieznana akcja kończy się błędem', odp.indexOf('ERROR') === 0, odp);
  sprawdz('nieznana akcja NIE zakłada folderu klienta', folderyKlientow(s).length === 0,
    folderyKlientow(s).join(', '));
  sprawdz('komunikat mówi, co zrobić', /Kod\.gs/.test(odp) && /wdro/i.test(odp), odp);
}

console.log('--- pusty pakiet ---');
{
  const s = nowySandbox();
  const odp = post(s, { exportId: 'exp_pusty' });
  sprawdz('pusty pakiet kończy się błędem', odp.indexOf('ERROR') === 0, odp);
  sprawdz('pusty pakiet NIE zakłada folderu "Klient bez nazwy"',
    folderyKlientow(s).length === 0, folderyKlientow(s).join(', '));
}

console.log('--- kopia zapasowa ---');
{
  const s = nowySandbox();
  const odp = post(s, { action: 'backup', rola: 'audytor', payload: '{"audyty":[]}' });
  sprawdz('kopia zapisuje się bez błędu', odp.indexOf('SUCCESS') === 0, odp);
  sprawdz('kopia NIE zakłada folderu klienta', folderyKlientow(s).length === 0,
    folderyKlientow(s).join(', '));
  const kopie = s.dysk.root.podfoldery.filter(f => f.getName() === 'KOPIE ZAPASOWE');
  sprawdz('kopia ląduje w folderze KOPIE ZAPASOWE', kopie.length === 1 && kopie[0].pliki.length === 1);

  // pięć kopii pod rząd to nadal jeden folder i zero folderów klienta
  for (let i = 0; i < 5; i++) post(s, { action: 'backup', rola: 'audytor', payload: '{"a":' + i + '}' });
  sprawdz('pięć kopii pod rząd nie tworzy żadnego folderu klienta',
    folderyKlientow(s).length === 0, folderyKlientow(s).join(', '));
}

console.log('--- wymiana między tabletami ---');
{
  const s = nowySandbox();
  const odp = post(s, { action: 'pushPart', code: 'ABC', deviceId: 't1', role: 'pomocnik', payload: {} });
  sprawdz('paczka pomocnika przechodzi', odp.indexOf('SUCCESS') === 0, odp);
  sprawdz('paczka pomocnika NIE zakłada folderu klienta', folderyKlientow(s).length === 0,
    folderyKlientow(s).join(', '));
}

console.log('--- prawdziwy eksport audytu ---');
{
  const s = nowySandbox();
  const odp = post(s, AUDYT);
  sprawdz('eksport kończy się sukcesem', odp.indexOf('SUCCESS') === 0, odp);
  const f = folderyKlientow(s);
  sprawdz('powstaje dokładnie jeden folder klienta', f.length === 1, f.join(', '));
  sprawdz('folder nosi nazwisko klienta', f[0] && f[0].indexOf('Jan Kowalski') === 0, f[0]);

  // powtórka "w ciemno" z tym samym exportId
  const odp2 = post(s, AUDYT);
  sprawdz('powtórka zwraca ten sam wynik', odp2.indexOf('SUCCESS') === 0, odp2);
  sprawdz('powtórka nie tworzy drugiego folderu', folderyKlientow(s).length === 1,
    folderyKlientow(s).join(', '));
}

console.log('--- eksport bez podanego nazwiska ---');
{
  const s = nowySandbox();
  const odp = post(s, { action: 'export', exportId: 'exp_2', address: 'Dębno 205', sketchesJSON: '[]' });
  sprawdz('audyt z samym adresem nadal przechodzi', odp.indexOf('SUCCESS') === 0, odp);
  const f = folderyKlientow(s);
  sprawdz('taki folder dostaje nazwę zastępczą', f.length === 1 && f[0].indexOf('Klient bez nazwy') === 0,
    f.join(', '));
}

console.log('--- sprzątanie po starym błędzie ---');
{
  const s = nowySandbox();
  s.dysk.root.createFolder('Klient bez nazwy (2026-10-01 09.00)');          // pusty
  const pelny = s.dysk.root.createFolder('Klient bez nazwy (2026-10-02 09.00)');
  pelny.createFile('dane-audytu.json');                                      // niepusty
  s.dysk.root.createFolder('Jan Kowalski (2026-10-03 09.00)');
  const info = s.ctx.sprzatnijPusteFolderyBezNazwy();
  sprawdz('pusty folder bez nazwy idzie do kosza', /Do kosza: 1/.test(info), info);
  sprawdz('folder z plikami zostaje nietknięty', /pominiete \(niepuste\): 1/.test(info), info);
  sprawdz('folder prawdziwego klienta zostaje',
    folderyKlientow(s).indexOf('Jan Kowalski (2026-10-03 09.00)') > -1, folderyKlientow(s).join(', '));
}

console.log('--- wersja backendu ---');
{
  const s = nowySandbox();
  const wit = s.ctx.doGet({ parameter: {} }).getContent();
  sprawdz('doGet podaje numer wersji', /Wersja\s+[0-9.]+/.test(wit), wit);
  const wer = (wit.match(/Wersja\s+([0-9]+(?:\.[0-9]+)+)/) || [])[1];
  const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const wymagana = (app.match(/WYMAGANA_WERSJA_BACKENDU\s*=\s*'([0-9.]+)'/) || [])[1];
  sprawdz('aplikacja wie, jakiej wersji backendu potrzebuje', !!wymagana, String(wymagana));
  sprawdz('numer w Kod.gs zgadza się z tym, czego oczekuje aplikacja', wer === wymagana,
    'Kod.gs=' + wer + ', index.html=' + wymagana);
  sprawdz('ping odpowiada numerem wersji', post(s, { action: 'ping' }) === 'SUCCESS|' + wer);
}

console.log('--- aplikacja po stronie tabletu ---');
{
  const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  sprawdz("eksport wysyła jawną akcję 'export'", /payload\.action\s*=\s*'export'/.test(app));
  sprawdz('kopia zapasowa czyta odpowiedź serwera',
    /action: 'backup'[\s\S]{0,600}?await res\.text\(\)/.test(app));
  sprawdz('odrzucona kopia nie jest liczona jako udana',
    /odp\.indexOf\('ERROR'\) === 0[\s\S]{0,300}?return false;/.test(app));
  sprawdz('pulpit pokazuje powód odrzucenia kopii', /Ostatnia kopia nie przesz/.test(app));
  sprawdz('test połączenia ostrzega przed starym Kod.gs',
    /Kod\.gs jest nieaktualny/.test(app) && /Klient bez nazwy/.test(app));
}

if (bledy.length) {
  console.log('\nBŁĘDY (' + bledy.length + '):');
  bledy.forEach(b => console.log('  ✗ ' + b));
  console.log('\nPrzeszło: ' + ok + ', nie przeszło: ' + bledy.length);
  process.exit(1);
} else {
  console.log('\n✓ Wszystkie testy przeszły (' + ok + ' sprawdzeń).');
}
