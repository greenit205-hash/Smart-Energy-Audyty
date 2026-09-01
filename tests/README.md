# Testy

```
node tests/uruchom-wszystkie.js
```

albo pojedynczo:

| Zestaw | Co sprawdza |
|---|---|
| `test-warstwy.js` | baza materiałów i źródeł ciepła, zgodność z `materialy.json` / `zrodla.json`, obliczenia U, numer wersji w `sw.js`, brak adresu `/exec` i identyfikatorów w paczce |
| `test-paczka.js` | składnia wszystkich skryptów w `index.html`, obecność kluczowych funkcji, powtórzone `id`, kompletność plików PWA i repozytorium |
| `test-pomiary.js` | **silnik wymiarowania i kontrola pomiarów** — na żywej aplikacji |
| `test-obrysy.js` | **domykanie pomieszczeń i powierzchnie** — szkice rysowane z drżeniem ręki, przez prawdziwe przyciąganie i prostowanie |
| `test-rzuty.js` | **dwa prawdziwe rzuty z audytów** — obrys L z 7 pomieszczeniami i układ 9 pomieszczeń w trzech pasach |

Dwa pierwsze zestawy działają na samym Node, bez instalowania czegokolwiek.

`test-pomiary.js` ładuje całe `index.html` do sztucznej przeglądarki i wywołuje
prawdziwe funkcje aplikacji (`recalculateRooms`, `runAuditChecks`), więc nie ma tam
przepisanej logiki — jeśli test przechodzi, działa kod, który trafi na tablet.
Potrzebuje jednorazowo:

```
npm install
```

Bez tego zestaw jest pomijany, a pozostałe i tak się wykonają.

## Do odbudowania

Eksport raportu, wymiana między tabletami, dalmierz.

## Znane, świadomie niezmienione zachowanie

Gdy prosta ściana jest podzielona ścianką działową, obrys upraszcza się do rogów
narożnych i wierzchołek pośredni znika. Dwa pomiary cząstkowe nie sumują się
wtedy do całości — program prosi o wymiar całej ściany. Nigdy nie zgaduje, więc
jest to bezpieczne, ale niewygodne.
