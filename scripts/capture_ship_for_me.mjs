import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/Users/jitkumarsaha/.local/opt/node-v24.16.0-darwin-arm64/lib/node_modules/puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Find quote-section / ship-for-me position
  const targetPos = await page.evaluate(() => {
    const el = document.getElementById('quote-section');
    if (el) {
      const rect = el.getBoundingClientRect();
      return window.scrollY + rect.top - 80;
    }
    return 3000;
  });

  console.log('Ship for me position:', targetPos);

  await page.evaluate((pos) => {
    window.scrollTo({ top: pos, behavior: 'instant' });
  }, targetPos);
  await new Promise(r => setTimeout(r, 800));

  await page.screenshot({
    path: '/Users/jitkumarsaha/.gemini/antigravity/brain/ae80964c-6633-400a-a3cc-0372b4651dd5/ship_for_me_verified.png'
  });

  await browser.close();
  console.log('Ship for Me screenshot captured!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
