// Smart Energy Audyty - Service Worker
// v49: NAPRAWA - kasowanie przegrody kasowalo warstwy wszystkich pozostalych; prostowanie scian; szablony w kopii zapasowej
// v48: wielolinijkowe pole tekstowe na szkicu + kres dolny przegrody niejednorodnej wg PN-EN ISO 6946
// v47: pole na uwagi audytora - trafiaja do raportu, karty obiektu i Dokumentu Google
// v46: dane wymagane karta audytu (Dz.U. 2022 poz. 2816) i swiadectwem (Dz.U. 2023 poz. 697) - sprawnosci skladowe, wentylacja, nosniki energii z wi
// v45: poprawione opory przegrod gruntowych (Rse=0) - wg pliku .thb z ArCADia
// v44: typy przegrod wg PN-EN ISO 6946, przegroda niejednorodna (wycinki A/B), szablony przegrod
// v43: poprawianie wstawionego otworu, przeliczanie obrysu po zmianie scian, typ Piwnica
// v42: ostrzeganie o zapelniajacej sie pamieci + kolory pomieszczen w Dokumencie Google
// v41: NAPRAWA - wpisane wymiary byly ignorowane, gdy rogi zostaly dociagniete (pokoj pokazywal "Wymaga pomiaru!" mimo zmierzenia)
// v40: usuniety stary model opisu przegrod - zostaly warstwy, opis wlasny, grubosc i U
// v39: dopisano 4 materialy (zuzel paleniskowy, papa, plyta pilsniowa miekka, eternit)
// v3: naprawiono blokowanie zapytan POST (wysylka na Dysk Google) + dziala offline od pierwszego uruchomienia

const CACHE_NAME = 'smart-energy-v49';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './base_logo_white_background.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(n => (n !== CACHE_NAME ? caches.delete(n) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // KLUCZOWA POPRAWKA: nie dotykamy niczego poza GET.
  // Wczesniej POST do Google Apps Script trafial do cache.put() -> wyjatek -> wysylka na Dysk nie dzialala.
  if (req.method !== 'GET') return;

  // Zapytania do backendu zawsze prosto do sieci, bez cache.
  if (req.url.indexOf('script.google.com') > -1 || req.url.indexOf('googleusercontent.com') > -1) return;

  event.respondWith(
    fetch(req)
      .then(networkResponse => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(req).then(hit => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
      )
  );
});
