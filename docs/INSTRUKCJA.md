# Smart Energy Audyty — instrukcja

Wersja aplikacji: **2026.08.05**. Ta instrukcja zastępuje wszystkie poprzednie — zaczynamy od zera.

---

# CZĘŚĆ I — WDROŻENIE

Aplikacja składa się z dwóch niezależnych części:

| Część | Gdzie mieszka | Co robi |
|---|---|---|
| **Aplikacja** | Netlify (adres `https://...`) | rysowanie, formularz, raporty na tablecie |
| **Backend** | Google Apps Script | tworzy folder klienta na Dysku i generuje dokumenty |

Łączy je jeden **adres wdrożenia** kończący się na `/exec`. Większość problemów z wysyłką na Dysk bierze się z tego, że ten adres jest nieaktualny — dlatego wpisuje się go teraz **wewnątrz aplikacji**, a nie w kodzie.

---

## Etap 1 — Backend (Google Apps Script)

**Robisz to raz.** Potrzebne pliki: `Kod.gs`.

1. Wejdź na `script.google.com` → **Nowy projekt**.
2. Nazwij projekt, np. „Smart Energy Audyty".
3. Zaznacz całą zawartość pliku `Kod.gs` w edytorze (Ctrl+A) i wklej zawartość mojego pliku `Kod.gs`.
4. Sprawdź dwie pierwsze linie konfiguracji i wpisz swoje identyfikatory:
   - `SHEET_ID` — arkusz Google, w którym ma powstawać rejestr audytów.
     Bierzesz go z adresu arkusza: `docs.google.com/spreadsheets/d/`**`TO_JEST_ID`**`/edit`
   - `PARENT_FOLDER_ID` — folder na Dysku, w którym mają powstawać foldery klientów.
     Bierzesz go z adresu folderu: `drive.google.com/drive/folders/`**`TO_JEST_ID`**
5. Zapisz (ikona dyskietki).

### Autoryzacja

6. Przy przycisku **▶ Uruchom** wybierz z listy funkcję **`doGet`** i kliknij **Uruchom**.
7. Pojawi się **Autoryzacja wymagana** → **Przejrzyj uprawnienia** → wybierz swoje konto.
8. Ostrzeżenie „Google nie zweryfikował tej aplikacji" jest normalne dla własnych skryptów:
   **Zaawansowane** → **Przejdź do [nazwa projektu] (niebezpieczne)** → **Zezwól**.
9. W **Dzienniku wykonywania** powinno pojawić się „Ukończono wykonywanie" bez błędu.

### Wdrożenie

10. Prawy górny róg: **Wdróż** → **Nowe wdrożenie**.
11. Kliknij koło zębate przy „Wybierz typ" → **Aplikacja internetowa**.
12. Ustaw:
    - **Wykonaj jako:** Ja
    - **Kto ma dostęp:** **Wszyscy** ← bez tego tablet dostanie ekran logowania
13. **Wdróż** → skopiuj **adres aplikacji internetowej** (kończy się na `/exec`). Zachowaj go — wpiszesz go w Etapie 3.

---

## Etap 2 — Aplikacja (Netlify)

**Potrzebne pliki:** cała zawartość folderu `netlify-smart-energy` (7 plików: `index.html`, `manifest.json`, `sw.js` i cztery obrazy).

1. Wejdź na `app.netlify.com/drop`.
2. Przeciągnij tam **folder** (albo plik ZIP, który sam się rozpakuje).
3. Po chwili dostaniesz adres `https://coś-tam.netlify.app` — to Twoja aplikacja.
4. Otwórz ten adres w Chrome na tablecie.
5. Menu (⋮) → **Zainstaluj aplikację** — na pulpicie pojawi się ikona Smart Energy.

> **Ważne:** zapisz sobie ten adres. Przy każdej kolejnej aktualizacji wchodzisz na ten sam projekt w Netlify i wgrywasz nowy folder, dzięki czemu adres się nie zmienia i nie musisz nic przestawiać na tablecie.

---

## Etap 3 — Połączenie obu części

1. Otwórz aplikację na tablecie.
2. Na pulpicie, pod listą projektów: **Połączenie z Dyskiem Google** → **Pokaż**.
3. Wklej adres `/exec` z Etapu 1 punkt 13.
4. **Zapisz adres**, a potem **🔌 Testuj połączenie**.
5. Powinno pojawić się zielone **✅ Połączenie działa**.

Adres zapisuje się na urządzeniu — robisz to raz na każdym tablecie.

---

## Aktualizacja w przyszłości

| Co zmieniam | Co robię |
|---|---|
| Tylko `index.html` (najczęściej) | Wgraj nowy folder na Netlify. Nic więcej. |
| Także `Kod.gs` | Wklej nowy kod → **Wdróż → Zarządzaj wdrożeniami → ołówek → Wersja: Nowa wersja → Wdróż**. Adres `/exec` zostaje ten sam. |

> Jeśli po zmianie `Kod.gs` pojawi się błąd o uprawnieniach — powtórz **Etap 1, punkty 6–9**. Dzieje się tak, gdy nowa funkcja potrzebuje dostępu do kolejnej usługi Google; to jednorazowe.

---

# CZĘŚĆ II — CODZIENNA PRACA

## Pulpit

- **➕ Nowy Raport** — start audytu
- **✏️ Edytuj** — powrót do raportu; szkice wracają w tym samym kadrze
- **📄 Raport (.doc)** — plik do pamięci tabletu: logo, tabele, szkice, podpis. Otwierasz w Dokumentach Google lub Wordzie i dopisujesz wnioski. **Działa bez internetu.**
- **🖼️ Karta obiektu** — jednostronicowe podsumowanie `.html` z kafelkami i tabelami. Do wysłania mailem lub druku.
- **🚀 Wyślij na Dysk** — tworzy folder klienta (patrz niżej). Wymaga internetu.
- **💾 Pobierz Kopię Zapasową** — cała baza w jednym pliku JSON.
- **📂 Wczytaj Kopię** — dokłada raporty z takiego pliku do tych, które już są na urządzeniu.

> **Przenosiny na nowy adres aplikacji.** Pamięć przeglądarki jest przypisana do adresu, więc instalacja spod nowego adresu (np. z Netlify na GitHub Pages) startuje z **pustą listą raportów** — stare nie znikają, po prostu zostają przy starej ikonie. Żeby je przenieść: w starej wersji **💾 Pobierz Kopię Zapasową**, w nowej **📂 Wczytaj Kopię**. Przechodzą razem ze szkicami, pomiarami i podpisami. Ponowne wczytanie tej samej kopii niczego nie zdubluje.

> **Przegrody obok rysunku.** Jeśli na szkicu oznaczyłeś przegrody (SZ1, D1…), w raporcie **obok tego rysunku** pojawia się tabela z ich opisem: oznaczenie, rodzaj, budowa (materiał, grubość, ocieplenie, uwagi) i współczynnik U. Czytając raport nie trzeba wracać do sekcji 3, żeby sprawdzić, co oznacza SZ1. Oznaczenie bez opisu jest wypisane z adnotacją „nie opisano".

> Pod każdym szkicem w raportach jest też **zestawienie długości ścian**: oznaczenie, pomieszczenie, położenie, długość i informacja, czy była zmierzona, czy wyliczona. Dzięki temu sprawdzisz wymiar, którego nie widać na rysunku, bez otwierania aplikacji. Liczba wymiarów **na samym szkicu się nie zmienia**.

> **Jak rozpoznać ścianę.** Każda dostaje oznaczenie złożone z numeru pomieszczenia i litery: `1a`, `1b`, `1c`… Te same etykiety są naniesione **na rysunku w raporcie** — drobne, szare, odsunięte do wnętrza pomieszczenia. Dodatkowo w tabeli jest kolumna **Położenie** (górna, dolna, lewa, prawa, skos), więc ścianę znajdziesz nawet bez wpatrywania się w etykiety.
>
> Podczas pracy w aplikacji oznaczenia są **ukryte**, żeby nie zaśmiecać szkicu. Włącza je przycisk **🔤 Ozn. ścian** — przydaje się, gdy chcesz coś skonfrontować z tabelą.

> W raportach **tabela pomieszczeń stoi obok szkicu**, a nie pod nim — rysunek i zestawienie widzisz naraz. Nad każdym szkicem podana jest jego wysokość kondygnacji.

### Co powstaje w folderze klienta na Dysku

1. Raport w **Dokumentach Google** — edytowalny, z logo w nagłówku
2. Ten sam raport w **PDF** — wersja dla klienta
3. **Karta obiektu** `.html`
4. **Szkice PNG** — po jednym na zakładkę
5. **podpis-klienta.png**
6. **dane-audytu.json** — kopia surowych danych
7. plus wiersz w arkuszu-rejestrze z linkami do wszystkich powyższych

> **Karta obiektu w podglądzie Dysku wygląda jak kod** — to normalne, Dysk nie renderuje plików HTML. Pobierz plik i otwórz go dwuklikiem, wtedy zobaczysz gotową kartę.

---

## Szkicownik

Zakładki u góry to kolejne rysunki (parter, piętro, przekrój). **➕ Dodaj** tworzy nową, **Kopiuj** powiela bieżącą.

### Narzędzia

| Narzędzie | Do czego |
|---|---|
| 🖱️ **Wybierz** | przesuwanie narożników ścian |
| 📏 **Ściana** | rysowanie ścian; linie prawie proste same się prostują, końce przyciągają się do istniejących. Podczas ciągnięcia widać **przybliżoną długość** (np. `~4.00 m`) — jak w programach CAD |
| ✍️ **Wymiaruj** | wpisanie wartości z dalmierza dla ściany |
| 🫥 **Ukryj** | schowanie pojedynczej, zbędnej miarki |
| 🚪 **Otwór** | okna i drzwi |
| 🏷️ **Przegroda** | oznaczanie przegród na przekroju |
| 🏠 **Pomieszcz.** | oznaczenie pomieszczenia (numer, nazwa) |
| 📐 **Skos** | rysowanie skosów poddasza z wymiarami |
| ✏️ **Ołówek** | rysowanie odręczne |
| 📐 **Miarka** | prosta linia z ręcznym opisem (patrz niżej) |
| 🧽 **Usuń** | kasowanie ścian, otworów, miarek |
| 🔤 **Txt** | podpis tekstowy |
| 🎯 **Pomiar** | prowadzony pomiar — program sam mówi, które ściany zmierzyć |
| 📐 **Ściany** | lista ścian wg pomieszczeń — precyzyjny wybór bez celowania palcem |
| 🩺 **Diagnostyka** | szuka przyczyn, gdy pomieszczenie nie chce się domknąć |
| 👁️ **Wymiary** | pokaż/ukryj wszystkie wymiary — **osobno dla każdej zakładki, działa też na raport** |

### Kolejność pracy: najpierw cały rzut, potem pomieszczenia

Rysowanie ścian **nie tworzy już pomieszczeń samo z siebie**. Dzięki temu możesz spokojnie narysować cały rzut — także dokładać ścianki działowe i dzielić duże pomieszczenia — bez tego, że aplikacja co chwilę pyta o typ pokoju, a stare, zbyt duże obrysy zostają w tle (to właśnie powodowało nachodzące się numery i zawyżoną sumę powierzchni).

Gdy rzut jest gotowy:

1. Włącz **🏠 Pomieszcz.**
2. Kliknij **w środku** pomieszczenia — program analizuje cały rysunek i sam rozpoznaje jego kształt, wybierając najmniejszy zamknięty obszar wokół kliknięcia.
3. Podaj numer i typ. Numer proponuje się sam, można też wpisać już istniejący.
4. Jeśli brakuje pomiarów, **od razu otwiera się prowadzony pomiar** (patrz niżej).

Ponowne kliknięcie w opisane pomieszczenie pozwala poprawić numer lub typ. Kliknięcie w miejscu, które nie jest zamknięte ścianami, tworzy zwykły znacznik ręczny — jak dotąd.

### Poprawianie pomieszczeń

W tabeli pod szkicem każde pomieszczenie ma przyciski **✏️** i **🗑️**. Edycja otwiera to samo okno co przy zakładaniu — możesz zmienić numer, typ, ogrzewanie i klimatyzację. Jeśli pomieszczenie leży na innej zakładce, program sam ją otworzy.

Usunięcie kasuje wyłącznie opis i powierzchnię — **ściany zostają na rysunku**. To samo osiągniesz, klikając w pomieszczenie narzędziem 🏠 Pomieszcz.

### Podgląd długości podczas rysowania

Gdy ciągniesz ścianę, na jej środku widać przybliżoną długość odczytaną z rysunku, poprzedzoną tyldą: `~4.00 m`. Pomaga to złapać proporcje, żeby szkic z grubsza odpowiadał rzeczywistości.

**To wyłącznie pomoc przy szkicowaniu.** Wartość znika po puszczeniu palca, nigdzie się nie zapisuje i nie ma żadnego wpływu na wymiarowanie, powierzchnie ani raporty. Prawdziwe wymiary nadal wpisujesz z dalmierza — tylda przypomina, że to tylko oszacowanie z rysunku.

### Odległość od narożnika

Najedź na **już narysowaną** ścianę (w trybie 📏 Ściana, 🖱️ Wybierz albo ✍️ Wymiaruj), a program pokaże, jak daleko jesteś od **bliższego narożnika** — z przerywaną linią od tego narożnika do kursora. Po przekroczeniu połowy ściany punkt odniesienia sam przeskakuje na drugi koniec, tak jak przy przykładaniu taśmy.

Jeśli ściana ma już wpisany wymiar, odczyt jest do niego przeskalowany — przy ścianie zmierzonej na 8 m połowa pokaże 4 m, niezależnie od tego, jak długa jest kreska na rysunku. Podpowiedź nie trafia do raportu i niczego nie zapisuje.

### 🔍 Kontrola pomiarów

Pod szkicem jest panel, który po każdym wpisanym pomiarze sprawdza dane pod kątem sprzeczności. Wszystko liczone lokalnie, **działa bez internetu**.

Trzy poziomy:

- **⛔ Sprzeczności** — dwie liczby wykluczają się nawzajem: suma odcinków inna niż długość całej ściany, otwór szerszy od ściany, powtórzony numer pomieszczenia, suma pomieszczeń większa od obrysu budynku, ręczny pomiar skosu sprzeczny z wyliczonym, pomieszczenia nachodzące na siebie.
- **⚠️ Do sprawdzenia** — możliwe, ale rzadkie: pomiar mocno odbiegający od proporcji rysunku (łapie zgubiony przecinek albo zero), wartości poza zakresem (ściana <0,3 m lub >30 m, wysokość kondygnacji poza 1,8–5 m, otwór poza 30–400 cm), okna zajmujące ponad połowę ścian pomieszczenia, powierzchnia ponad 3× większa od pozostałych, pomieszczenie bez żadnego otworu, wyższa kondygnacja większa od parteru o ponad 20%.
- **ℹ️ Braki** — niedokończona robota: brak kompletu pomiarów, brak współczynnika U przy otworze, rzut bez opisanych pomieszczeń, brak wysokości kondygnacji.

Przy każdej uwadze jest 🔎 — przenosi widok na sporne miejsce, także na inną zakładkę.

**Uwagi nie blokują pracy.** Przy zapisie raportu dostajesz podsumowanie i decydujesz sam — czasem budynek naprawdę jest nietypowy. Blokują tylko te rzeczy, które blokowały dotąd: brak wysokości kondygnacji i nieopisane przegrody.

### 📐 Skosy poddasza

Osobny rodzaj szkicu do inwentaryzacji poddasza ze skosami.

**Przebieg pracy:**

1. Zmierz pokoje na poddaszu normalnie, w rodzaju **Rzut kondygnacji**.
2. **📄 Kopiuj** — program pyta o nazwę i proponuje „… — skosy". Nazwa ze słowem *skos* albo *poddasze* **automatycznie przestawia Rodzaj na „Przekrój poddasza (skosy)"**.
3. **🧹 Wyczyść dane** — usuwa skopiowane opisy i zostawia sam rysunek ścian. (Przycisk działa przy każdym rodzaju szkicu, nie tylko tutaj.)
4. Włącz **📐 Skos** i przeciągnij linię wzdłuż skosu — jak przy rysowaniu ściany. Kolor wybierasz z palety obok narzędzia.
5. Program od razu pyta o wymiary. Kolejne skosy dostają oznaczenia **A, B, C…**

**O co pyta program:**

| Wymiar | Skąd |
|---|---|
| **Długość skosu** | z rzutu — wzdłuż ściany |
| **Szerokość** | z rzutu — od ścianki kolankowej do końca skosu |
| **Wysokość ścianki kolankowej** | z przekroju |
| **Wysokość kondygnacji** | z przekroju (podpowiadana ze szkicu) |
| **Długość połaci** | z przekroju — skośna, po dachu |

Program liczy z tego **powierzchnię rzutu skosu** (długość × szerokość) i **powierzchnię połaci** (długość × połać). Obie trafiają do tabeli pod szkicem i do raportów.

**To wymiary rzeczywiste** — rysunek pozostaje szkicem, tak samo jak przy ścianach. Kliknięcie w narysowany skos pozwala poprawić dane albo go usunąć; gumka 🧽 też działa.

> Szkic tego rodzaju **nie wchodzi do bilansu powierzchni budynku** — kondygnację masz już policzoną na rzucie.

### ▨ Obszary pod skosem (kreskowanie)

Na poddaszu zwykle część powierzchni jest pod skosem. Zamiast rysować ukośne kreski ołówkiem:

1. Skopiuj szkic rzutu (**📄 Kopiuj**) i nazwij kopię np. „Poddasze — skosy".
2. Dorysuj linię 📏 Ściana tam, gdzie kończy się część pod skosem.
3. Włącz **▨ Skos** i kliknij **wewnątrz** obszaru — program wypełni go kreskowaniem i poprosi o opis.

Ponowne kliknięcie w zakreskowany obszar pozwala zmienić opis; pusty opis go usuwa. Gumka 🧽 też działa.

**To oznaczenie graficzne.** Kreskowanie trafia na rysunek w raporcie i na listę „Obszary pod skosem", ale **nie zmienia powierzchni pomieszczeń** ani wymiarów — dokładnie jak wcześniej kreski ołówkiem, tylko czytelniej.

> **Drobne szczeliny nie przeszkadzają.** Program traktuje końce ścian oddalone o kilka pikseli jak stykające się, więc pomieszczenie rozpozna się nawet wtedy, gdy przy rysowaniu palcem róg nie trafił idealnie. Sam rysunek zostaje bez zmian.

> Jeśli kliknięcie nic nie daje, obszar nie jest domknięty ścianami — dorysuj brakującą linię i spróbuj ponownie.

### 📡 Dalmierz Leica DISTO (X3 i X4)

Pomiar z dalmierza wpada prosto do aplikacji — nie musisz przepisywać liczb.

**Zanim zaczniesz — ważne.** Przeglądarki blokują Bluetooth stronom otwartym z pliku (`file://`, `content://`). Nie da się tego obejść po stronie aplikacji: to zabezpieczenie przeglądarki, identyczne w każdej.

**Ale praca offline z dalmierzem jest jak najbardziej możliwa** — trzeba tylko raz zainstalować aplikację zamiast otwierać pobrany plik:

1. Otwórz aplikację pod jej **adresem internetowym** (Netlify albo GitHub Pages).
2. Menu ⋮ → **Zainstaluj aplikację**.
3. Od tej pory uruchamiasz ją **z ikony na pulpicie**.

Tak zainstalowana aplikacja **działa bez internetu w całości**: szkicownik, pomiary, raporty **i dalmierz**. Internet jest potrzebny tylko przy instalacji, aktualizacjach i wysyłce na Dysk. Plik pobrany do Pobranych zostaw sobie najwyżej jako kopię awaryjną — do pracy z dalmierzem się nie nadaje.

Na Androidzie musi być jeszcze włączony Bluetooth i lokalizacja (system wymaga jej do wyszukiwania urządzeń).

**Połączenie:**

1. W dalmierzu włącz Bluetooth (menu ustawień urządzenia, tryb dla aplikacji DISTO Plan).
2. W aplikacji: **📡 Dalmierz** → **Połącz**.
3. Z listy wybierz swój dalmierz (nazwa zaczyna się od `DISTO`) → **Sparuj**.
4. Zielony pasek oznacza, że połączenie działa. Przycisk 📡 w pasku narzędzi też robi się zielony.

**Jak to działa w terenie.** Pomiar trafia do tego pola, które masz akurat otwarte:

| Otwarte okno | Co się dzieje |
|---|---|
| 🎯 Prowadzony pomiar | wartość zapisuje się i program **sam przechodzi do następnej ściany** |
| ✍️ Wymiaruj (okno wymiaru) | wpisuje się do pola pomiaru |
| 🚪 Otwór | pierwszy strzał → szerokość, drugi → wysokość (**przeliczane na centymetry**) |
| 📐 Miarka | wpisuje się jako opis miarki |
| nic otwartego | wyskakuje powiadomienie z wartością, żeby nie przepadła |

Dzięki temu prostokątny pokój to **dwa naciśnięcia przycisku na dalmierzu** — bez dotykania tabletu.

Automatyczne przechodzenie można wyłączyć w panelu dalmierza, jeśli wolisz najpierw zobaczyć wartość i zatwierdzić ją ręcznie.

**Gdy pomiary nie docierają.** Program nasłuchuje **wszystkich** kanałów urządzenia, więc samo połączenie zwykle wystarcza. Jeśli mimo to nic nie wpada:

1. Otwórz panel **📡 Dalmierz** i zrób jeden pomiar.
2. Popatrz na **Ostatnia ramka z urządzenia** — jeśli pojawiają się tam liczby, dane docierają i problem jest tylko w odczycie.
3. Jeśli ramka pozostaje pusta, sprawdź w ustawieniach dalmierza tryb Bluetooth: musi być ustawiony dla aplikacji (**DISTO Plan / Bluetooth Smart**), a nie tryb klawiatury czy transferu do komputera.
4. Przyciskiem **Skopiuj podgląd** wyślij mi listę kanałów — dopasuję odczyt do Twojego egzemplarza.

### 🎯 Prowadzony pomiar — najszybsza droga

Po narysowaniu rzutu **nie musisz się zastanawiać, co zmierzyć**. Kliknij **🎯 Pomiar** (albo, w trybie ✍️ Wymiaruj, po prostu stuknij kółko z numerem pomieszczenia). Program:

1. podświetla pierwszą ścianę na niebiesko i podpisuje ją na rysunku **„MIERZ TĘ ŚCIANĘ"**,
2. najeżdża na nią kamerą tak, żeby wypadła **nad panelem**, nie za nim,
3. czeka na liczbę — wpisujesz odczyt i naciskasz **OK ▶** (albo Enter),
4. sam przechodzi do następnej ściany, a po komplecie wylicza powierzchnię.

Panel siedzi przy dolnej krawędzi ekranu i nie przyciemnia rysunku. Przyciskiem **Zwiń** zmniejszysz go do samego pola wpisywania — wtedy widać jeszcze więcej rzutu.

Pod spodem masz listę wszystkich ścian pomieszczenia ze statusem: **zmierzone** (zielone), **obliczone** (pomarańczowe), **do pomiaru** (czerwone). Przyciskiem ✍️ możesz wrócić do dowolnej i poprawić wpis.

**Ściany łączone w ciągi.** Jeśli wzdłuż korytarza stoją ścianki działowe, program **nie pyta o 2,0 + 0,2 + 2,8** — pyta o jedną ścianę 5,0 m. Podziały wynikają z pomiarów sąsiednich pomieszczeń. Działa to też w drugą stronę: jeśli zmierzysz osobno wszystkie odcinki składowe, program sam je zsumuje i nie poprosi o cały ciąg.

### Jak liczy się powierzchnia

Program prosi **tylko o te pomiary, których naprawdę potrzebuje**:

- **Prostokąt** — wystarczy 1 bok poziomy i 1 pionowy (a i b), nie cztery.
- **Kształt L i inne wielokąty proste** — wszystkie ściany oprócz jednej na oś (licząc scalone ciągi, nie pojedyncze odcinki).
- **Jeden skos** (ucięty narożnik) — **nie wymaga pomiaru**. Pozostałe ściany wyznaczają go jednoznacznie, co do długości i kierunku.
- **Dwa skosy i więcej** (np. elewacja ze szczytem dachu) — sama podstawa i dwie wysokości nie wystarczą: podział między połacie zależałby od kąta odczytanego z odręcznego rysunku, a to nie jest pomiar. Masz dwie drogi:
  - **🏠 Szczyt dachu** (wygodniejsza) — w oknie 🎯 Pomiar podajesz **wysokość szczytu** i **odległość poziomą**, wskazując przyciskiem, czy mierzyłeś ją **od lewej czy od prawej krawędzi** (bierzesz tę, do której wygodniej dojść). Program sam wylicza obie połacie i pole. Wynik jest identyczny z ręcznym podziałem na dwa trapezy.
  - albo **zmierz jedną połać** — druga wyliczy się z zamknięcia figury. Jeśli mimo to coś tam wpiszesz, będzie to tylko notatka — na pole powierzchni nie wpłynie, a aplikacja pokaże różnicę.

Kolory wymiarów: **zielony** = wpisany z dalmierza, **pomarańczowy** = obliczony automatycznie z sąsiednich ścian, **czerwony** = wymaga pomiaru.

**Na rysunku widnieją wyłącznie wymiary rzeczywiste.** Ściana, której jeszcze nie zmierzyłeś i której nie da się wyliczyć, **nie dostaje żadnej liczby** — rysunek jest tylko szkicem, więc odczytana z niego długość nie mówiłaby nic o budynku (narysowane 7 m przy ścianie zmierzonej na 5 m tylko wprowadzało w błąd). W trybie ✍️ Wymiaruj taka ściana pokazuje **„?"**, żeby było w co kliknąć.

**Czytelność przy gęstym rzucie.** Etykiety wymiarów same się rozsuwają, żeby na siebie nie nachodziły — jeśli któraś musi odjechać od swojej kreski, program dorysowuje cienki odnośnik. Etykieta, dla której nie ma już miejsca, jest pomijana (sama kreska wymiarowa zostaje) — po przybliżeniu pojawia się z powrotem. Napisy mają stałą wielkość na ekranie, więc przy oddaleniu nie robią się mikroskopijne, a odcinki składowe długich ścian chowają się poniżej pewnego zbliżenia. W raporcie zawsze rysowane są wszystkie.

### 🏠 Pomieszczenia oznaczane ręcznie

Kiedy nie korzystasz z automatycznego obrysu, tylko sam wpisujesz wymiary narzędziem 📐 Miarka, użyj **🏠 Pomieszcz.**: klikasz w środek pomieszczenia na rysunku i podajesz numer, nazwę oraz — opcjonalnie — powierzchnię wyliczoną z ręki.

- **Numer nadaje się sam** (kolejny wolny), ale możesz wpisać już istniejący — np. dwa pokoje pod numerem 1. Przy wyborze istniejącego numeru aplikacja podpowie nazwę z tamtego pomieszczenia.
- Ponowne kliknięcie w znacznik pozwala go poprawić, gumka 🧽 kasuje.
- Na rysunku widać kółko z numerem, a pod nim nazwę i powierzchnię.

### Rodzaj szkicu

Obok zakładek wybierasz **Rodzaj: Rzut kondygnacji** albo **Przekrój / elewacja**.

- **Rzut** — obszary opisane narzędziem 🏠 to pomieszczenia: liczą się do powierzchni użytkowej i kubatury budynku.
- **Przekrój / elewacja** — obszary trafiają do **osobnej tabeli** („Obszary z przekroju / elewacji") i **nie są doliczane** do powierzchni ani kubatury. Wysokość kondygnacji nie jest tu wymagana, a przy zapisie obszaru program pyta tylko o numer i opis — bez typu pomieszczenia, ogrzewania i klimatyzacji (to dotyczy wyłącznie rzutów).

**Numeracja pomieszczeń jest osobna dla każdego szkicu** — parter 1–5, piętro znowu od 1.

### Wysokość kondygnacji

Obok zakładek jest pole **Wys. kondygnacji [m]** — **osobne dla każdego szkicu**. Rzut parteru dostaje swoją wysokość, rzut piętra swoją. Przy rysunku, dla którego wysokość nie ma znaczenia (np. przekrój), wpisz po prostu **0**.

**Bez podanej liczby zapis raportu jest blokowany**, a komunikat wymienia szkice, przy których jej brakuje — chodzi o to, żeby program o tym przypomniał. Z wysokości liczona jest **kubatura** każdego pomieszczenia (powierzchnia × wysokość kondygnacji) i suma dla całego szkicu.

### 📐 Szablony szkiców

Lista **📐 Wstaw szablon...** obok zakładek zawiera gotowe rysunki do dalszej edycji, pogrupowane na **Rzuty**, **Przekroje** i **Ściany** — m.in. rzut prostokątny, rzut w kształcie L, rzut z korytarzem, przekrój z dachem dwuspadowym, poddasze ze ściankami kolankowymi, stropodach, budynek piętrowy, warstwy ściany.

Szablon dorysowuje się **obok** tego, co już masz na szkicu — nic nie kasuje. Potem zwymiaruj go narzędziem ✍️ Wymiaruj (albo opisz 📐 Miarką) i dopasuj kształt, przeciągając narożniki w trybie 🖱️ Wybierz.

### 📐 Miarka

Do wymiarów, które są tylko notatką: wysokości w przekroju, długości połaci, cokolwiek naniesionego z ręki.

1. Wybierz kolor (czerwony, niebieski, zielony, czarny).
2. Przeciągnij po ekranie — powstaje linia ze strzałkami.
3. Aplikacja od razu pyta o wartość — wpisujesz co chcesz, np. `3,5 m`.

Miarka **nie wpływa na skalę ani na obliczenia**. Jest widoczna zawsze, także przy wyłączonym 👁️.

### Gdy pomieszczenie nie chce się domknąć

Najczęstsza przyczyna to druga ściana narysowana prawie dokładnie na innej. Aplikacja blokuje takie duplikaty przy rysowaniu, a **🩺 Diagnostyka** znajduje te, które już powstały — z przyciskiem 🔎 (pokaż) i Usuń.

---

## Otwory (okna i drzwi)

Narzędzie 🚪 **Otwór** → klikasz na ścianę.

W oknie dodawania widzisz **listę wszystkich już wpisanych otworów** z wymiarami i powierzchnią, pogrupowaną na okna, okna połaciowe, drzwi zewnętrzne i wewnętrzne. **Kliknięcie w pozycję z listy używa jej ponownie** — ten sam otwór w kilku miejscach dostaje ten sam identyfikator.

Jeśli mimo to wpiszesz wymiary, które już istnieją, aplikacja to zauważy i zaproponuje użycie istniejącego numeru zamiast tworzenia nowego.

W podsumowaniu pod każdym szkicem **powtarzające się otwory są zwinięte w jeden wiersz** z kolumną **Szt.** — trzy identyczne okna O1 to jeden wiersz z liczbą 3, powierzchnią jednej sztuki i powierzchnią razem. Na dole wiersz **RAZEM**, a pod spodem zestawienie kategoriami: ile sztuk i ile m² przypada na okna, ile na drzwi zewnętrzne i tak dalej. To samo trafia do karty obiektu i do raportów.

---

## Przegrody budowlane (sekcja 3)

Lista przegród do wypełnienia **buduje się z przekroju**, nie z gotowego zestawu:

1. Dodaj zakładkę szkicu, nazwij np. „Przekrój" i narysuj przekrój budynku.
2. Włącz 🏷️ **Przegroda** i kliknij ścianę na przekroju.
3. Wybierz rodzaj: **SZ** (ściana zewnętrzna), **S** (strop), **PG** (podłoga na gruncie), **D** (dach). Numer nadaje się sam — pierwszy dach to D1, kolejny D2.
4. W sekcji 3 pojawiają się do wypełnienia wyłącznie oznaczone przegrody.

### 🧱 Warstwy przegrody — U liczone automatycznie

Przy każdej przegrodzie jest przycisk **🧱 Warstwy**. Składasz przegrodę z materiałów, a program sam liczy współczynnik U.

1. Wybierz materiał z listy (ponad 50 pozycji: izolacje, konstrukcja, wykończenia, pustki powietrzne).
2. **Wpisz grubość w centymetrach** — sam, materiał jej nie narzuca.
3. **Dodaj**. Kolejność od wewnątrz na zewnątrz, strzałkami ▲▼ przestawiasz.

U pojawia się na bieżąco pod listą. Po **Zapisz i przepisz U** wartość trafia do pola przegrody i do raportów.

Liczone tak jak w programach do audytu: opór warstwy = grubość ÷ λ, a opory przejmowania ciepła dobierane po rodzaju przegrody (inne dla ściany, inne dla podłogi). Pustki powietrzne mają stały opór, więc ich grubość nie wpływa na wynik.

**📋 Kopiuj z innej** — większość ścian różni się tylko grubością ocieplenia, więc kopiujesz układ i poprawiasz jedną liczbę.

**Materiał spoza bazy.** Wybierz **Inny (wpisz własny)** — program zapyta o nazwę i o λ. Jeśli λ podasz, warstwa liczy się do U normalnie; jeśli nie, wchodzi tylko do opisu i grubości, a U trzeba wpisać ręcznie.

> Przegroda musi mieć **warstwy albo opis własny** — bez jednego z tych dwóch zapis raportu jest blokowany. Ręcznie wpisane U ma pierwszeństwo nad policzonym.

**W tabelach raportu** pomieszczenia **nieogrzewane są na czerwono**, a **klimatyzowane na niebiesko** — od razu widać, co wypada poza bryłą ogrzewaną.

### Konkretne urządzenie grzewcze

W sekcji 2, pod polami wyboru, są pola **Konkretne urządzenie** — osobno dla ogrzewania i osobno dla c.w.u., z tej samej listy 28 pozycji. Po wybraniu **sprawność wpisuje się sama** (przy pompach ciepła COP); można ją nadpisać. Obok pole na rok montażu i moc.

**Bez uzupełnienia budowy każdej oznaczonej przegrody zapis raportu jest blokowany** — komunikat wymienia brakujące symbole.

Pole **Opis** przydaje się przy „Inna budowa" — trafia do wszystkich raportów.

> Okien i drzwi **nie ma już w sekcji 3** — definiuje się je wyłącznie narzędziem 🚪 Otwór na szkicu, gdzie i tak podajesz wymiary, rodzaj i współczynnik U.

---

## Podpis klienta

Sekcja 6 raportu. Klient podpisuje palcem lub rysikiem; podpis trafia do `.doc`, karty obiektu, PDF i jako osobny plik PNG na Dysk.

---

## Autozapis

Co 30 sekund i przy każdym przełączeniu aplikacji w tło stan raportu ląduje w pamięci tabletu — godzinę ostatniego zapisu widać pod tytułem. Po awarii aplikacja zapyta, czy przywrócić przerwaną pracę.

---

# CZĘŚĆ IIA — PRACA NA DWÓCH TABLETACH

Dwie osoby mogą prowadzić inwentaryzację równolegle: jedna mierzy i rysuje, druga opisuje przegrody i instalacje. Oba tablety działają **offline**; dane łączą się dopiero przy internecie.

## Ustawienie ról (raz na tablet)

Pulpit → **Połączenie z Dyskiem Google** → **Rola tego tabletu**:

- **Audytor** — pełna aplikacja. Tworzy raport, pobiera szkice od pomocnika, wysyła wszystko na Dysk.
- **Pomocnik** — uproszczona aplikacja: dane klienta + cały szkicownik (rysowanie, pomieszczenia, otwory, pomiary). Znikają sekcje 2, 3, 4 i podpis klienta.

Oba tablety muszą mieć wpisany **ten sam adres wdrożenia** `/exec`.

## Kod zlecenia

W sekcji 1 każdy raport ma **Kod zlecenia** (6 znaków, np. `A7K2QD`). Przy nowym raporcie generuje się sam; przyciskiem **Nowy** można wylosować inny.

**Ten sam kod musi być na obu tabletach.** Najprościej: audytor zakłada raport, odczytuje kod, pomocnik wpisuje go u siebie w sekcji 1 — albo odwrotnie.

## Przebieg wizyty

1. **Bez internetu**: pomocnik rysuje rzuty i mierzy, audytor opisuje przegrody, instalacje i rysuje przekrój. Każdy zapisuje u siebie.
2. **Gdy jest internet** — pomocnik: **📤 Wyślij do audytora**. Można wysyłać wielokrotnie; kolejna wysyłka nadpisuje poprzednią, nic się nie dubluje.
3. **Audytor**: **📥 Pobierz od pomocnika** przy właściwym raporcie. Szkice pomocnika dokładają się do jego własnych — nic nie jest kasowane.
   - Dzieje się to też **automatycznie**: po uruchomieniu aplikacji z internetem tablet audytora sam sprawdza, czy są nowe dane dla raportów z kodem.
4. Audytor kończy opisy i wysyła komplet na Dysk (**🚀 Wyślij na Dysk**) — raport zawiera pracę obu osób.

**Zabezpieczenia:** te same szkice nie dołączą się dwa razy; jeśli obie osoby nazwały szkic tak samo, ten od pomocnika dostaje dopisek „(pomocnik)". Paczki wymiany lądują w folderze **WYMIANA (tablety)** na Dysku i są usuwane po scaleniu.

## Układ raportu

1. Dane ogólne i budynek
2. Instalacje
3. **Przegrody budowlane** — przekrój z opisem warstw obok (materiały z grubościami, suma, U)
   · PDF na Dysku powstaje teraz **z karty obiektu**, więc wygląda tak samo jak ona; Dokument Google zostaje jako wersja do edycji
4. **Preferencje inwestora** — wyróżnione zieloną ramką, łatwe do znalezienia przy przewijaniu
5. **Szkice** — rzut z tabelą pomieszczeń obok, tabela otworów pod rysunkiem
6. Podsumowanie powierzchni
7. Ściany — zestawienie długości, z podziałem na szkice
8. Uwagi audytora
9. Potwierdzenie i podpisy

# CZĘŚĆ III — GDY COŚ NIE DZIAŁA

## Wysyłka na Dysk nie działa

Zacznij zawsze od **Połączenie z Dyskiem Google → 🔌 Testuj połączenie**. Wynik testu wskaże przyczynę:

| Komunikat | Przyczyna i naprawa |
|---|---|
| ✅ Połączenie działa | Backend jest w porządku — problem leży gdzie indziej, patrz niżej |
| ❌ Google prosi o logowanie | We wdrożeniu **Kto ma dostęp** nie jest ustawione na **Wszyscy**. Popraw i wdróż nową wersję. |
| Pomocnik: „Nie udało się wysłać" | Sprawdź internet i adres `/exec` w ustawieniach — musi być identyczny jak u audytora |
| Audytor: „Brak nowych danych" | Kody zlecenia się nie zgadzają albo pomocnik jeszcze nie wysłał |
| ❌ Brak odpowiedzi | Adres jest nieaktualny (utworzyłeś nowe wdrożenie zamiast nowej wersji istniejącego) **albo** skrypt czeka na ponowną autoryzację — Etap 1, punkty 6–9 |

Jeśli test wychodzi zielono, a wysyłka nadal się nie udaje, komunikat błędu przychodzi wprost z Google i wskaże usługę, której brakuje (najczęściej: potrzebna ponowna autoryzacja).

**Uwaga o duplikatach:** gdy przeglądarka nie odczyta potwierdzenia, aplikacja ponawia wysyłkę. Nie tworzy to drugiego folderu — każda wysyłka ma swój identyfikator, a backend rozpoznaje powtórkę.

## Aplikacja nie widzi zmian po aktualizacji

Uruchom ją z ikony i poczekaj chwilę przy włączonym internecie. Jeśli nadal stara: Chrome → Ustawienia → Prywatność → Wyczyść dane witryny dla adresu aplikacji.

## „BRAK MIEJSCA W PAMIĘCI PRZEGLĄDARKI"

Pobierz kopię zapasową, wyślij stare raporty na Dysk i usuń je z listy w aplikacji.

---

# Czego jeszcze nie ma

- wczytywanie kopii zapasowej z pliku (można ją pobrać, ale nie wgrać z powrotem)
- zdjęcia z aparatu przypisane do pomieszczeń i przegród
- automatyczne obliczanie strat ciepła z U i powierzchni
