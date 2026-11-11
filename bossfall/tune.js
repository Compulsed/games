// Tuning aid: tier odds for candidate boss HP sets, without editing engine.js.
// usage: node tune.js 60,70,80,95 [rounds]
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const eng = new Function(src + '; return { playRound, tierOf, TIER_LABEL };')();

const hps = (process.argv[2] || '40,48,56,66').split(',').map(Number);
const N = Number(process.argv[3] || 2000000);
const counts = new Array(eng.TIER_LABEL.length).fill(0);
const TAILS = [300, 400, 500, 700, 1000];
const tails = TAILS.map(() => 0);
for (let i = 0; i < N; i++) {
  const r = eng.playRound();
  const o = r.dmg - hps[Math.floor(Math.random() * hps.length)];
  counts[eng.tierOf(o)]++;
  TAILS.forEach((t, j) => { if (o >= t) tails[j]++; });
}
console.log(hps.join(','), counts.map(c => (c / N * 100).toFixed(4)).join(' '));
console.log('tails', TAILS.map((t, j) => `${t}+: ${(tails[j] / N * 100).toFixed(4)}%`).join('  '));
