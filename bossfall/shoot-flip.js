// Stills of the 3D card motion: a mini and the boss mid-flip, a boss recoil, both endings, then a turbo check.
const { chromium } = require('playwright');
const path = require('path');

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
  await browser.close();
})();
