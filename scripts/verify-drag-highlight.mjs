/**
 * Smoke test for the drop-target cell highlight: drags the free processor
 * node over the demo slice (an empty cell, then an occupied one) and checks
 * that the overlay appears with the right validity color mid-drag.
 *
 * Usage: node scripts/verify-drag-highlight.mjs (expects `vite preview` on :4173)
 */
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,900'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow__node-processor');

  const box = async (selector) => {
    const handle = await page.$(selector);
    const b = await handle.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  const processor = await box('[data-id="processor_demo"]');
  const emptyActorCell = await box('[data-id="slice_demo"]'); // slice center-x, but use Actor lane y
  const slice = await page.$('[data-id="slice_demo"]');
  const sliceBox = await slice.boundingBox();
  // Actor lane row 0, column 0 center (gutter 32 + cell 200/2, header 44 + cell 148/2, zoom-scaled is fine: fitView zoom ~1)
  const zoom = sliceBox.width / 632;
  const actorCell = { x: sliceBox.x + (32 + 100) * zoom, y: sliceBox.y + (44 + 74) * zoom };
  const occupiedCell = await box('[data-id="command_demo"]');

  // Drag processor over the empty Actor cell — expect a valid (indigo) highlight.
  await page.mouse.move(processor.x, processor.y);
  await page.mouse.down();
  await page.mouse.move(actorCell.x, actorCell.y, { steps: 10 });
  await new Promise((r) => setTimeout(r, 150));
  const validHighlight = await page.$eval('[data-id="slice_demo"]', (el) => {
    const overlay = el.querySelector('.border-indigo-400.pointer-events-none');
    return overlay ? overlay.className : null;
  });
  await page.screenshot({ path: '/tmp/em-drag-valid.png' });

  // Continue the drag onto the occupied command cell — expect an invalid (red) highlight.
  await page.mouse.move(occupiedCell.x, occupiedCell.y, { steps: 10 });
  await new Promise((r) => setTimeout(r, 150));
  const invalidHighlight = await page.$eval('[data-id="slice_demo"]', (el) => {
    const overlay = el.querySelector('[class*="border-red-400"]');
    return overlay ? overlay.className : null;
  });
  await page.screenshot({ path: '/tmp/em-drag-invalid.png' });

  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 150));
  const clearedAfterDrop = await page.$eval(
    '[data-id="slice_demo"]',
    (el) => el.querySelector('.border-indigo-400.pointer-events-none, [class*="border-red-400"]') === null,
  );

  console.log('valid-highlight over empty cell :', validHighlight ? 'PASS' : 'FAIL');
  console.log('invalid-highlight over occupied:', invalidHighlight ? 'PASS' : 'FAIL');
  console.log('highlight cleared after drop   :', clearedAfterDrop ? 'PASS' : 'FAIL');
  if (!validHighlight || !invalidHighlight || !clearedAfterDrop) process.exitCode = 1;
} finally {
  await browser.close();
}
