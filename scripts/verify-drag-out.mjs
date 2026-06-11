/**
 * Smoke test for free movement in/out of slices: dragging a child off the
 * slice detaches it (slice drags no longer move it), dragging it back onto a
 * cell re-attaches it (slice drags move it again).
 *
 * Usage: node scripts/verify-drag-out.mjs (expects `vite preview` on :4173)
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
  await page.waitForSelector('.react-flow__node-readmodel');

  const center = async (selector) => {
    return page.$eval(selector, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
  };

  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 15 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 250));
  };

  const sliceBox = await page.$eval('[data-id="slice_demo"]', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
  });

  // 1. Drag the read model out of the slice onto open canvas
  const rmStart = await center('[data-id="readmodel_demo"]');
  await drag(rmStart, { x: sliceBox.right + 180, y: rmStart.y });
  const rmOut = await center('[data-id="readmodel_demo"]');
  check('element dragged outside the slice', rmOut.x > sliceBox.right);

  // 2. Move the slice: the detached element must stay, a child must follow
  const cmdBefore = await center('[data-id="command_demo"]');
  const handle = await center('[data-id="slice_demo"] .slice-drag-handle');
  await drag(handle, { x: handle.x, y: handle.y + 80 });
  const rmAfter = await center('[data-id="readmodel_demo"]');
  const cmdAfter = await center('[data-id="command_demo"]');
  check('detached element ignores slice movement', Math.abs(rmAfter.y - rmOut.y) < 3);
  check('remaining child follows slice movement', cmdAfter.y - cmdBefore.y > 40);

  // 3. Drag it back into an empty cell → it re-attaches
  const slice2 = await page.$eval('[data-id="slice_demo"]', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  // Actor lane (row 0), middle column — empty in the seed board
  const zoom = slice2.width / 632;
  const cellTarget = { x: slice2.x + (32 + 200 + 100) * zoom, y: slice2.y + (44 + 74) * zoom };
  await drag(await center('[data-id="readmodel_demo"]'), cellTarget);

  const rmIn = await center('[data-id="readmodel_demo"]');
  const handle2 = await center('[data-id="slice_demo"] .slice-drag-handle');
  await drag(handle2, { x: handle2.x, y: handle2.y + 80 });
  const rmMoved = await center('[data-id="readmodel_demo"]');
  check('re-attached element follows slice movement', rmMoved.y - rmIn.y > 40);

  await page.screenshot({ path: '/tmp/em-drag-out.png' });
} finally {
  await browser.close();
}

for (const { name, pass } of results) console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`);
if (results.some((r) => !r.pass)) process.exitCode = 1;
