// The 3D board (3d.html) in headless Chromium: plays rounds by tapping the canvas, checks the flow and layout, saves screenshots.
// Run: NODE_PATH=/home/dale/code/evals/node_modules node shoot3d.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png' };
const served = [], missing = [], outside = [], problems = [];
const fail = m => { problems.push(m); console.log('FAIL', m); };
const check = (ok, m) => { console.log(ok ? 'ok  ' : 'FAIL', m); if (!ok) problems.push(m); };

// Rounds with a known outcome: find rng values that make playRound() give the wanted tier, using engine.js itself.
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(dir, 'engine.js'), 'utf8'), ctx);
function seqFor(want) {
  for (let seed = 1; seed < 2e6; seed++) {
    let s = seed; const vals = [];
    const rng = () => { s = (s * 16807) % 2147483647; const v = (s - 1) / 2147483646; vals.push(v); return v; };
    ctx.rng = rng;
    const r = vm.runInContext('playRound(rng)', ctx);
    if (want(r) && r.events.some(e => e.fx === 'spell')) return { vals, r };
  }
}

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]), f = path.join(dir, p === '/' ? 'index.html' : p);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { missing.push(p); res.writeHead(404); res.end(); return; }
    served.push(p); res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  async function open(width, height, mobile = true) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
    page.on('pageerror', e => fail(`pageerror ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') fail(`console ${m.text()}`); });
    page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url()); });
    await page.goto(base + '/3d.html');
    await page.waitForFunction(() => window.__bossfall && window.__bossfall.champPoint().x > 0);
    await page.waitForTimeout(800);
    return page;
  }
  const shot = (page, name) => page.screenshot({ path: path.join(dir, `shot3d-${name}.png`) });
  const idle = page => page.waitForFunction(() => window.__bossfall.phase() === 'idle' && !window.__bossfall.busy() && ['PLAY', 'REFILL'].includes(document.getElementById('play').textContent), null, { timeout: 60000 })
    .catch(async e => { console.log('stuck:', await page.evaluate(() => JSON.stringify({ phase: window.__bossfall.phase(), busy: window.__bossfall.busy(), down: [0, 1, 2, 3, 4, 5].map(window.__bossfall.faceDown), log: document.getElementById('log').textContent }))); throw e; });
  const ready = (page, phase) => page.waitForFunction(p => window.__bossfall.phase() === p && !window.__bossfall.busy(), phase, { timeout: 30000 });
  const tapAt = async (page, p) => page.touchscreen.tap(p.x, p.y);
  const num = async (page, id) => parseFloat((await page.textContent('#' + id)).replace(/,/g, ''));
  async function layout(page, tag) {
    const m = await page.evaluate(() => ({ ox: document.documentElement.scrollWidth > window.innerWidth, h: document.documentElement.scrollHeight, vh: window.innerHeight }));
    check(!m.ox, `${tag}: no horizontal overflow`);
    check(m.h === m.vh, `${tag}: page height ${m.h} equals the viewport ${m.vh}`);
    // Every card centre is inside the canvas and above the meter.
    const pts = await page.evaluate(() => { const b = window.__bossfall, r = document.getElementById('gl').getBoundingClientRect(), top = document.querySelector('.mwrap').getBoundingClientRect().top;
      return [b.champPoint(), ...[0, 1, 2, 3, 4, 5].map(i => b.cardPoint(i))].map(p => p.x > r.left && p.x < r.right && p.y > r.top && p.y < Math.min(r.bottom, top)); });
    check(pts.every(Boolean), `${tag}: champion and six cards are inside the board`);
  }
  // Rounds that need a given outcome: the next playRound() takes these rng values.
  async function stub(page, vals) { await page.evaluate(v => { const orig = Math.random; const q = v.slice(); Math.random = () => (q.length ? q.shift() : orig()); setTimeout(() => { Math.random = orig; }, 4000); }, vals); }
  // Taps a full round: champion, then the cards in this order. Returns the log text at the end.
  async function tapRound(page, order, tag, snaps = {}) {
    await page.tap('#play');
    await ready(page, 'champ');
    await tapAt(page, await page.evaluate(() => window.__bossfall.champPoint()));
    await ready(page, 'cards');
    if (snaps.champ) await shot(page, snaps.champ);
    let spellShot = !snaps.spell;
    for (let i = 0; i < order.length; i++) {
      await page.waitForFunction(() => !window.__bossfall.busy());
      await tapAt(page, await page.evaluate(n => window.__bossfall.cardPoint(n), order[i]));
      if (!spellShot) {
        const isSpell = await page.waitForFunction(() => /costs \d+ mana/.test(document.getElementById('log').textContent) || null, null, { timeout: 1500 }).then(() => true, () => false);
        if (isSpell) { await page.waitForTimeout(120); await shot(page, snaps.spell); spellShot = true; }
      }
      await page.waitForFunction(n => !window.__bossfall.faceDown(n), order[i], { timeout: 5000 }).catch(() => fail(`${tag}: card ${order[i]} did not flip`));
      if (i === 2 && snaps.mid) { await page.waitForFunction(() => !window.__bossfall.busy()); await shot(page, snaps.mid); }
    }
    if (snaps.end) {
      await page.waitForFunction(() => /falls|survives/.test(document.getElementById('log').textContent));
      await page.waitForTimeout(snaps.endDelay || 450); await shot(page, snaps.end);
    }
    await idle(page);
    return page.textContent('#log');
  }
  const winOf = text => { const m = text.match(/you (?:win|get back) ([\d,.]+)/); return m ? parseFloat(m[1].replace(/,/g, '')) : 0; };

  const fire = e => e.fx === 'spell' && ['Firebolt', 'Meteor', 'Cataclysm'].includes(e.card.name);
  const win = seqFor(r => r.tier >= 5), lose = seqFor(r => r.tier === 0), plain = seqFor(r => r.tier >= 1 && r.tier <= 3 && r.events.findIndex(fire) >= 3);
  const spellAt = plain.r.events.findIndex(fire), spellDelay = 200;
  console.log('stub rounds: big win tier', win.r.tier, win.r.champ.name, '· loss', lose.r.champ.name, '· win tier', plain.r.tier, 'with', plain.r.events[spellAt].card.name, 'as flip', spellAt + 1);

  for (const [w, h, tag] of [[390, 780, 'phone'], [360, 640, 'small']]) {
    console.log(`\n${tag} ${w}×${h}`);
    const page = await open(w, h);
    if (tag === 'phone') await shot(page, '1-idle');
    else await shot(page, '8-small-idle');
    await layout(page, tag);

    // Cards can't be tapped before the champion is flipped.
    await stub(page, plain.vals);
    await page.tap('#play');
    await ready(page, 'champ');
    await tapAt(page, await page.evaluate(() => window.__bossfall.cardPoint(2)));
    await page.waitForTimeout(500);
    check(await page.evaluate(() => window.__bossfall.faceDown(2) && window.__bossfall.phase() === 'champ'), `${tag}: tapping a card before the champion does nothing`);
    let bal = await num(page, 'bal'), bet = await num(page, 'bet');
    await tapAt(page, await page.evaluate(() => window.__bossfall.champPoint()));
    await ready(page, 'cards');
    if (tag === 'phone') await shot(page, '2-champion');
    const order = [4, 0, 5, 1, 3, 2];
    let spellShot = tag !== 'phone';
    for (let i = 0; i < 6; i++) {
      await page.waitForFunction(() => !window.__bossfall.busy());
      await tapAt(page, await page.evaluate(n => window.__bossfall.cardPoint(n), order[i]));
      if (!spellShot && i === spellAt) { await page.waitForTimeout(spellDelay); await shot(page, '4-spell'); spellShot = true; }
      await page.waitForFunction(n => !window.__bossfall.faceDown(n), order[i], { timeout: 5000 }).catch(() => fail(`${tag}: card ${order[i]} did not flip`));
      if (i === 2 && tag === 'phone') { await page.waitForFunction(() => !window.__bossfall.busy()); await shot(page, '3-mid'); }
    }
    await idle(page);
    let text = await page.textContent('#log');
    check(Math.abs(await num(page, 'bal') - (bal + winOf(text))) < 0.005, `${tag}: tapped round paid what the log says (${text})`);
    if (tag === 'small') await shot(page, '9-small-result');

    // A round on the main button alone.
    bal = await num(page, 'bal'); bet = await num(page, 'bet');
    for (let i = 0; i < 8; i++) { await page.waitForFunction(() => !window.__bossfall.busy() && !document.getElementById('modal').classList.contains('open')); await page.tap('#play'); await page.waitForTimeout(100); }
    await idle(page);
    text = await page.textContent('#log');
    check(Math.abs(await num(page, 'bal') - (bal - bet + winOf(text))) < 0.005, `${tag}: button round: balance ${bal} → ${await num(page, 'bal')} (${text})`);

    // Eight fast-play rounds on the spacebar.
    await page.tap('#bTurbo');
    let okRounds = 0, frames = null;
    for (let i = 0; i < 8; i++) {
      bal = await num(page, 'bal'); bet = await num(page, 'bet');
      if (i === 1 && tag === 'phone') await page.evaluate(() => { window.__ft = []; let l = performance.now(); (function f(t) { window.__ft.push(t - l); l = t; if (window.__ft.length < 400) requestAnimationFrame(f); })(l); });
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__bossfall.phase() !== 'idle');
      await idle(page);
      if (i === 1 && tag === 'phone') frames = await page.evaluate(() => window.__ft.slice(1));
      text = await page.textContent('#log');
      if (Math.abs(await num(page, 'bal') - (bal - bet + winOf(text))) < 0.005) okRounds++;
      else fail(`${tag}: turbo round ${i + 1}: ${bal} − ${bet} + ${winOf(text)} ≠ ${await num(page, 'bal')} (${text})`);
    }
    check(okRounds === 8, `${tag}: 8 fast-play rounds on Space, balance consistent each time (now ${await num(page, 'bal')})`);
    if (frames) { const s = frames.slice().sort((a, b) => a - b); console.log(`frame interval during a fast-play round (software WebGL, ${w}×${h} @2x): median ${s[s.length >> 1].toFixed(1)} ms, p90 ${s[Math.floor(s.length * 0.9)].toFixed(1)} ms, max ${s[s.length - 1].toFixed(1)} ms over ${s.length} frames`); }
    await page.tap('#bTurbo');
    await layout(page, tag + ' after play');

    if (tag === 'phone') {
      // The two endings, at normal speed, with a known outcome.
      await stub(page, win.vals);
      text = await tapRound(page, [1, 3, 5, 0, 2, 4], 'big win', { end: '5-boss-beaten', endDelay: 120 });
      check(/falls/.test(text), `boss beaten round: ${text}`);
      await stub(page, lose.vals);
      text = await tapRound(page, [0, 1, 2, 3, 4, 5], 'loss', { end: '6-boss-survives', endDelay: 500 });
      check(/survives/.test(text), `boss survives round: ${text}`);
    }
    await page.tap('#bInfo');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => document.getElementById('modal').classList.contains('open') && !!document.querySelector('.sheet a[href="index.html"]')), `${tag}: rules sheet opens, with a link to the 2D board`);
    if (tag === 'phone') await shot(page, '7-rules');
    await page.tap('#bClose');
    await page.close();
  }

  console.log('\ndesktop 1280×800');
  const desk = await open(1280, 800, false);
  await desk.click('#play');
  await desk.waitForFunction(() => window.__bossfall.phase() === 'champ' && !window.__bossfall.busy());
  const cp = await desk.evaluate(() => window.__bossfall.champPoint());
  await desk.mouse.click(cp.x, cp.y);
  await desk.waitForFunction(() => window.__bossfall.phase() === 'cards' && !window.__bossfall.busy());
  const p3 = await desk.evaluate(() => window.__bossfall.cardPoint(3));
  await desk.mouse.click(p3.x, p3.y);
  await desk.waitForFunction(() => !window.__bossfall.faceDown(3) && !window.__bossfall.busy());
  const p1 = await desk.evaluate(() => window.__bossfall.cardPoint(1));
  await desk.mouse.move(p1.x, p1.y);
  await desk.waitForTimeout(400);
  await shot(desk, '10-desktop');
  await layout(desk, 'desktop');
  await desk.close();

  await browser.close(); server.close();
  const art = new Set(served.filter(p => p.startsWith('/art/')));
  console.log(`\nserved ${served.length} requests, ${art.size} art files: ${[...art].map(p => p.slice(5)).join(' ')}`);
  check(art.size === 26, 'all 26 art files loaded');
  check(missing.length === 0, `no 404s ${missing.join(' ')}`);
  check(outside.length === 0, `no requests leave localhost ${outside.join(' ')}`);
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall checks passed');
  process.exit(problems.length ? 1 : 0);
})();
