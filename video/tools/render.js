// Usage: node render.js <startFrame> <endFrame(exclusive)> <step> <outDir> [port]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [a, b, step, out, port] = [+process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6] || 8765];
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGEERR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction('window.ready===true', null, { timeout: 120000 });
  const fps = await page.evaluate('TL.fps');
  const t0 = Date.now();
  for (let f = a; f < b; f += step) {
    await page.evaluate(t => window.frame(t), f / fps);
    await page.screenshot({ path: `${out}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
    if (((f - a) / step) % 20 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await browser.close();
})();
