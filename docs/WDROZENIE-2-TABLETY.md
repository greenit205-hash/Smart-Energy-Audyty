# Wdrożenie od zera na dwa tablety

Wersja aplikacji: **2026.08.06**. Przejdź to po kolei — całość zajmuje ok. 30 minut, z czego 20 to jednorazowa konfiguracja Google.

**Legenda:** 🖥️ = robisz na komputerze · 📱A = tablet audytora (Twój) · 📱B = tablet pomocnika (żony)

---

# ETAP 1 — Przygotowanie na Dysku Google 🖥️

Robisz na swoim koncie Google. Jeśli masz już arkusz i folder z poprzednich wersji — możesz ich użyć i przejść do Etapu 2.

1. Wejdź na `drive.google.com`, utwórz folder np. **AUDYTY**.
2. Wejdź do niego i skopiuj z paska adresu identyfikator:
   `drive.google.com/drive/folders/`**`1AbC...XyZ`** ← to jest **PARENT_FOLDER_ID**
3. Utwórz arkusz Google (`sheets.new`), nazwij np. **Rejestr audytów**.
4. Skopiuj z adresu:
   `docs.google.com/spreadsheets/d/`**`1AbC...XyZ`**`/edit` ← to jest **SHEET_ID**

Zapisz oba identyfikatory w notatniku — będą potrzebne za chwilę.

> Nie musisz nic tworzyć ręcznie w środku. Foldery klientów i podfolder **WYMIANA (tablety)** aplikacja założy sama.

---

# ETAP 2 — Backend w Google Apps Script 🖥️

**Plik:** `Kod.gs`

1. Wejdź na `script.google.com` → **Nowy projekt**.
2. Nazwij projekt, np. **Smart Energy Audyty**.
3. W edytorze zaznacz całą zawartość `Kod.gs` (Ctrl+A) i wklej treść mojego pliku `Kod.gs`.
4. W liniach 13–14 wstaw swoje identyfikatory z Etapu 1:
   ```
   const SHEET_ID = 'TU_WKLEJ_ID_ARKUSZA';
   const PARENT_FOLDER_ID = 'TU_WKLEJ_ID_FOLDERU';
   ```
   > Jeśli zostajesz przy dotychczasowym arkuszu i folderze — zostaw wartości, które już tam są.
5. Zapisz (ikona dyskietki).

## Autoryzacja

6. Przy przycisku **▶ Uruchom** wybierz z listy funkcję **`doGet`** → **Uruchom**.
7. **Autoryzacja wymagana** → **Przejrzyj uprawnienia** → wybierz konto.
8. „Google nie zweryfikował tej aplikacji" → **Zaawansowane** → **Przejdź do Smart Energy Audyty (niebezpieczne)** → **Zezwól**.
9. W **Dzienniku wykonywania** ma być „Ukończono wykonywanie" bez błędu.

## Wdrożenie

10. Prawy górny róg: **Wdróż** → **Nowe wdrożenie**.
11. Koło zębate przy „Wybierz typ" → **Aplikacja internetowa**.
12. Ustaw dokładnie tak:
    - **Wykonaj jako:** Ja
    - **Kto ma dostęp:** **Wszyscy** ← bez tego tablety zobaczą ekran logowania
13. **Wdróż** → skopiuj **adres aplikacji internetowej** (kończy się na `/exec`).

**Zapisz ten adres — wpiszesz go na OBU tabletach.** Najprościej wysłać go sobie mailem albo na Messengera, żeby dało się go wkleić bez przepisywania.

**Test:** wklej adres `/exec` w przeglądarce. Powinno pojawić się:
`Smart Energy API dziala. Wersja 5.0. Uzyj metody POST z aplikacji.`

---

# ETAP 3 — Hosting aplikacji 🖥️

**Pliki:** folder `netlify-smart-energy` (albo `netlify-smart-energy.zip`)

1. Wejdź na `app.netlify.com/drop` (konto niepotrzebne).
2. Przeciągnij tam **plik ZIP** — Netlify sam go rozpakuje.
3. Dostaniesz adres w rodzaju `https://cos-tam-123.netlify.app`.

**Zapisz i ten adres.** Ten sam wpiszesz na obu tabletach.

> To jest jedna aplikacja dla obu osób — różni je tylko rola ustawiona w Etapie 4.

---

# ETAP 4 — Tablet audytora 📱A

1. Otwórz adres Netlify w **Chrome**.
2. Menu (⋮) → **Zainstaluj aplikację** → ikona ląduje na pulpicie.
3. Uruchom z ikony.
4. Na pulpicie: **Połączenie z Dyskiem Google** → **Pokaż**.
5. **Rola tego tabletu:** wybierz **Audytor (pełna aplikacja, scala dane)**.
6. Wklej adres `/exec` z Etapu 2 → **Zapisz adres**.
7. **🔌 Testuj połączenie** → musi być zielone **✅ Połączenie działa**.

---

# ETAP 5 — Tablet pomocnika 📱B

Dokładnie to samo, z jedną różnicą w punkcie 5:

1. Otwórz **ten sam** adres Netlify w Chrome.
2. Menu (⋮) → **Zainstaluj aplikację**.
3. Uruchom z ikony.
4. **Połączenie z Dyskiem Google** → **Pokaż**.
5. **Rola tego tabletu:** wybierz **Pomocnik (tylko dane klienta + szkice)**.
6. Wklej **ten sam** adres `/exec` → **Zapisz adres**.
7. **🔌 Testuj połączenie** → zielone.

Po ustawieniu roli z aplikacji znikną sekcje 2, 3, 4 i podpis klienta — zostaną dane klienta i pełny szkicownik.

---

# ETAP 6 — Sprawdzian przed pierwszym wyjazdem

Zrób to raz w domu, przy internecie. Zajmuje 5 minut i wyklucza niespodzianki u klienta.

**📱A:** ➕ Nowy Raport → wpisz „TEST" i adres „TEST" → zapamiętaj **Kod zlecenia** z sekcji 1 (np. `A7K2QD`) → 💾 Zapisz.

**📱B:** ➕ Nowy Raport → nazwisko „TEST" → w sekcji 1 wpisz **ten sam kod** → narysuj byle kwadrat → 💾 Zapisz → **📤 Wyślij do audytora**. Ma pojawić się potwierdzenie.

**📱A:** przy raporcie TEST → **📥 Pobierz od pomocnika**. Ma pojawić się „Dołączono 1 szkic".
Otwórz ✏️ Edytuj i sprawdź, czy w sekcji 5 jest zakładka z jej rysunkiem.

**📱A:** **🚀 Wyślij na Dysk** → sprawdź, czy na Dysku w folderze AUDYTY powstał folder „TEST (data)".

Jeśli wszystkie cztery kroki przeszły — jesteście gotowi. Skasuj raport TEST z obu tabletów.

---

# ETAP 7 — Przebieg prawdziwej wizyty

## Przed wejściem (jeszcze przy zasięgu — choć nie jest konieczny)

**📱A:** ➕ Nowy Raport → imię, nazwisko, adres → odczytaj **Kod zlecenia**.
**📱B:** ➕ Nowy Raport → nazwisko klienta → wpisz **ten sam kod** → 💾 Zapisz.

> Kod można wpisać w dowolnym momencie, także po zakończeniu rysowania — ważne, żeby przed wysyłką był identyczny po obu stronach.

## W budynku (bez internetu)

**📱B — żona:** rysuje rzuty kondygnacji, oznacza pomieszczenia (🏠 Pomieszcz.), mierzy (🎯 Pomiar), wstawia okna i drzwi (🚪 Otwór). Dla każdego rzutu ustawia **Wys. kondygnacji**.

**📱A — Ty:** rysujesz przekrój (Rodzaj: **Przekrój / elewacja**), oznaczasz przegrody (🏷️ Przegroda) i wypełniasz sekcje 2, 3, 4.

Oboje zapisujecie u siebie (💾 Zapisz). Autozapis i tak leci co 30 sekund.

## Po wyjściu, gdy wróci internet

1. **📱B:** przy raporcie klienta → **📤 Wyślij do audytora**.
2. **📱A:** **📥 Pobierz od pomocnika** — albo nic nie rób, bo tablet sprawdza to sam przy uruchomieniu aplikacji z internetem.
3. **📱A:** ✏️ Edytuj → jej zakładki są już w Twoim raporcie → dokończ opisy, podpis klienta.
4. **📱A:** **🚀 Wyślij na Dysk**.

Można wysyłać i pobierać wielokrotnie — nic się nie dubluje. Jeśli żona dorysuje coś później, wysyła ponownie, a Ty pobierasz jeszcze raz.

---

# Co powstaje na Dysku

W folderze AUDYTY → folder klienta z datą, a w nim:

1. Raport w **Dokumentach Google** (edytowalny, z logo)
2. Ten sam raport w **PDF**
3. **Karta obiektu** `.html` — pobierz i otwórz dwuklikiem (podgląd Dysku pokazuje sam kod)
4. **Szkice PNG** — po jednym na zakładkę, także te od pomocnika
5. **podpis-klienta.png**
6. **dane-audytu.json** — kopia surowych danych
7. plus wiersz w arkuszu-rejestrze z linkami

---

# Aktualizacje w przyszłości

| Co zmieniam | Co robię |
|---|---|
| Sam `index.html` | Wgraj nowy ZIP na Netlify (ten sam projekt) → oba tablety pobiorą przy następnym uruchomieniu z internetem |
| Także `Kod.gs` | Wklej nowy kod → **Wdróż → Zarządzaj wdrożeniami → ołówek → Wersja: Nowa wersja → Wdróż**. Adres `/exec` zostaje ten sam, nie trzeba nic zmieniać na tabletach |

> Jeśli po zmianie `Kod.gs` pojawi się błąd o uprawnieniach — powtórz **Etap 2, punkty 6–9**. Dzieje się tak, gdy nowa funkcja sięga po kolejną usługę Google; to jednorazowe.

---

# Najczęstsze potknięcia

| Objaw | Przyczyna |
|---|---|
| Pomocnik: „Nie udało się wysłać" | Inny adres `/exec` niż u audytora, albo brak internetu |
| Audytor: „Brak nowych danych" | Kody zlecenia się nie zgadzają, albo pomocnik jeszcze nie wysłał |
| Ekran logowania Google zamiast danych | We wdrożeniu **Kto ma dostęp** nie jest ustawione na **Wszyscy** |
| Tablet pokazuje starą wersję | Uruchom z ikony przy internecie; jeśli nie pomoże: Chrome → Ustawienia → Prywatność → Wyczyść dane witryny |
| Karta obiektu wygląda jak kod | Tak działa podgląd Dysku dla plików `.html` — pobierz plik i otwórz dwuklikiem |

Pełny opis narzędzi szkicownika, zasad liczenia powierzchni i pracy z przegrodami znajdziesz w **INSTRUKCJA.md**.
