/**
 * Smoke test for context-highlight dim propagation: imports a fixture board
 * and checks that greying flows through connected chains, that elements fed
 * by at least one active event stay bright, that event-less flows are exempt,
 * and that edges fade with their dimmed endpoints.
 *
 * Fixture topology:
 *   screen1 -> command1 -> event1(Student) -> readmodel1
 *                          event2(Billing) -> readmodel1   (shared target)
 *   screen2 -> command2                                    (no event in flow)
 *
 * Usage: node scripts/verify-context-dimming.mjs (expects `vite preview` on :4173)
 */
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIXTURE_PATH = '/tmp/em-dimming-fixture.json';

const el = (id, type, x, y, data) => ({ id, type, position: { x, y }, data });
const edge = (id, source, target) => ({ id, source, target, sourceHandle: 'right', targetHandle: 'left' });

writeFileSync(
  FIXTURE_PATH,
  JSON.stringify({
    contexts: ['default', 'Student', 'Billing'],
    nodes: [
      el('screen1', 'screen', 0, 0, { label: 'Screen 1' }),
      el('command1', 'command', 250, 0, { label: 'Command 1' }),
      el('event1', 'event', 500, 0, { label: 'Event 1', contexts: ['Student'] }),
      el('event2', 'event', 500, 200, { label: 'Event 2', contexts: ['Billing'] }),
      el('readmodel1', 'readmodel', 750, 100, { label: 'Read Model 1' }),
      el('screen2', 'screen', 0, 400, { label: 'Screen 2' }),
      el('command2', 'command', 250, 400, { label: 'Command 2' }),
    ],
    edges: [
      edge('e1', 'screen1', 'command1'),
      edge('e2', 'command1', 'event1'),
      edge('e3', 'event1', 'readmodel1'),
      edge('e4', 'event2', 'readmodel1'),
      edge('e5', 'screen2', 'command2'),
    ],
  }),
);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,900'],
});

const results = [];
function check(name, pass) {
  results.push([name, pass]);
  if (!pass) process.exitCode = 1;
}

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow__node');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(400);

  // Import the fixture through the hidden file input.
  const input = await page.$('input[type="file"]');
  await input.uploadFile(FIXTURE_PATH);
  await page.waitForSelector('[data-id="event2"]');
  await wait(400);

  const dimmedNodes = () =>
    page.$$eval('.react-flow__node', (nodes) =>
      nodes
        .filter((n) => n.querySelector('.group')?.className.includes('opacity-25'))
        .map((n) => n.getAttribute('data-id'))
        .sort(),
    );
  const dimmedEdges = () =>
    page.$$eval('.react-flow__edge', (edges) =>
      edges.filter((e) => e.classList.contains('dimmed-edge')).map((e) => e.getAttribute('data-id')).sort(),
    );
  const openManager = async () => {
    await page.click('button[title="Manage contexts"]');
    await page.waitForSelector('[role="dialog"]');
  };
  const closeManager = async () => {
    await page.click('[role="dialog"] button ::-p-text(Done)');
    await wait(250);
  };
  const toggleHighlight = async (name) => {
    await page.click(`[role="dialog"] button[title="Toggle highlight for ${name}"]`);
    await wait(250);
  };

  check('nothing dimmed before highlighting', (await dimmedNodes()).length === 0);

  // Highlight Student: event2 dims; event1's chain and the shared read model
  // stay bright; the event-less screen2/command2 pair stays bright.
  await openManager();
  await toggleHighlight('Student');
  await closeManager();
  let nodes = await dimmedNodes();
  check('Student active: only event2 dims', JSON.stringify(nodes) === JSON.stringify(['event2']));
  let edgesDimmed = await dimmedEdges();
  check('Student active: only event2->readmodel1 edge dims', JSON.stringify(edgesDimmed) === JSON.stringify(['e4']));
  await page.screenshot({ path: '/tmp/em-dim-student.png' });

  // Switch to Billing: event1's whole upstream chain dims; readmodel1 stays
  // bright (fed by active event2); the event-less pair stays bright.
  await openManager();
  await toggleHighlight('Student');
  await toggleHighlight('Billing');
  await closeManager();
  nodes = await dimmedNodes();
  check(
    'Billing active: whole event1 chain dims, shared target stays bright',
    JSON.stringify(nodes) === JSON.stringify(['command1', 'event1', 'screen1']),
  );
  edgesDimmed = await dimmedEdges();
  check(
    'Billing active: chain edges dim, event2 edge stays bright',
    JSON.stringify(edgesDimmed) === JSON.stringify(['e1', 'e2', 'e3']),
  );
  await page.screenshot({ path: '/tmp/em-dim-billing.png' });

  // Clear highlighting: everything back to full opacity.
  await openManager();
  await page.click('[role="dialog"] button ::-p-text(Clear highlighting)');
  await wait(250);
  await closeManager();
  check('clearing highlight undims everything', (await dimmedNodes()).length === 0);
  check('clearing highlight restores all edges', (await dimmedEdges()).length === 0);
} finally {
  await browser.close();
}

for (const [name, pass] of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
