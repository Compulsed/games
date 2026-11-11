// Resize raw/ images to small WebP files next to this script, and write a contact sheet.
// Uses Chromium's canvas (through Playwright) so no image tools need installing.
// usage: NODE_PATH=<dir with playwright> node convert.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'raw');
const ICONS = ['dagger', 'sword', 'axe', 'lance', 'warhammer', 'spark', 'firebolt', 'lightning', 'meteor', 'cataclysm', 'battle-cry', 'twin-strike', 'dragons-fury', 'back'];
// [width, height, quality]: big cards, the six small cards, the page background.
const sizeOf = name => (name === 'bg' ? [720, 1280, 0.6] : ICONS.includes(name) ? [240, 336, 0.8] : [450, 630, 0.8]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const files = fs.readdirSync(RAW).filter(f => /\.(png|jpg)$/.test(f)).sort();
  let total = 0;
  for (const f of files) {
    const name = f.replace(/\.\w+$/, '');
    const [w, h, q] = sizeOf(name);
    const src = `data:image/${f.endsWith('png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(path.join(RAW, f)).toString('base64');
    // Scale to cover the target size and crop the overflow evenly.
    const out = await page.evaluate(async ({ src, w, h, q }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const k = Math.max(w / img.width, h / img.height), dw = img.width * k, dh = img.height * k;
      const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return c.toDataURL('image/webp', q);
    }, { src, w, h, q });
    const buf = Buffer.from(out.split(',')[1], 'base64');
    fs.writeFileSync(path.join(__dirname, name + '.webp'), buf);
    total += buf.length;
  }
  console.log(files.length, 'images,', Math.round(total / 1024), 'KB in total');

  const names = files.map(f => f.replace(/\.\w+$/, ''));
  fs.writeFileSync(path.join(__dirname, 'sheet.html'), `<body style="margin:8px;background:#222;color:#eee;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px">${
    names.map(n => `<div style="text-align:center"><img src="${n}.webp" style="height:270px;display:block">${n}</div>`).join('')}</body>`);
  await page.goto('file://' + path.join(__dirname, 'sheet.html'));
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(__dirname, 'sheet.png'), fullPage: true });
  await browser.close();
})();
