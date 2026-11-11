// Monte Carlo over engine.js: tier odds, hit rate, RTP and the checks from the
// Stake Engine brief. usage: node sim.js [rounds]
const eng = require('./engine.js');

const N = Number(process.argv[2] || 5000000);
const counts = eng.TIERS.map(() => 0);
const byChamp = {};
let maxRatio = 0, sum = 0, sumSq = 0;
for (let i = 0; i < N; i++) {
  const r = eng.playRound();
  counts[r.tier]++;
  sum += r.payoutMultiplier; sumSq += r.payoutMultiplier * r.payoutMultiplier;
  const c = (byChamp[r.champ] = byChamp[r.champ] || { n: 0, wins: 0, pay: 0 });
  c.n++; c.pay += r.payoutMultiplier; if (r.tier > 0) c.wins++;
  if (r.ratio > maxRatio) maxRatio = r.ratio;
}
const p = counts.map(c => c / N);
console.log('rounds', N, '| biggest damage seen:', maxRatio.toFixed(1) + 'x boss HP');
eng.TIERS.forEach((t, i) => console.log(
  String(i), t.label.padEnd(14), (t.pay + 'x').padStart(6), (p[i] * 100).toFixed(4).padStart(9) + '%',
  (p[i] ? '1 in ' + (1 / p[i]).toFixed(1) : '').padEnd(16), 'RTP share', (t.pay * p[i] * 100).toFixed(2)));
const rtp = sum / N, sd = Math.sqrt(sumSq / N - rtp * rtp);
console.log('RTP', (rtp * 100).toFixed(2) + '%', '| hit rate 1 in', (1 / (1 - p[0])).toFixed(2), '| std dev', sd.toFixed(2));
console.log('by champion:', Object.entries(byChamp).map(([k, v]) => `${k} wins ${(v.wins / v.n * 100).toFixed(0)}% rtp ${(v.pay / v.n * 100).toFixed(0)}%`).join(', '));
