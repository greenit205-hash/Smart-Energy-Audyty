# Smart Energy Audyty — przekazanie projektu

**Stan na:** 02.09.2026 · wersja aplikacji `smart-energy-v47`

Ten dokument zawiera wszystko, co potrzebne, żeby kontynuować pracę w nowym czacie. Wgraj go razem z plikami wymienionymi na końcu.

---

# 1. Kim jestem i po co ta aplikacja

Jestem audytorem energetycznym (Smart Energy). Aplikacja służy do **inwentaryzacji budynku u klienta**: szkicowanie rzutów i przekrojów, pomiary dalmierzem, opis przegród i instalacji, a na końcu raport wysyłany na Dysk Google.

**Na audyty jeżdżę razem z żoną** — ona zajmuje się głównie pomiarami, ja opisem przegród. Pracujemy na dwóch tabletach jednocześnie.

**Najważniejsze dla mnie:** żeby wizyta u klienta trwała jak najkrócej, ale żebym wyszedł z niej z możliwie kompletnymi danymi. Szukam złotego środka — kilka razy okazywało się, że procedura robiła się tak skomplikowana, że trwała dłużej niż ręczne notatki. Prostota wygrywa z funkcjami.

**Sprzęt:** tablety z Androidem (Chrome), dalmierze **Leica DISTO X3 i X4**.

---

# 2. Architektura

| Element | Opis |
|---|---|
| `index.html` | **cała aplikacja** — interfejs, szkicownik, logika, bazy danych. Jeden plik, ~360 kB |
| `manifest.json`, `sw.js` | PWA: instalacja jako ikona + praca offline |
| ikony PNG, logo | grafika (logo wbudowane w raporty jako data URL) |
| `apps-script/Kod.gs` | backend Google Apps Script: folder klienta, Dokument Google, PDF, karta HTML, rejestr w arkuszu, wymiana między tabletami |

**Hosting:** GitHub Pages — `https://greenit205-hash.github.io/Smart-Energy-Audyty/`
**Repozytorium:** `github.com/greenit205-hash/Smart-Energy-Audyty`
(Netlify było używane wcześniej, teraz podstawowy jest GitHub.)

**Ważne o publikacji GitHub Pages:** trzeba mieć **Settings → Pages → Source = GitHub Actions** (nie „Deploy from a branch"). Stary mechanizm `pages-build-deployment` wieszał się na wiele godzin. W repozytorium jest `.github/workflows/pages.yml`, który to omija, oraz plik `.nojekyll`.

**Bezpieczeństwo:** adres wdrożenia `/exec` **nie może trafić do repozytorium** (jest publiczne, a ten adres pozwala zapisywać na moim Dysku). W wersji dla GitHuba `DEFAULT_API_URL` jest pusty, a `SHEET_ID` i `PARENT_FOLDER_ID` w `Kod.gs` to placeholdery. Adres wpisuję w aplikacji: Pulpit → Połączenie z Dyskiem Google.

---

# 3. Co aplikacja już potrafi

## Szkicownik

- **📏 Ściana** — rysowanie; linie prawie proste same się prostują, końce przyciągają się do istniejących. Podczas ciągnięcia widać **przybliżoną długość** (`~4.00 m` — tylko pomoc, nie pomiar)
- **Odległość od narożnika** — najazd na narysowaną ścianę pokazuje odległość od bliższego rogu
- **🏠 Pomieszcz.** — klikam w środku, program **sam rozpoznaje obrys** (analiza grafu płaskiego). Numeracja osobna dla każdego szkicu
- **v43 — obrys a zmiany ścian.** Pomieszczenie pamięta obrys z chwili założenia. Gdy później dorysuję wnękę albo skasuję ścianę, rysunek się zmienia, a zapisany obrys nie — i powierzchnia zostawała stara, bez żadnego sygnału. Teraz program to wykrywa: wiersz w tabeli robi się żółty z napisem „obrys nieaktualny" i przyciskiem **🔄**, a nad tabelą jest **🔄 Przelicz obrysy** dla wszystkich naraz. Numer, typ, ogrzewanie i klimatyzacja zostają — zmienia się wyłącznie kształt. Gdy obszar nie jest zamknięty, program mówi o tym wprost i **nie rusza** starego obrysu
- Typy pomieszczeń: v43 dokłada **Piwnica**, **Garaż** i **Strych / poddasze nieużytkowe**
- **🎯 Pomiar** — prowadzony pomiar: program podświetla ścianę („MIERZ TĘ ŚCIANĘ"), czeka na odczyt, przechodzi do następnej
- **🚪 Otwór** — okna/drzwi z podpowiedziami wcześniejszych wymiarów, kategorie i zestawienia. **v43: kliknięcie w już wstawiony otwór otwiera go do poprawki** (rodzaj, numer, wymiary, U) zamiast wstawiać drugi obok; zmiana rodzaju podpowiada nowy numer, ale nie kasuje wpisanych wymiarów. Pod tabelą otworów jest wykaz pojedynczych sztuk z przyciskiem ✏️
- **🏷️ Przegroda** — oznaczanie przegród na przekroju (SZ/S/PG/D + numer); **📋 Lista przegród** do zarządzania
- **📐 Skos** — skosy poddasza z wymiarami (osobny rodzaj szkicu)
- **▨ obszary kreskowane**, **📐 Miarka**, **✏️ Ołówek**, **abc Txt**, **🧽 Usuń**, **🩺 Diagnostyka**
- **📐 Szablony szkiców** — gotowe rzuty, przekroje, ściany
- **🔤 Ozn. ścian** — etykiety 1a, 1b… (na ekranie na żądanie, w raporcie zawsze)
- **🧹 Wyczyść dane** — zostawia sam rysunek ścian (przydatne po skopiowaniu szkicu)

## Silnik wymiarowania

To jest serce aplikacji i najczęstsze źródło problemów, więc opisuję dokładnie:

- **Rysunek to tylko szkic.** Liczą się wyłącznie wpisane wymiary. Program **nigdy nie pokazuje długości odczytanej z rysunku** — ściana bez pomiaru nie dostaje żadnej liczby (w trybie Wymiaruj pokazuje „?")
- **Minimum pomiarów:** prostokąt = 2 pomiary, nie 4. Wszystkie ściany oprócz jednej na oś; ostatnia wynika z zamknięcia figury
- **Ściany scalane w ciągi** — jeśli wzdłuż korytarza stoją ścianki działowe, program pyta o cały ciąg 5,0 m, nie o 2,0 + 0,2 + 2,8. Działa też odwrotnie (suma odcinków zastępuje ciąg)
- **Jeden skos** liczy się sam z zamknięcia figury. **Dwa i więcej** (elewacja ze szczytem) wymagają pomiaru — sama podstawa i wysokości nie wystarczą
- **Szczyt dachu:** zamiast mierzyć połacie podaję wysokość szczytu i odległość poziomą (od lewej **albo prawej** krawędzi — do wyboru)
- **Klasyfikacja ścian po kącie** (tolerancja 3°), nie po pikselach. Wcześniej krzywizna 2 px robiła z prostokąta „skos" i pole wychodziło 24,95 zamiast 25,00
- **Scalanie węzłów po odległości**, nie przez zaokrąglanie do siatki. Plus **dociąganie końców ścian** do 12 px. Bez tego pomieszczenia o 5+ ścianach czasem się nie domykały
- **v41 — naprawiony rozjazd kluczy odcinków.** Obrys pomieszczenia powstaje z pozycji po dociągnięciu rogów, a wymiar wpisywany dotknięciem ściany — z pozycji narysowanej. Gdy róg został dociągnięty, klucze przestawały być identyczne i **wpisany pomiar był po cichu ignorowany**: pokój pokazywał „Wymaga pomiaru!" mimo zmierzenia wszystkich ścian. Dotyczyło ręcznego wymiarowania (🎯 prowadzony pomiar działał, bo używa kluczy z obrysu). Teraz przy nietrafionym kluczu szukamy najbliższego odcinka (środek ≤ 8 px, długość ≤ 18 px); gdy pasują dwa — nie zgadujemy, tylko prosimy o pomiar
- **v41 — nowe ostrzeżenie: ukośna ściana na rzucie.** Ściana odchylona o więcej niż 3° jest liczona jak skos, czyli jej kąt bierze się z rysunku i po cichu zmienia powierzchnię. Na rzucie to prawie zawsze pomyłka rysunkowa, więc kontrola pomiarów o tym mówi

## Warstwy przegród i obliczanie U

- Baza **63 materiałów** ze współczynnikami λ (izolacje, konstrukcja, wykończenia, podkłady, pustki powietrzne)
- Składam przegrodę z warstw: materiał z listy + **grubość wpisuję sam**
- Program liczy: `R warstwy = grubość/λ`, `U = 1/(Rsi + ΣR + Rse)`
- **v44 — typ przegrody.** Lista 13 typów jak w ArCADia-TERMOCAD (ściana zewnętrzna/wewnętrzna/na gruncie, dach, stropy, podłoga na gruncie, okna, drzwi). Typ podstawia Rsi i Rse z PN-EN ISO 6946, a przy stropie wewnętrznym dochodzi **typ stropu** (pod nieogrzewanym poddaszem 0,10/0,10 · nad piwnicami 0,17/0,17 · międzykondygnacyjny 0,10/0,10). Opory można nadpisać ręcznie
- **v44 — przegroda niejednorodna.** Zakładka Wycinek A / Wycinek B z szerokościami (np. rozstaw belek 0,90 m, belka 0,15 m). Liczone wg PN-EN ISO 6946: wycinki składane równolegle proporcjonalnie do szerokości; gdy oba mają ten sam układ warstw, liczona jest też granica dolna i wynik jest średnią z obu granic
- **v44 — opór pustki powietrznej z tabeli normy.** Wcześniej stałe 0,18 niezależnie od wszystkiego. Teraz zależy od grubości i kierunku strumienia (10 cm: w górę 0,16 · poziomo 0,18 · w dół 0,22). To była realna różnica — na stropie dawało U zaniżone o ok. 1,5%
- **v45 — opory przegród gruntowych poprawione.** Sprawdzone na prawdziwym pliku `.thb` z ArCADia-TERMOCAD (plik to ZIP z danymi w Protocol Buffers — da się z niego wyciągnąć definicje przegród). Podłoga na gruncie ma **Rse = 0,00**, nie 0,17; ściana na gruncie **Rse = 0,00**, nie 0,04. Przegroda stykająca się z gruntem nie ma oporu przejmowania po stronie zewnętrznej. Wcześniej U podłogi na gruncie wychodziło zaniżone o ok. 20%
- **Sprawdzone wzorce:** pięć przegród z pliku audytora (SZ1, SZ2, SZ3, PG, SG) liczy się teraz **co do czwartego miejsca po przecinku** tak samo jak w programie obliczeniowym. Testy trzymają te wartości na stałe
- **v44 — szablony przegród.** ⭐ Zapisz jako szablon zapamiętuje warstwy, typ, opory i oba wycinki; przy kolejnej przegrodzie wybierasz z listy zamiast składać od nowa. Szablony żyją w pamięci tabletu, między audytami
- **Inny (wpisz własny)** — materiał spoza bazy; pyta o nazwę i λ. Bez λ liczy się tylko do opisu
- **📋 Kopiuj z innej** — bo SZ2 zwykle różni się od SZ1 tylko grubością ocieplenia
- Stary sposób opisu przegród (listy „wybierz budowę" / „wybierz izolację") **został usunięty w v40**. W sekcji 3 przy każdej przegrodzie są tylko: **🧱 Warstwy**, **opis własny**, **grubość** i **U**. Grubość i U wypełniają się po złożeniu warstw, obie można nadpisać ręcznie
- Archiwalne kopie zapasowe zrobione starszą wersją **nadal się drukują** — pola starego modelu są czytane przy generowaniu raportu (i w `Kod.gs`), ale nigdzie już nie są zapisywane

## Zgodność z rozporządzeniami (v46)

Dokumenty nadrzędne, ważniejsze niż ArCADia: **Dz.U. 2022 poz. 2816** (karta audytu energetycznego) i **Dz.U. 2023 poz. 697** (wzór świadectwa + tabela wi). Oba są w plikach projektu.

- **Sprawności składowe.** Karta audytu (części 3 i 4) wymaga **czterech** sprawności osobno: wytwarzania, przesyłu, regulacji i wykorzystania, akumulacji — plus współczynniki przerw w ogrzewaniu w tygodniu i w ciągu doby. Aplikacja zbierała jedną. Teraz zbiera komplet dla c.o. i dla c.w.u.; sprawność wytwarzania nadal podpowiada się z bazy urządzeń
- **Nośnik energii i wi.** Tabela 1 z Dz.U. 2023 poz. 697 pkt 3.1.3, 15 pozycji. Wybór nośnika podstawia wi, ale wartość można nadpisać — dostawca ciepła sieciowego wyznacza własną
- **Wentylacja (część 5 karty).** Doszły: sposób doprowadzenia i odprowadzenia powietrza, strumień powietrza zewnętrznego [m³/h], krotność wymian [1/h]
- **Dane ogólne (część 1 karty).** Doszły: konstrukcja/technologia, liczba kondygnacji, liczba lokali mieszkalnych, liczba osób użytkujących budynek, temperatura wewnętrzna
- Wszystkie pola są **opcjonalne** — pusty raport wygląda jak dotąd, wiersze pojawiają się tylko wtedy, gdy coś wpiszesz

**Czego rozporządzenia NIE rozstrzygają:** ani jedno, ani drugie nie podaje oporów przejmowania R<sub>si</sub>/R<sub>se</sub> ani metody liczenia U — to jest w PN-EN ISO 6946, przywołanej przez warunki techniczne. Więc w sporze o U punktem odniesienia zostaje norma i plik `.thb`, nie te rozporządzenia.

## Źródła ciepła i c.w.u.

- Wspólna baza **28 urządzeń** ze sprawnościami (pompy ciepła mają COP), ale **dwa osobne miejsca** w formularzu
- Po wybraniu urządzenia sprawność wpisuje się sama; można nadpisać
- Osiem pozycji dopisałem sam (pompy ciepła, ekogroszek, olejowy, elektryczne, kominek, sieć ciepłownicza) — oznaczone w bazie jako dopisane, **wartości do weryfikacji**

## Dalmierz Leica DISTO (X3/X4) — DZIAŁA

- Web Bluetooth; program nasłuchuje **wszystkich** kanałów urządzenia (protokół Leiki nie jest opublikowany)
- Odczyt trafia do pola, które jest otwarte: prowadzony pomiar (z auto-przejściem do następnej ściany), wymiarowanie, otwory (przeliczane na cm), miarka
- **Prostokątny pokój = dwa naciśnięcia przycisku na dalmierzu**
- **Wymaga instalacji aplikacji z adresu https** (menu ⋮ → Zainstaluj aplikację). Z pliku otwartego z pamięci tabletu przeglądarka blokuje Bluetooth. **Po instalacji działa offline, razem z dalmierzem**

## Praca na dwóch tabletach

- Rola ustawiana w ustawieniach: **Audytor** (pełna aplikacja) / **Pomocnik** (dane klienta + szkicownik, bez sekcji 2, 3, 4 i podpisu)
- **Kod zlecenia** (6 znaków) łączy oba tablety
- Offline pracujemy niezależnie; przy internecie pomocnik wysyła (**📤 Wyślij do audytora**), tablet audytora pobiera — także **automatycznie** przy uruchomieniu
- Nic się nie dubluje, nazwy szkiców w razie kolizji dostają dopisek „(pomocnik)"

## Kontrola pomiarów

Panel pod szkicem, liczony lokalnie (bez AI, offline). Trzy poziomy: **⛔ sprzeczności** (suma odcinków ≠ ściana, otwór szerszy od ściany, powtórzony numer, pomieszczenia na sobie, osierocone oznaczenia przegród), **⚠️ do sprawdzenia** (pomiar odbiegający od proporcji rysunku, wartości poza zakresem, piętro większe od parteru), **ℹ️ braki**. Nie blokuje pracy; przy zapisie pokazuje podsumowanie.

## Kopie i przenoszenie

- **v42 — pasek zapełnienia pamięci.** Wszystkie audyty siedzą w `localStorage` (ok. 5 MB). Od 70% zapełnienia na pulpicie pojawia się ostrzeżenie z przyciskiem kopii zapasowej, od 85% zmienia się w czerwony alarm i raz na uruchomienie wyskakuje komunikat. Wcześniej dowiadywałeś się dopiero wtedy, gdy zapis się nie udał — w połowie audytu
- **v42 — kolory pomieszczeń w Dokumencie Google.** Nieogrzewane na czerwono, klimatyzowane na niebiesko były tylko w karcie obiektu i w PDF; w edytowalnym Dokumencie tabela była szara
- **💾 Pobierz Kopię Zapasową** / **📂 Wczytaj Kopię** — pamięć jest przypisana do adresu, więc przy zmianie hostingu trzeba przenieść raporty tą drogą. Ponowne wczytanie nie dubluje

---

# 4. Układ raportu (ustalony, nie zmieniać bez potrzeby)

1. Dane ogólne i budynek
2. Instalacje
3. **Przegrody budowlane** — przekrój + opis warstw **obok rysunku** (materiał, grubość, suma, U). Bez zbiorczej tabeli
4. **Preferencje inwestora** — zielona ramka, wyróżnione, żeby dało się znaleźć przy przewijaniu
5. **Szkice** — rzut z **tabelą pomieszczeń obok**, tabela otworów pod rysunkiem
6. Podsumowanie powierzchni
7. Ściany — zestawienie długości, z podziałem na szkice
8. **Uwagi audytora** — pole tekstowe w sekcji 4 formularza (v47). Przycisk **➕ Dopisz z datą** wstawia stempel, żeby dało się notować w kilku momentach wizyty. Puste pole = w raporcie zostaje wolne miejsce na dopiski odręczne, jak było
9. Potwierdzenie i podpisy

**W tabelach:** pomieszczenia **nieogrzewane na czerwono**, **klimatyzowane na niebiesko**.

**PDF na Dysku powstaje z karty obiektu** (ładniejszy układ), Dokument Google zostaje jako wersja do edycji.

---

# 5. Co zostało do zrobienia

## ~~Materiały do dodania~~ — ZROBIONE (v39)

Dopisane 27.08.2026: **Żużel paleniskowy** (λ 0,25 · Podkład), **Papa asfaltowa** (λ 0,18 · Wykończenie),
**Płyta pilśniowa miękka** (λ 0,07 · Izolacja), **Eternit — płyta azbestowo-cementowa** (λ 0,35 · Wykończenie).
Wszystkie mają w bazie flagę `dodane: true`, a w `materialy.json` pole `_do_weryfikacji`.

## Do weryfikacji

- **λ czterech nowych materiałów** — wartości typowe z tabel, nie z Twojego skanu. Najbardziej niepewny jest **żużel paleniskowy**: 0,25 dotyczy materiału suchego, zawilgocony w podłodze na gruncie ma 0,30–0,45. Eternit spotyka się w zakresie 0,35–0,95 (wpływ na U pomijalny przy 6 mm).
- **Grupa żużla** — wpisany do „Podkład" (obok piasku), nie do „Izolacja". Do zmiany jednym słowem, jeśli szukasz go gdzie indziej.
- „Grzałka elektryczna w zasobniku c.w.u." jest w źródle oznaczona jako **odnawialna** — nietypowe, może błąd w tabeli źródłowej
- Sprawności ośmiu dopisanych przeze mnie źródeł (pompy ciepła itd.)

## Pomysły niezrealizowane

- Zdjęcia z aparatu przypisane do pomieszczeń/przegród
- Obliczenia strat ciepła z U i powierzchni
- Nieograniczone płótno (obecnie 60×60 m przy 50 px/m)

---

# 6. Jak ze mną pracować

- **Piszemy po polsku.**
- Przy dłuższych zadaniach **podejmuj decyzje sam**, pytania zadaj później — nie zatrzymuj się na drobiazgach.
- Testuj zmiany przed wysłaniem plików. W repozytorium jest katalog `tests/` — uruchamia się przez `node tests/uruchom-wszystkie.js`, bez instalowania czegokolwiek:
  - `test-warstwy.js` — baza materiałów i źródeł, zgodność z plikami JSON, obliczenia U, numer wersji w `sw.js`, brak adresu `/exec` w paczce (493 sprawdzenia)
  - `test-paczka.js` — składnia wszystkich skryptów w `index.html`, kluczowe funkcje, powtórzone `id`, kompletność plików PWA (31 sprawdzeń)
  - `test-pomiary.js` — **silnik wymiarowania, kontrola pomiarów i przegrody warstwowe** (57 sprawdzeń). Ładuje całe `index.html` do sztucznej przeglądarki i wywołuje prawdziwe `recalculateRooms` i `runAuditChecks`, więc testuje kod, który trafia na tablet, a nie jego kopię. Potrzebuje jednorazowo `npm install`; bez tego jest pomijany, reszta i tak się wykona.
  - `test-obrysy.js` — domykanie obrysów i powierzchnie przy niedokładnym rysowaniu (39 sprawdzeń)
  - `test-rzuty.js` — dwa prawdziwe układy z audytów: obrys L z 7 pomieszczeniami i 9 pomieszczeń w trzech pasach. Ściany rysowane przez prawdziwe przyciąganie, wymiary wpisywane odcinek po odcinku. Powierzchnie porównywane z polem liczonym niezależnie wzorem Gaussa, nie z liczbami odczytanymi z rysunku (10 sprawdzeń)
  - **Do odbudowania:** eksport raportu, wymiana między tabletami, dalmierz.
- Po każdej zmianie przygotuj **gotową paczkę na GitHub** (bez adresu `/exec` i identyfikatorów) oraz `Kod.gs`, jeśli zmieniał się backend.
- **Podbijaj numer wersji w `sw.js`** (teraz v47), żeby tablety pobrały nową wersję.

---

# 7. Pliki do wgrania w nowym czacie

| Plik | Po co |
|---|---|
| **`index.html`** | cała aplikacja — bez tego nie da się nic zmienić |
| **`Kod.gs`** | backend Apps Script |
| **`PRZEKAZANIE-PROJEKTU.md`** | ten dokument |
| **`INSTRUKCJA.md`** | podręcznik użytkownika, opisuje wszystkie funkcje |
| `materialy.json` | baza materiałów w czytelnej formie (do uzupełniania) |
| `tests/` | zestawy testów uruchamiane Node'em |
| `zrodla.json` | baza źródeł ciepła z uwagami i brakami |
| `manifest.json`, `sw.js`, ikony | tylko jeśli będą zmieniane — inaczej można pominąć |

**Minimum:** `index.html` + `Kod.gs` + ten dokument.

> Uwaga: `index.html` w paczce dla GitHuba ma **pusty** `DEFAULT_API_URL`. To celowe. Wersja z moim adresem jest tylko na tabletach.
