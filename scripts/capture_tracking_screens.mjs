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
  await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 2 });

  console.log('1. Navigating to public tracking page...');
  await page.goto('http://127.0.0.1:4321/tracking?code=GOSH-2026-9812', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));

  // Screenshot 1: Trade Corridor & Goods
  const file1 = path.join(ARTIFACT_DIR, 'tracking_trade_corridor_view.png');
  await page.screenshot({ path: file1 });
  console.log('Saved:', file1);

  // Switch to Milestones Tab
  console.log('2. Switching to Milestones & Specs view...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find((b) => b.textContent && b.textContent.includes('Milestones & Consignment Specs'));
    if (target) target.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Expand first milestone details
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find((b) => b.textContent && b.textContent.includes('See Details'));
    if (target) target.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Screenshot 2: Timeline & Milestones
  const file2 = path.join(ARTIFACT_DIR, 'tracking_milestones_specs_view.png');
  await page.screenshot({ path: file2 });
  console.log('Saved:', file2);

  // 3. Log in as Super Admin
  console.log('3. Logging into Admin Portal...');
  await page.goto('http://127.0.0.1:4321/login?redirect=/admin?tab=shipments', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Click #btn-admin to log in automatically
  await page.click('#btn-admin');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('4. Navigating to Admin Consignments & Telemetry...');
  await page.goto('http://127.0.0.1:4321/admin?tab=shipments', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));

  const file3 = path.join(ARTIFACT_DIR, 'admin_tracking_telemetry_desk.png');
  await page.screenshot({ path: file3 });
  console.log('Saved:', file3);

  // 5. Click "+ Milestone" to show modal
  console.log('5. Opening Milestone modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find((b) => b.textContent && b.textContent.includes('Add Milestone'));
    if (target) target.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const file4 = path.join(ARTIFACT_DIR, 'admin_milestone_modal.png');
  await page.screenshot({ path: file4 });
  console.log('Saved:', file4);

  await browser.close();
  console.log('All screenshots captured successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
