/**
 * Smoke test for the screen wireframe feature: the seeded preview renders,
 * the editor opens from the node's "Design screen UI" button, a mockup and a
 * freehand stroke can be added, and saving updates the preview in the node.
 *
 * Usage: node scripts/verify-wireframe.mjs (expects `vite preview` on :4173)
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
  await page.waitForSelector('.react-flow__node-screen');

  // 1. Seeded wireframe preview renders inside the screen node
  const seededPreview = await page.$eval(
    '.react-flow__node-screen',
    (el) => el.querySelectorAll('svg[aria-label="Screen wireframe preview"] text').length,
  );
  check('seeded preview renders in node', seededPreview > 0);

  // 2. Open the editor via the header button
  await page.$eval('[title="Design screen UI"]', (el) => el.click());
  await page.waitForSelector('[aria-label="Wireframe editor"]');
  check('editor opens from node button', true);

  // 3. Add a Button mockup from the palette
  await page.evaluate(() => {
    [...document.querySelectorAll('[aria-label="Wireframe editor"] button')]
      .find((b) => b.textContent.trim() === 'Button')
      .click();
  });
  const buttonAdded = await page.$$eval('[aria-label="Wireframe editor"] svg text', (els) =>
    els.some((el) => el.textContent === 'Button'),
  );
  check('mockup button added to canvas', buttonAdded);

  // 3b. Rename the freshly placed (auto-selected) button via the properties bar
  await page.$eval('[aria-label="Element text"]', (el) => {
    el.focus();
    el.select();
  });
  await page.keyboard.press('Backspace'); // must clear the field, not delete the element
  await page.keyboard.type('Buy now');
  const renamed = await page.$$eval('[aria-label="Wireframe editor"] svg text', (els) =>
    els.some((el) => el.textContent === 'Buy now'),
  );
  const stillPresent = await page.$$eval(
    '[aria-label="Wireframe editor"] svg rect[rx="5"]',
    (els) => els.length > 0,
  );
  check('button renamed via properties bar', renamed && stillPresent);

  // 3c. Inline rename: double-click the button, edit directly on the canvas
  const btnPos = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[aria-label="Wireframe editor"] svg text')].find(
      (el) => el.textContent === 'Buy now',
    );
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(btnPos.x, btnPos.y);
  await page.mouse.click(btnPos.x, btnPos.y); // second click within 350ms → inline edit
  const inlineInput = await page.waitForSelector('[aria-label="Edit element text inline"]', { timeout: 2000 });
  check('double-click opens inline input', inlineInput !== null);
  const prefilled = await inlineInput.evaluate((el) => el.value);
  check('inline input prefilled with current text', prefilled === 'Buy now');
  await inlineInput.evaluate((el) => {
    el.focus();
    el.select();
  });
  await page.keyboard.type('Pay now');
  await page.keyboard.press('Enter');
  const inlineRenamed = await page.$$eval('[aria-label="Wireframe editor"] svg text', (els) =>
    els.some((el) => el.textContent === 'Pay now'),
  );
  check('button renamed inline', inlineRenamed);

  // 3d. Text mockup starts inline editing immediately (no tool, no dialog)
  await page.evaluate(() => {
    [...document.querySelectorAll('[aria-label="Wireframe editor"] button')]
      .find((b) => b.textContent.trim() === 'Text')
      .click();
  });
  const textInput = await page.waitForSelector('[aria-label="Edit element text inline"]', { timeout: 2000 });
  const noDialog = (await page.$('[aria-labelledby="dialog-title"]')) === null;
  check('text mockup edits inline without dialog', noDialog);
  await textInput.evaluate((el) => {
    el.focus();
    el.select();
  });
  await page.keyboard.type('Free shipping over €50');
  await page.keyboard.press('Enter');
  const textPlaced = await page.$$eval('[aria-label="Wireframe editor"] svg text', (els) =>
    els.some((el) => el.textContent === 'Free shipping over €50'),
  );
  check('placed text committed inline', textPlaced);

  // 4. Freehand stroke with the draw tool
  await page.$eval('[title="Draw by hand"]', (el) => el.click());
  const canvas = await page.$('[aria-label="Wireframe editor"] svg.touch-none');
  const box = await canvas.boundingBox();
  const pathsBefore = await page.$$eval('[aria-label="Wireframe editor"] svg path', (els) => els.length);
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8, { steps: 12 });
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();
  const pathsAfter = await page.$$eval('[aria-label="Wireframe editor"] svg path', (els) => els.length);
  check('freehand stroke drawn', pathsAfter > pathsBefore);

  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: '/tmp/em-wireframe-editor.png' });

  // 5. Save and verify the node preview now contains the new content
  await page.evaluate(() => {
    [...document.querySelectorAll('[aria-label="Wireframe editor"] button')]
      .find((b) => b.textContent.trim() === 'Save')
      .click();
  });
  await new Promise((r) => setTimeout(r, 300));
  check('editor closes on save', (await page.$('[aria-label="Wireframe editor"]')) === null);

  const preview = await page.$eval('.react-flow__node-screen', (el) => {
    const svg = el.querySelector('svg[aria-label="Screen wireframe preview"]');
    return {
      hasButton: [...svg.querySelectorAll('text')].some((t) => t.textContent === 'Pay now'),
      hasStroke: svg.querySelectorAll('path').length > 0,
    };
  });
  check('saved renamed mockup visible in node preview', preview.hasButton);
  check('saved stroke visible in node preview', preview.hasStroke);

  await page.screenshot({ path: '/tmp/em-wireframe-node.png' });
} finally {
  await browser.close();
}

for (const { name, pass } of results) console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`);
if (results.some((r) => !r.pass)) process.exitCode = 1;
