import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const puppeteer = require('/Users/jitkumarsaha/.local/opt/node-v24.16.0-darwin-arm64/lib/node_modules/puppeteer-core');

const ARTIFACT_DIR = '/Users/jitkumarsaha/.gemini/antigravity/brain/ae80964c-6633-400a-a3cc-0372b4651dd5';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  console.log('1. Loading homepage with WhatsApp widget...');
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));

  // Screenshot 1: Closed widget pill launcher at bottom-right
  const file1 = path.join(ARTIFACT_DIR, 'whatsapp_widget_closed.png');
  await page.screenshot({ path: file1 });
  console.log('Saved:', file1);

  // 2. Click to open WhatsApp widget
  console.log('2. Opening WhatsApp widget...');
  await page.click('button[aria-label="Open WhatsApp Live Support"]');
  await new Promise((r) => setTimeout(r, 600));

  // Screenshot 2: Opened live chat drawer
  const file2 = path.join(ARTIFACT_DIR, 'whatsapp_widget_opened.png');
  await page.screenshot({ path: file2 });
  console.log('Saved:', file2);

  // 3. Type a message in the chat input
  console.log('3. Typing message in chat...');
  const inputEl = await page.$('input[placeholder="Type message or tracking code..."]');
  if (inputEl) {
    await inputEl.type('Hello GoShipping, I need a rate for 120 KG air cargo Guangzhou to Dhaka');
    await new Promise((r) => setTimeout(r, 400));
  }

  // Screenshot 3: Active typed message
  const file3 = path.join(ARTIFACT_DIR, 'whatsapp_widget_typed.png');
  await page.screenshot({ path: file3 });
  console.log('Saved:', file3);

  await browser.close();
  console.log('All WhatsApp widget previews captured successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
