# Wgranie aplikacji na GitHub — instrukcja pełna

Wersja: **2026.08.07**. Instrukcja uwzględnia awarie, które wystąpiły przy pierwszej próbie — nie powtórzą się, o ile przejdziesz Etap 3 (zmiana sposobu publikacji).

---

## Co poszło nie tak poprzednio i dlaczego nie wróci

**Awaria 1 — publikacja padała po kilku minutach (#1 i #2).**
GitHub domyślnie przepuszcza pliki przez Jekyll, generator blogów. Jekyll traktuje wszystko w podwójnych klamrach `{{ }}` jako własne polecenie, a w `index.html` był zapis `{{SKETCH_0}}` — znacznik, w który backend wstawia szkice do karty obiektu. Jekyll się na nim wykładał i przerywał całą publikację.

*Naprawione u źródła:* znacznik ma teraz postać `[[SKETCH_0]]`, a `Kod.gs` szuka nowej wersji. W plikach nie ma już ani jednej sekwencji, o którą Jekyll mógłby się potknąć. Dodatkowo w paczce jest plik `.nojekyll`, który wyłącza ten mechanizm całkowicie.

> **Ważne:** `index.html` i `Kod.gs` muszą pochodzić z tej samej paczki. Przy niedopasowaniu karta obiektu na Dysku wyjdzie bez szkiców.

**Awaria 2 — publikacja stała w kolejce i padła po 2 h 47 min (#3).**
To nie była wina Twoich plików, tylko starego mechanizmu GitHuba („pages-build-deployment"). Zadanie nie doczekało się wolnej maszyny i zostało ubite po przekroczeniu limitu czasu.

*Obejście:* w paczce jest `.github/workflows/pages.yml` — własny sposób publikacji, omijający tamten mechanizm. Ustawisz go w Etapie 3.

---

## Etap 1 — Wgranie plików

Jeśli repozytorium **już istnieje** (`greenit205-hash/Smart-Energy-Audyty`), po prostu podmieniasz zawartość — historia zostaje.

1. Rozpakuj `smart-energy-repo.zip`.
2. Wejdź na `github.com/greenit205-hash/Smart-Energy-Audyty`.
3. **Add file** → **Upload files**.
4. Przeciągnij **zawartość** rozpakowanego folderu — pliki i podfoldery, **nie sam folder**.
   Pliki o tych samych nazwach zostaną podmienione.
5. Opis zmiany: `Podgląd długości, zestawienie ścian, kontrola pomiarów`
6. **Commit changes**.

### Sprawdź po wgraniu

Na głównej stronie repozytorium (zakładka **Code**) musisz widzieć **bezpośrednio na liście**:

```
apps-script/   docs/   .github/
index.html   manifest.json   sw.js
icon-192.png   icon-512.png   icon-512-maskable.png
base_logo_white_background.png   README.md   .nojekyll
```

Jeśli `index.html` jest schowany w podfolderze — wgraj jeszcze raz, przeciągając zawartość, nie folder.

> Plików `.nojekyll` i `.github` GitHub może nie pokazać na liście, bo zaczynają się od kropki. Nie szkodzi — działają.

---

## Etap 2 — Sprawdzenie pliku publikacji

Upewnij się, że w repozytorium istnieje `.github/workflows/pages.yml`. Wejdź na:

`github.com/greenit205-hash/Smart-Energy-Audyty/blob/main/.github/workflows/pages.yml`

**Jeśli wyskoczy 404**, utwórz go ręcznie:

1. **Add file** → **Create new file**.
2. Nazwa: `.github/workflows/pages.yml` — ukośniki same utworzą foldery.
3. Wklej zawartość pliku `pages.yml` z paczki.
4. **Commit changes**.

---

## Etap 3 — Zmiana sposobu publikacji *(kluczowy krok)*

To jest właśnie to, czego zabrakło poprzednio.

1. **Settings** → menu po lewej → **Pages**.
2. **Source**: zmień `Deploy from a branch` na **GitHub Actions**.
3. Zapisz, jeśli pojawi się taki przycisk.

Od tej chwili publikacją zajmuje się plik z Etapu 2, a stary, zapchany mechanizm nie jest w ogóle używany.

---

## Etap 4 — Uruchomienie i sprawdzenie

1. Zakładka **Actions** → po lewej **Publikacja aplikacji na GitHub Pages**.
2. Jeśli nic nie ruszyło samo: **Run workflow** → **Run workflow**.
3. Zadanie powinno wystartować w kilkanaście sekund i zakończyć się **zielonym ptaszkiem** w 1–2 minuty.

Adres aplikacji:

```
https://greenit205-hash.github.io/Smart-Energy-Audyty/
```

Wielkość liter ma znaczenie — `Smart-Energy-Audyty` dokładnie tak.

### Gdyby coś nadal nie działało

| Objaw | Co zrobić |
|---|---|
| Actions puste, brak workflow | Brakuje `.github/workflows/pages.yml` — wróć do Etapu 2 |
| Zadanie czerwone | Kliknij w nie, rozwiń czerwony krok, wyślij mi zrzut komunikatu |
| Zielone, ale adres daje 404 | `index.html` nie leży w korzeniu — Etap 1, sprawdzenie po wgraniu |
| Wisi w kolejce ponad 15 min | Sprawdź, czy Source to na pewno **GitHub Actions**, nie „Deploy from a branch" |

---

## Etap 5 — Tablety

**Nie ma pośpiechu.** Netlify działa i ma tę samą wersję aplikacji. GitHub Pages to wygoda: stały adres i historia wersji.

Gdy adres GitHuba już działa i chcesz się przenieść:

1. Na obu tabletach **wyślij zaległe raporty na Dysk** — instalacja spod nowego adresu ma osobną pamięć.
2. Chrome → nowy adres → menu ⋮ → **Zainstaluj aplikację**.
3. Pulpit → **Połączenie z Dyskiem Google** → **Rola tego tabletu** (Audytor / Pomocnik) → wklej adres `/exec` → **Zapisz adres** → **🔌 Testuj połączenie**.
4. Usuń starą ikonę z Netlify, żeby nie mieć dwóch instalacji.

> Adresu `/exec` **nie ma w plikach na GitHubie** — celowo, bo repozytorium jest publiczne, a ten adres pozwala zapisywać dane na Twoim Dysku. Wpisujesz go w aplikacji, raz na tablet.

---

## Kolejne aktualizacje

Gdy dostaniesz nowy `index.html`:

1. **Add file** → **Upload files** → przeciągnij plik o tej samej nazwie.
2. Opis zmiany, np. `Poprawka liczenia szczytu dachu`.
3. **Commit changes**.

Publikacja ruszy sama, strona odświeży się w minutę, a tablety pobiorą wersję przy następnym uruchomieniu z internetem. W zakładce **Commits** masz historię wszystkich zmian z możliwością powrotu do dowolnej.

Jeśli zmienia się też `Kod.gs`: wklej go w Apps Script → **Wdróż → Zarządzaj wdrożeniami → ołówek → Wersja: Nowa wersja → Wdróż**. Adres `/exec` zostaje ten sam.
