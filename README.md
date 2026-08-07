# Smart Energy Audyty

Aplikacja dla audytora energetycznego: inwentaryzacja w terenie, szkicownik z automatycznym liczeniem powierzchni, raporty i eksport na Dysk Google.

Działa w przeglądarce na tablecie (PWA — instaluje się jako ikona i **działa bez internetu**). Nie wymaga serwera: całość to jeden plik `index.html` plus backend w Google Apps Script.

---

## Co potrafi

- **Szkicownik** — rysowanie rzutów i przekrojów, przyciąganie do siatki, prostowanie linii do osi
- **Inteligentne wymiarowanie** — program sam wskazuje, które ściany trzeba zmierzyć, i pyta tylko o minimum (prostokąt = 2 pomiary, nie 4). Ściany w jednej linii traktuje jak jeden ciąg
- **Rozpoznawanie pomieszczeń** — po narysowaniu rzutu klikasz w środku pokoju, program sam wykrywa jego obrys
- **Prowadzony pomiar** — podświetla kolejną ścianę i czeka na odczyt z dalmierza
- **Szczyt dachu** — pole elewacji z wysokości szczytu i jednej odległości poziomej, bez mierzenia połaci
- **Otwory** — okna i drzwi z podpowiedziami już wpisanych wymiarów, zestawienia powierzchni wg kategorii
- **Przegrody** — oznaczane na przekroju, lista w formularzu buduje się z oznaczeń
- **Raporty** — plik `.doc` do edycji offline, karta obiektu HTML, Dokument Google + PDF na Dysku
- **Praca na dwóch tabletach** — pomocnik rysuje, audytor opisuje, dane scalają się w jeden raport
- **Autozapis** co 30 s i odzyskiwanie sesji po awarii

## Struktura

```
index.html                  cała aplikacja (interfejs + logika)
manifest.json, sw.js        pliki PWA (ikona na pulpicie, tryb offline)
icon-*.png, base_logo_*.png grafika
apps-script/Kod.gs          backend: folder klienta, raport, PDF, rejestr, wymiana między tabletami
docs/WDROZENIE-2-TABLETY.md instrukcja wdrożenia krok po kroku
docs/INSTRUKCJA.md          podręcznik codziennej pracy
```

## Szybki start

1. **Backend** — wklej `apps-script/Kod.gs` do nowego projektu na `script.google.com`, uzupełnij `SHEET_ID` i `PARENT_FOLDER_ID`, autoryzuj i wdróż jako aplikację internetową z dostępem **Wszyscy**. Skopiuj adres kończący się na `/exec`.
2. **Aplikacja** — włącz GitHub Pages dla tego repozytorium (Settings → Pages → Deploy from a branch → main → `/ (root)`), albo wrzuć pliki na `app.netlify.com/drop`.
3. **Tablet** — otwórz adres w Chrome, zainstaluj jako aplikację, a w niej: Pulpit → **Połączenie z Dyskiem Google** → wklej adres `/exec` → **Testuj połączenie**.

Pełny opis: [docs/WDROZENIE-2-TABLETY.md](docs/WDROZENIE-2-TABLETY.md).

## Uwaga o bezpieczeństwie

Adres wdrożenia `/exec` **nie jest zapisany w kodzie** — wpisuje się go w aplikacji i zostaje w pamięci tabletu. Jest to adres z dostępem „Wszyscy": kto go zna, może zapisywać dane na Twoim Dysku. Nie wklejaj go do plików w repozytorium ani nie publikuj.

Z tego samego powodu `SHEET_ID` i `PARENT_FOLDER_ID` w `apps-script/Kod.gs` to placeholdery — swoje wpisujesz dopiero w edytorze Apps Script.

## Aktualizacja

| Zmiana | Co zrobić |
|---|---|
| `index.html` | Wypchnij do repozytorium — Pages odświeży się samo. Tablety pobiorą wersję przy następnym uruchomieniu z internetem |
| `apps-script/Kod.gs` | Wklej do Apps Script → **Wdróż → Zarządzaj wdrożeniami → ołówek → Nowa wersja**. Adres `/exec` zostaje ten sam |

Po zmianie `index.html` warto podbić numer w `sw.js` (`CACHE_NAME`), żeby tablety na pewno pobrały nową wersję.
