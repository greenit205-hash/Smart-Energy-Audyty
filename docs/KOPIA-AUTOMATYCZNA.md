# Automatyczna kopia zapasowa na Dysk — wdrożenie krok po kroku

Kopia całej bazy z tabletu wysyła się sama na Twój Dysk Google. Nie zastępuje
przycisku 💾 — jest po to, żebyś nie musiał o nim pamiętać.

Wdrożenie ma dwie części: **backend** (Apps Script) i **aplikacja** (GitHub).
Backend musi być pierwszy, inaczej tablety będą wysyłać kopie w próżnię.

---

## Część 1. Backend — Apps Script

### Krok 1. Otwórz swój projekt

Wejdź na [script.google.com](https://script.google.com) i otwórz projekt
**Smart Energy Audyty**.

### Krok 2. Zapisz na boku swoje identyfikatory

W pliku `Kod.gs` na górze znajdziesz dwie linie:

```js
const SHEET_ID = '17ii4kAgry...';
const PARENT_FOLDER_ID = '1DY85IHmzFA...';
```

**Skopiuj obie wartości do notatnika.** Za chwilę wkleisz nowy kod, który ma
w tych miejscach napisy `TU_WKLEJ_...` — bez tego backend przestanie działać.

### Krok 3. Wklej nowy kod

Zaznacz całą zawartość `Kod.gs` (Ctrl+A) i wklej w to miejsce nowy plik z paczki.

### Krok 4. Wpisz z powrotem identyfikatory

Podmień:

```js
const SHEET_ID = 'TU_WKLEJ_ID_ARKUSZA';        →  swój identyfikator arkusza
const PARENT_FOLDER_ID = 'TU_WKLEJ_ID_FOLDERU'; →  swój identyfikator folderu
```

### Krok 5. Zapisz

Ctrl+S albo ikona dyskietki. U góry musi zniknąć napis „Niezapisane zmiany".

### Krok 6. Sprawdź, czy działa

Z listy funkcji nad edytorem wybierz **`getBackupFolder`** i kliknij **Uruchom**.

- Jeśli Google poprosi o uprawnienia — przejdź przez **Zaawansowane →
  Przejdź do Smart Energy Audyty → Zezwól**.
- W Dzienniku wykonywania ma być **zakończone pomyślnie**.
- Na Dysku, w Twoim folderze audytów, pojawi się podfolder **`KOPIE ZAPASOWE`**.

Jeśli wyskoczy błąd o nieznalezionym folderze — `PARENT_FOLDER_ID` jest zły,
wróć do kroku 4.

### Krok 7. Wdróż nową wersję

**Wdróż → Zarządzaj wdrożeniami → ołówek przy istniejącym wdrożeniu →
Wersja: Nowa wersja → Wdróż.**

> **Nie klikaj „Nowe wdrożenie".** Dostałbyś inny adres `/exec` i musiałbyś
> wpisywać go na obu tabletach od nowa, a stary zostałby aktywny.

Adres `/exec` zostaje ten sam, więc na tabletach nic nie zmieniasz.

---

## Część 2. Aplikacja — GitHub

### Krok 8. Wgraj nową wersję

Wgraj zawartość paczki do repozytorium, jak zwykle. `sw.js` ma podbity numer
wersji, więc tablety pobiorą aktualizację same.

### Krok 9. Odśwież aplikację na tablecie

Wejdź do aplikacji przy włączonym internecie i odśwież. Na pulpicie, nad listą
raportów, pojawi się nowy pasek:

> ☁️ **Kopia na Dysku: jeszcze nie było** · [Wyślij teraz] · ( ) automatycznie co 6 h

### Krok 10. Wyślij pierwszą kopię ręcznie

Kliknij **Wyślij teraz**. Po chwili:

- pasek zmieni się na zielony: **„Kopia na Dysku: dziś 08:12"**,
- na Dysku, w `KOPIE ZAPASOWE`, pojawi się plik `kopia-2026-09-04 08.12.json`.

To sprawdza całą drogę naraz. Jeśli zadziała, automat też zadziała.

### Krok 11. To samo na drugim tablecie

Powtórz kroki 9–10 na tablecie żony. Jej kopie mają w nazwie `-pomocnik`, więc
nie pomylisz plików.

---

## Jak to działa na co dzień

Aplikacja próbuje wysłać kopię:

- **przy uruchomieniu**, jeśli od ostatniej minęło ponad 6 godzin,
- **po zapisaniu audytu**, przy tym samym warunku,
- **gdy wróci internet** — bo u klienta zwykle go nie ma, a w drodze powrotnej
  telefon łapie zasięg.

Wszystko dzieje się w tle. Bez okien, bez czekania, bez komunikatów o błędach —
u klienta nic nie może przeszkadzać. Nieudana próba po prostu powtórzy się później.

Na Dysku trzymane jest **20 ostatnich kopii**, starsze lądują w koszu.
Jedna nadpisywana kopia nie chroniłaby przed niczym: wystarczyłby jeden
uszkodzony zapis, żeby zamazać tę dobrą, a dowiedziałbyś się o tym dopiero
przy odzyskiwaniu.

**Przełącznik „automatycznie co 6 h"** wyłącza automat, gdyby wysyłka
przeszkadzała — na przykład na pakiecie danych poza domem. Przycisk
**Wyślij teraz** działa niezależnie od niego.

Pasek robi się **czerwony**, gdy ostatnia kopia ma ponad 3 dni albo gdy nie było
jeszcze żadnej.

---

## Odzyskiwanie danych

1. Wejdź na Dysk, do folderu **`KOPIE ZAPASOWE`**.
2. Pobierz plik z odpowiednią datą (nazwa zawiera datę i godzinę).
3. W aplikacji: **📂 Wczytaj Kopię** i wskaż pobrany plik.

Wczytanie **dokłada** raporty i szablony, niczego nie kasuje. Powtórne wczytanie
tego samego pliku nie zdubluje danych.

---

## O czym warto pamiętać

**Kopia zawiera dane osobowe klientów** — nazwiska, adresy, telefony, podpisy.
Trafia na Twój Dysk, tak samo jak raporty, ale folder `KOPIE ZAPASOWE`
trzymaj prywatny i nie udostępniaj linkiem.

**Kopia jest cięższa niż raport** — to wszystkie audyty naraz, ze szkicami
i podpisami. Dlatego wysyła się w tle i nie blokuje pracy.

**Automat nie zwalnia z myślenia o miejscu.** Pamięć tabletu jest ograniczona
(pasek zapełnienia na pulpicie ostrzega od 70%). Kopia na Dysku pozwala
bezpiecznie **usunąć** stare audyty z tabletu — i o to w tym wszystkim chodzi.
