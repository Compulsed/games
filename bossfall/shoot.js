// Phone-sized screenshots of the game: idle, champion flipped, mid-round, result, rules.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  const idle = () => page.waitForFunction(() => ['PLAY', 'REFILL'].includes(document.getElementById('play').textContent), null, { timeout: 30000 });
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.screenshot({ path: path.join(dir, 'shot-1-idle.png') });

  // One round by tapping: champion, then the six cards out of order.
  await page.tap('#play');
  await page.waitForSelector('#champ.tap');
  await page.tap('#line .mini:nth-child(3)');
  console.log('cards locked before champion', await page.locator('#line .mini.down').count() === 6);
  await page.tap('#champ');
  await page.waitForSelector('#line .mini.tap');
  await page.screenshot({ path: path.join(dir, 'shot-2-champ.png') });
  const order = [4, 1, 6, 2, 5, 3];
  for (let i = 0; i < order.length; i++) {
    await page.tap(`#line .mini:nth-child(${order[i]})`);
    await page.waitForFunction(n => document.querySelectorAll('#line .mini.down').length === n, 5 - i);
    if (i === 2) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(dir, 'shot-3-mid.png') }); }
  }
  await idle();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, 'shot-4-result.png') });

  // A round on the FLIP button alone, then fast play rounds on the spacebar.
  for (let i = 0; i < 8; i++) { await page.tap('#play'); await page.waitForTimeout(1500); }
  await idle();
  await page.tap('#bTurbo');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(300); await idle(); }
  console.log('balance after 10 rounds', await page.textContent('#bal'));
  console.log('overflow-x', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  console.log('page height', await page.evaluate(() => document.documentElement.scrollHeight));
  await page.tap('#bInfo');
  await page.screenshot({ path: path.join(dir, 'shot-5-rules.png') });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.tap('#bClose');
  await page.screenshot({ path: path.join(dir, 'shot-6-small.png') });
  console.log('small page height', await page.evaluate(() => document.documentElement.scrollHeight));
  await browser.close();
})();
