// Turn raw/ images into the small WebP files the game loads, and write a contact sheet.
// Figures (champ-*, boss-*) are cut out of their magenta background and trimmed to the figure.
// Uses Chromium's canvas (through Playwright) so no image tools need installing.
// usage: NODE_PATH=<dir with playwright> node convert.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'raw');
// [width, height, quality]. Figures: height only, width follows the trimmed figure.
const sizeOf = name => name === 'bg' ? [1120, 840, 0.6] : name === 'back' ? [240, 336, 0.8]
  : name.startsWith('card-') ? [360, 270, 0.8] : name.startsWith('boss-') ? [0, 440, 0.85] : [0, 340, 0.85];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const files = fs.readdirSync(RAW).filter(f => f.endsWith('.png')).sort();
  let total = 0;
  for (const f of files) {
    const name = f.replace(/\.\w+$/, '');
    const [w, h, q] = sizeOf(name);
    const src = 'data:image/png;base64,' + fs.readFileSync(path.join(RAW, f)).toString('base64');
    const out = await page.evaluate(async ({ src, w, h, q }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
      if (w) {
        // Scale to cover the target size and crop the overflow evenly.
        c.width = w; c.height = h;
        const k = Math.max(w / img.width, h / img.height), dw = img.width * k, dh = img.height * k;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return c.toDataURL('image/webp', q);
      }
      c.width = img.width; c.height = img.height;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
      // Magenta is high red and blue with low green, so "how magenta" is min(r, b) - g.
      // Fully keyed above 120, fully kept below 40, and pink spill on the edges is pulled back to grey.
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let i = 0; i < p.length; i += 4) {
        const m = Math.min(p[i], p[i + 2]) - p[i + 1];
        const a = m >= 120 ? 0 : m <= 40 ? 1 : (120 - m) / 80;
        if (m > 0 && a > 0) { const cut = m * 0.9; p[i] -= cut; p[i + 2] -= cut; }
        p[i + 3] = Math.round(a * 255);
        if (a > 0.5) { const x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      ctx.putImageData(d, 0, 0);
      const tw = x1 - x0 + 1, th = y1 - y0 + 1, o = document.createElement('canvas');
      o.height = h; o.width = Math.round(tw * h / th);
      const octx = o.getContext('2d'); octx.imageSmoothingQuality = 'high';
      octx.drawImage(c, x0, y0, tw, th, 0, 0, o.width, o.height);
      return o.toDataURL('image/webp', q);
    }, { src, w, h, q });
    const buf = Buffer.from(out.split(',')[1], 'base64');
    fs.writeFileSync(path.join(__dirname, name + '.webp'), buf);
    total += buf.length;
  }
  console.log(files.length, 'images,', Math.round(total / 1024), 'KB in total');

  const names = files.map(f => f.replace(/\.\w+$/, ''));
  const sheet = path.join(RAW, 'sheet.html');
  fs.writeFileSync(sheet, `<body style="margin:8px;background:#2c1f2e;color:#eee;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px">${
    names.map(n => `<div style="text-align:center"><img src="../${n}.webp" style="height:200px;display:block">${n}</div>`).join('')}</body>`);
  await page.goto('file://' + sheet);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(RAW, 'sheet.png'), fullPage: true });
  await browser.close();
})();
