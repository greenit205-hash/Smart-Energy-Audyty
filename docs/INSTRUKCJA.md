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
| 📏 **Ściana** | rysowanie ścian; linie prawie proste same się prostują, końce przyciągają się do istniejących |
| ✍️ **Wymiaruj** | wpisanie wartości z dalmierza dla ściany |
| 🫥 **Ukryj** | schowanie pojedynczej, zbędnej miarki |
| 🚪 **Otwór** | okna i drzwi |
| 🏷️ **Przegroda** | oznaczanie przegród na przekroju |
| 🏠 **Pomieszcz.** | ręczne oznaczenie pomieszczenia (numer, nazwa, wysokość) |
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
