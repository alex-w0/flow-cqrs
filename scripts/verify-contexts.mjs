/**
 * Smoke test for DCB contexts: manages contexts via the toolbar dialog,
 * assigns them to an event in the element editor, and checks tag rendering,
 * multi-context highlight dimming, rename/delete cascades, and that the
 * default context is deletable.
 *
 * Usage: node scripts/verify-contexts.mjs (expects `vite preview` on :4173)
 */
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
  await page.waitForSelector('.react-flow__node-processor');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(500);

  const eventTags = () =>
    page.$eval('[data-id="event_demo"]', (el) =>
      [...el.querySelectorAll('span')].filter((s) => s.className.includes('rounded-full border')).map((s) => s.textContent.trim()),
    );
  const eventDimmed = () =>
    page.$eval('[data-id="event_demo"] .group', (el) => el.className.includes('opacity-25'));
  const openManager = async () => {
    await page.click('button[title="Manage contexts"]');
    await page.waitForSelector('[role="dialog"]');
  };
  const closeManager = async () => {
    await page.click('[role="dialog"] button ::-p-text(Done)');
    await wait(200);
  };
  const addContext = async (name) => {
    await page.click('[role="dialog"] input[placeholder="New context, e.g. Student"]');
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await wait(200);
  };
  const toggleHighlight = async (name) => {
    await page.click(`[role="dialog"] button[title="Toggle highlight for ${name}"]`);
    await wait(200);
  };

  // 1. Only "default" exists: no tags anywhere.
  check('no tags while only default exists', (await eventTags()).length === 0);

  // 2. Add "Student" via the manager → default tag appears on the event.
  await openManager();
  await addContext('Student');
  const rows = await page.$$eval('[role="dialog"] ul li', (lis) => lis.length);
  check('manager lists two contexts', rows === 2);
  await closeManager();
  let tags = await eventTags();
  check('default tag appears at >=2 contexts', tags.length === 1 && tags[0] === 'default');

  // 3. Assign "Student" in the element editor.
  await page.$eval('[data-id="event_demo"] .group > div', (el) =>
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await page.waitForSelector('[role="dialog"]');
  await page.click('[role="dialog"] button[aria-pressed="false"] ::-p-text(Student)');
  await page.click('[role="dialog"] button ::-p-text(Save)');
  await wait(300);
  tags = await eventTags();
  check('both tags on card after assignment', tags.includes('default') && tags.includes('Student'));
  await page.screenshot({ path: '/tmp/em-contexts-tags.png' });

  // 4. Multi-context highlighting: Billing alone dims the event — and its
  //    whole connected chain (command upstream); adding Student to the
  //    active set un-dims both.
  await openManager();
  await addContext('Billing');
  await toggleHighlight('Billing');
  check('event dims when only a foreign context is highlighted', await eventDimmed());
  const commandDimmedWithBilling = await page.$eval('[data-id="command_demo"] .group', (el) =>
    el.className.includes('opacity-25'));
  check('connected command dims with its event', commandDimmedWithBilling);
  await toggleHighlight('Student');
  check('event undims when one of multiple highlighted contexts matches', !(await eventDimmed()));
  const commandDimmedWithStudent = await page.$eval('[data-id="command_demo"] .group', (el) =>
    el.className.includes('opacity-25'));
  check('connected command undims with its event', !commandDimmedWithStudent);
  await closeManager();
  const toolbarText = await page.$eval('button[title="Manage contexts"]', (el) => el.textContent);
  check('toolbar shows both active context pills', toolbarText.includes('Billing') && toolbarText.includes('Student'));
  await page.screenshot({ path: '/tmp/em-contexts-highlight.png' });

  // 5. Rename cascades to the card tag and the active highlight set.
  await openManager();
  await page.click('[role="dialog"] button[title="Rename Student"]');
  await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
  await page.keyboard.type('Learner');
  await page.keyboard.press('Enter');
  await wait(300);
  await closeManager();
  tags = await eventTags();
  check('rename cascades to card tag', tags.includes('Learner') && !tags.includes('Student'));
  const toolbarAfterRename = await page.$eval('button[title="Manage contexts"]', (el) => el.textContent);
  check('rename cascades to active highlight pill', toolbarAfterRename.includes('Learner'));

  // 6. Delete cascades; event keeps remaining contexts.
  await openManager();
  await page.click('[role="dialog"] button[title="Delete Learner"]');
  await wait(300);
  await closeManager();
  tags = await eventTags();
  check('delete removes tag from card', !tags.includes('Learner') && tags.includes('default'));

  // 7. The default context itself is deletable; event becomes context-less
  //    (tags row disappears entirely since only one context remains).
  await openManager();
  await page.click('[role="dialog"] button[title="Delete default"]');
  await wait(300);
  const rowsAfterDefaultDelete = await page.$$eval('[role="dialog"] ul li', (lis) =>
    lis.map((li) => li.querySelector('span').textContent.trim()));
  check('default can be deleted', rowsAfterDefaultDelete.length === 1 && rowsAfterDefaultDelete[0] === 'Billing');
  await closeManager();
  check('no stale tags after default deleted', (await eventTags()).length === 0);
} finally {
  await browser.close();
}

for (const [name, pass] of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
