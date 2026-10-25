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

  // Compute exact scroll position for scrollProgress = 0.54 (Scene 4)
  const targetScroll = await page.evaluate(() => {
    const el = document.getElementById('industrial-services');
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const totalDist = el.offsetHeight - window.innerHeight;
    const target = (window.scrollY + rect.top) + (totalDist * 0.54);
    return target;
  });

  console.log('Target scroll for Scene 4:', targetScroll);

  await page.evaluate((pos) => {
    window.scrollTo({ top: pos, behavior: 'instant' });
  }, targetScroll);
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: '/Users/jitkumarsaha/.gemini/antigravity/brain/ae80964c-6633-400a-a3cc-0372b4651dd5/highway_simplified_exact_scene4.png'
  });

  await browser.close();
  console.log('Scene 4 screenshot captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
