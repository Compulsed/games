// Stills of the 3D card motion: a mini and the boss mid-flip, a boss recoil, both endings, then a turbo check.
const { chromium } = require('playwright');
const path = require('path');

// Attack and win effects. Rounds are rigged by feeding the real engine playRound() a scripted rng
// that picks the named champion, boss and six cards in order (so the maths stays the engine's).
const RIG = {
  A: ['Archmage', 'Kraken', ["Dragon's fury", 'Spark', 'Firebolt', 'Cataclysm', 'Lightning', 'Warhammer']],  // ×3 small, spells, fizzle, phys; boss survives
  B: ['Archmage', 'Bandit Lord', ['Meteor', 'Lightning', 'Sword', 'Axe', 'Lance', 'Battle cry']],             // kill on Lance, ×1.5, tier 3
  D: ['Knight', 'Bandit Lord', ['Warhammer', 'Lance', 'Axe', 'Twin strike', 'Sword', "Dragon's fury"]],        // ×2 (+40), ×3 big, tier 5
  C: ['Dragon', 'Bandit Lord', ['Warhammer', 'Lance', 'Axe', 'Cataclysm', 'Twin strike', "Dragon's fury"]],    // ×2 (+82), ×3 huge, tier 7
};
// Per round: [card index, ms after next(), still name]; 'X' = also check overflow there.
const SNAPS = {
  A: [[0, 900, 'x3-small'], [1, 380, 'spark-flight'], [2, 600, 'firebolt-impact'], [3, 400, 'cataclysm-flight'], [3, 580, 'cataclysm-impact'], [4, 400, 'fizzle-flight'], [4, 540, 'fizzle-puff'], [5, 380, 'phys-flight'], [5, 540, 'phys-slash']],
  B: [[0, 420, 'meteor-flight'], [1, 300, 'lightning-bolt'], [4, 560, 'kill-moment'], [5, 800, 'x1.5']],
  D: [[3, 800, 'x2-plus40'], [5, 820, 'x3-big-peak', 'X']],
  C: [[4, 820, 'x2-plus82'], [5, 860, 'x3-huge-peak', 'X']],
};
const END = { B: [450, 'win-tier3'], D: [700, 'win-tier5'], C: [800, 'win-tier7'] };

async function effects(browser, dir) {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.evaluate(() => {
    window.playRound0 = playRound;
    window.rigged = ([champ, boss, names]) => {
      const vals = [], tw = CHAMPS.reduce((a, x) => a + x.w, 0); let acc = 0;
      for (const x of CHAMPS) { if (x.name === champ) { vals.push((acc + x.w / 2) / tw); break; } acc += x.w; }
      vals.push((BOSSES.findIndex(b => b.name === boss) + 0.5) / BOSSES.length);
      const deck = []; CARDS.forEach(c => { for (let i = 0; i < c.n; i++) deck.push(c); });
      for (const n of names) { const i = deck.findIndex(c => c.name === n); vals.push((i + 0.5) / deck.length); deck.splice(i, 1); }
      let k = 0; return playRound0(() => vals[k++]);
    };
    window.playRound = () => rigged(window.RIG);
    window.free = () => new Promise(r => (function f() { if (!lock) r(); else requestAnimationFrame(f); })());
    window.step = async () => { const t0 = performance.now(); next(); await free(); return Math.round(performance.now() - t0); };
  });
  const freezeAll = () => page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const thawAll = () => page.evaluate(() => document.getAnimations().forEach(a => a.play()));
  const fxCount = () => page.evaluate(() => document.getElementById('fx').childElementCount);
  for (const k of ['A', 'B', 'D', 'C']) {
    await page.evaluate(r => { window.RIG = r; }, RIG[k]);
    await page.evaluate(() => step()); await page.evaluate(() => step());   // start, champion
    const snaps = SNAPS[k];
    for (let i = 0; i < 6; i++) {
      const s = snaps.filter(x => x[0] === i);
      if (!s.length) { await page.evaluate(() => step()); continue; }
      await page.evaluate(() => { next(); });
      let t = 0;
      for (const [, ms, name, chk] of s) {
        await page.waitForTimeout(ms - t); t = ms;
        await freezeAll();
        await page.screenshot({ path: path.join(dir, `fx-${k}-${name}.png`) });
        if (chk) console.log(name, 'fx elements', await page.evaluate(() => JSON.stringify([...document.getElementById('fx').children].reduce((a, e) => (a[e.className] = (a[e.className] || 0) + 1, a), {}))), 'overflow-x', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'height', await page.evaluate(() => document.documentElement.scrollHeight));
        await thawAll();
      }
      if (i < 5) await page.evaluate(() => free());
    }
    if (END[k]) {
      await page.waitForFunction(() => document.getElementById('boss').classList.contains('dead'), null, { timeout: 10000 });
      await page.waitForTimeout(END[k][0]); await freezeAll();
      await page.screenshot({ path: path.join(dir, `fx-${k}-${END[k][1]}.png`) });
      await thawAll();
    }
    await page.waitForFunction(() => S.phase === 'idle' && !lock, null, { timeout: 30000 }).catch(async e => {
      console.log('stuck', await page.evaluate(() => JSON.stringify({ phase: S.phase, lock, flips, live: live.size, anims: document.getAnimations().map(a => [a.playState, a.effect.target.className, a.currentTime]) })));
      throw e;
    });
    console.log('round', k, 'tier', await page.evaluate(() => R.tier), 'fx left after round', await fxCount());
  }
  // Per-card time (next() to unlock), normal and turbo, on rounds A and C.
  for (const turbo of [false, true]) {
    await page.evaluate(t => { S.turbo = t; renderHud(); }, turbo);
    for (const k of ['A', 'C']) {
      await page.evaluate(r => { window.RIG = r; }, RIG[k]);
      const times = await page.evaluate(async () => { await step(); await step(); const out = []; for (let i = 0; i < 6; i++) out.push(R.events[flips].card.name + (R.events[flips].voided ? ' (fizzle)' : '') + ' ' + await step()); await new Promise(r => (function f() { if (S.phase === 'idle' && !lock) r(); else requestAnimationFrame(f); })()); return out; });
      console.log(turbo ? 'turbo' : 'normal', k, times.join(', '), '| fx left', await fxCount());
    }
  }
  // 12 turbo rounds of random play on Space (auto-flip), then the layer must be empty.
  await page.evaluate(() => { window.playRound = window.playRound0; });
  let left = 0;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    await page.waitForFunction(() => ['PLAY', 'REFILL'].includes(document.getElementById('play').textContent), null, { timeout: 30000 });
    left += await fxCount();
  }
  console.log('12 turbo rounds: fx left in total', left, 'overflow-x', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  // Reduced motion: a rigged ×3 round shows only fades and numbers.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { S.turbo = false; renderHud(); window.playRound = () => rigged(window.RIG); });
  await page.evaluate(r => { window.RIG = r; }, RIG.C);
  await page.evaluate(async () => { for (let i = 0; i < 7; i++) await step(); });
  await page.evaluate(() => { next(); });
  await page.waitForTimeout(450); await freezeAll();
  await page.screenshot({ path: path.join(dir, 'fx-reduced-x3.png') });
  await thawAll();
  await page.close();
}

(async () => {
  const dir = __dirname, shot = n => page.screenshot({ path: path.join(dir, `flip-${n}.png`) });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  const idle = () => page.waitForFunction(() => ['PLAY', 'REFILL'].includes(document.getElementById('play').textContent), null, { timeout: 30000 });
  // Freeze every running animation/transition on `sel` at fraction k of its run.
  const freeze = (sel, k) => page.evaluate(([sel, k]) => new Promise(res => requestAnimationFrame(() => {
    const els = [...document.querySelectorAll(sel)];
    const anims = document.getAnimations().filter(a => els.some(e => e === a.effect.target || e.contains(a.effect.target)));
    anims.forEach(a => { a.pause(); a.currentTime = a.effect.getComputedTiming().delay + a.effect.getComputedTiming().duration * k; });
    res(anims.length);
  })), [sel, k]);
  const thaw = () => page.evaluate(() => document.getAnimations().forEach(a => a.play()));
  // Force the round's outcome: keep dealing until the boss falls (win) or survives (lose).
  const force = win => page.evaluate(win => {
    const orig = window.playRound0 || (window.playRound0 = playRound);
    window.playRound = () => { let r; do r = orig(); while ((r.overkill >= 0) !== win); return r; };
  }, win);
  await page.goto('file://' + path.join(dir, 'index.html'));

  await force(true);
  await page.evaluate(() => next());
  console.log('boss anims', await freeze('#boss .inner', 0.22));
  await shot('1-boss-midflip');
  await thaw();
  await page.waitForSelector('#champ.tap');
  await page.tap('#champ');
  await page.waitForSelector('#line .mini.tap');
  await page.waitForTimeout(300);
  await page.tap('#line .mini:nth-child(2)');
  console.log('mini anims', await freeze('#line .mini:nth-child(2) .inner', 0.2));
  await shot('2-mini-midflip');
  await thaw();
  await page.waitForFunction(() => document.querySelector('#boss.hit'), null, { timeout: 5000 }).catch(() => {});
  console.log('hit anims', await freeze('#boss', 0.25));
  await shot('3-boss-recoil');
  await thaw();
  while (await page.locator('#line .mini.down').count()) { await page.evaluate(() => next()); await page.waitForTimeout(250); }
  await idle(); await page.waitForTimeout(900);
  await shot('4-boss-beaten');

  await force(false);
  await page.evaluate(() => next());
  await page.waitForTimeout(160);
  console.log('flip-back anims', await freeze('#line .mini', 0.5));
  await shot('5-flip-back');
  await thaw();
  while (!(await page.evaluate(() => S.phase === 'idle' && !lock))) { await page.evaluate(() => next()); await page.waitForTimeout(250); }
  await page.waitForTimeout(900);
  await shot('6-boss-survives');

  // Fast play: after every round, every card must sit fully face-up or face-down (cos of the Y turn near ±1).
  await page.evaluate(() => { window.playRound = window.playRound0; });
  await page.tap('#bTurbo');
  let bad = 0;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Space'); await page.waitForTimeout(300); await idle();
    await page.waitForTimeout(450);
    bad += await page.evaluate(() => [...document.querySelectorAll('.card')].filter(c => {
      const m = new DOMMatrix(getComputedStyle(c.querySelector('.inner')).transform);
      return c.classList.contains('down') ? m.m11 > -0.9 : m.m11 < 0.85;
    }).length);
  }
  console.log('turbo rounds 12, cards mid-rotation', bad, 'running animations', await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && !a.effect.target.matches('.back')).length));
  // Turbo mid-round: stop between flips and check the flipped ones are fully up.
  await page.tap('#bTurbo');
  await page.keyboard.press('Space'); await page.waitForSelector('#champ.tap');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(900); }
  console.log('mid-round state', await page.evaluate(() => [...document.querySelectorAll('#line .mini')].map(c => (c.classList.contains('down') ? 'D' : 'U') + new DOMMatrix(getComputedStyle(c.querySelector('.inner')).transform).m11.toFixed(2)).join(' ')));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Space'); await page.waitForTimeout(1500);
  await page.keyboard.press('Space');
  console.log('reduced cross-fade anims', await freeze('#line .mini:not(.down)', 0.5));
  await shot('7-reduced');
  await thaw();
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(1500);
  await shot('8-small');
  console.log('small overflow-x', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'height', await page.evaluate(() => document.documentElement.scrollHeight));
  await page.close();
  await effects(browser, dir);
  await browser.close();
})();
