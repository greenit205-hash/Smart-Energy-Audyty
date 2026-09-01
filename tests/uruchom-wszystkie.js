/* Uruchamia wszystkie zestawy testów po kolei.
 * Zestaw, który potrzebuje jsdom, jest pomijany, jeśli biblioteki nie ma.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const zestawy = ['test-warstwy.js', 'test-paczka.js', 'test-pomiary.js', 'test-obrysy.js', 'test-rzuty.js'];
let bledy = 0, pominiete = 0;

for (const t of zestawy) {
  console.log('\n======== ' + t + ' ========');
  try {
    console.log(execFileSync('node', [path.join(__dirname, t)], { encoding: 'utf8' }));
  } catch (e) {
    console.log(e.stdout || '');
    if (e.status === 2) { pominiete++; }
    else { console.log(e.stderr || ''); bledy++; }
  }
}

if (bledy) console.log('\n✗ Zestawów z błędami: ' + bledy);
else console.log('\n✓ Wszystkie zestawy przeszły.' + (pominiete ? ' (pominiętych: ' + pominiete + ')' : ''));
process.exit(bledy ? 1 : 0);
