/**
 * Smoke test for the React dialog system: the swimlane rename prompt and the
 * Clear Board confirm (cancel keeps the board, confirm empties it).
 *
 * Usage: node scripts/verify-dialogs.mjs (expects `vite preview` on :4173)
 */
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,900'],
});

const results = [];
const check = (name, pass) => results.push({ name, pass });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow__node-slice');

  const nodeCount = () => page.$$eval('.react-flow__node', (els) => els.length);

  // 1. Swimlane rename via prompt dialog (dispatch dblclick directly — the
  // CDP mouse double-click is not reliably synthesized into a dblclick event).
  await page.$$eval('[title="Double-click to rename lane"]', (els) => {
    els[els.length - 1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('[role="dialog"]');
  await new Promise((r) => setTimeout(r, 300)); // let the enter animation finish
  await page.screenshot({ path: '/tmp/em-dialog-prompt.png' });
  const promptInput = await page.$('[role="dialog"] input');
  check('prompt dialog opens with input', promptInput !== null);

  await page.$eval('[role="dialog"] input', (el) => {
    el.focus();
    el.select();
  });
  await page.keyboard.type('Persona');
  const buttons = await page.$$('[role="dialog"] button');
  await buttons[buttons.length - 1].click(); // "Rename"
  await new Promise((r) => setTimeout(r, 200));
  const laneRenamed = await page.$$eval('.react-flow__node-slice span', (els) =>
    els.some((el) => el.textContent === 'Persona'),
  );
  check('lane renamed through prompt', laneRenamed);
  check('dialog closed after rename', (await page.$('[role="dialog"]')) === null);

  // 2. Clear Board → Cancel keeps everything
  const before = await nodeCount();
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Clear Board')).click();
  });
  await page.waitForSelector('[role="dialog"]');
  await new Promise((r) => setTimeout(r, 300)); // let the enter animation finish
  await page.screenshot({ path: '/tmp/em-dialog-confirm.png' });
  await page.evaluate(() => {
    [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Cancel').click();
  });
  await new Promise((r) => setTimeout(r, 200));
  check('cancel keeps the board', (await nodeCount()) === before && before > 0);

  // 3. Clear Board → Confirm empties the board
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Clear Board')).click();
  });
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() => {
    [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Clear Board').click();
  });
  await new Promise((r) => setTimeout(r, 200));
  check('confirm clears the board', (await nodeCount()) === 0);
} finally {
  await browser.close();
}

for (const { name, pass } of results) console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`);
if (results.some((r) => !r.pass)) process.exitCode = 1;
