// Monte Carlo over engine.js: tier odds and RTP per stance.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const eng = new Function(src + '; return { playRound, STANCES, TIER_LABEL };')();

const N = Number(process.argv[2] || 2000000);
const counts = new Array(eng.TIER_LABEL.length).fill(0);
const byChamp = {};
let maxOver = -Infinity;
for (let i = 0; i < N; i++) {
  const r = eng.playRound();
  counts[r.tier]++;
  const c = (byChamp[r.champ.name] = byChamp[r.champ.name] || { n: 0, kills: 0 });
  c.n++; if (r.tier > 0) c.kills++;
  if (r.overkill > maxOver) maxOver = r.overkill;
}
const p = counts.map(c => c / N);
console.log('rounds', N, 'max overkill seen', maxOver);
p.forEach((x, i) => console.log(String(i), eng.TIER_LABEL[i].padEnd(22), (x * 100).toFixed(4) + '%', x ? '1 in ' + (1 / x).toFixed(1) : ''));
console.log('boss beaten by champion:', Object.entries(byChamp).map(([k, v]) => `${k} ${(v.kills / v.n * 100).toFixed(0)}%`).join(', '));
for (const [k, st] of Object.entries(eng.STANCES)) {
  const rtp = st.pay.reduce((a, pay, i) => a + pay * p[i], 0);
  const hit = st.pay.reduce((a, pay, i) => a + (pay > 0 ? p[i] : 0), 0);
  const parts = st.pay.map((pay, i) => (pay * p[i] * 100).toFixed(1)).join(' ');
  console.log(k.padEnd(9), 'RTP', (rtp * 100).toFixed(2) + '%', 'hit 1 in', (1 / hit).toFixed(2), '| RTP by tier:', parts);
}
