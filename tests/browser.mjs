// Real app + real Firebase web SDKs; only the configuration is redirected to local emulators.
// Run after starting Firestore (8088) and Auth (9098), using a demo project only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'test-results');
await mkdir(artifacts, { recursive: true });
const env = await initializeTestEnvironment({ projectId: 'demo-venture-pick', firestore: {
  host: '127.0.0.1', port: 8088, rules: await readFile(`${root}/firestore.rules`, 'utf8')
}});
await env.clearFirestore();
await fetch('http://127.0.0.1:9098/emulator/v1/projects/demo-venture-pick/accounts', { method: 'DELETE' });
const response = await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'teacher@example.test', password: 'test-password-123', returnSecureToken: true })
});
const user = await response.json();
assert.ok(user.localId, JSON.stringify(user));
await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'admins', user.localId), { enabled: true }));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/classroom/')) { res.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice('/classroom/'.length)) || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root + '/')) throw new Error('Invalid path');
    let body = await readFile(path);
    if (relative === 'js/firebase-config.js') body = `export const FIREBASE_CONFIG = ${JSON.stringify({
      apiKey: 'demo-api-key', projectId: 'demo-venture-pick', authDomain: 'demo-venture-pick.firebaseapp.com', appId: 'demo-app'
    })};`;
    if (relative === 'js/firebase.js') body = body.toString()
      .replace('{ getFirestore }', '{ getFirestore, connectFirestoreEmulator }')
      .replace('{ getAuth }', '{ getAuth, connectAuthEmulator }')
      .replace('db = getFirestore(app);', 'db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8088);')
      .replace('auth = getAuth(app);', 'auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/classroom/`;
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const errors = [];
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const admin = await adminContext.newPage();
const student = await mobileContext.newPage();
for (const page of [admin, student]) {
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(15000);
}
const waitText = (page, selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
const enter = async (team, person, pin) => {
  await student.selectOption('#teamSelect', team);
  await student.selectOption('#personSelect', String(person));
  await student.fill('#pinInput', pin);
  await student.click('#enterButton');
  await student.locator('#investmentApp').waitFor({ state: 'visible' });
};
const submit = async (accept = true) => {
  let message;
  student.once('dialog', async dialog => {
    message = dialog.message();
    if (accept) await dialog.accept(); else await dialog.dismiss();
  });
  await student.click('#submitButton');
  assert.match(message, /남아 있습니다/);
};
const assertNoOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'horizontal overflow');
try {
  await admin.goto(base + 'admin.html');
  await admin.fill('#emailInput', 'teacher@example.test');
  await admin.fill('#passwordInput', 'test-password-123');
  await admin.click('#loginButton');
  await admin.locator('#createSessionButton').waitFor({ state: 'visible' });
  await admin.click('#createSessionButton');
  await admin.locator('#teamEditors input').first().waitFor();
  await admin.fill('#titleInput', '우리들의 벤처 프로젝트');
  await admin.fill('#subtitleInput', '당신의 선택이, 다음 가능성이 됩니다.');
  await admin.fill('#budgetInput', '105000000');
  await admin.fill('#unitInput', '10000000');
  for (let i = 0; i < 4; i++) {
    const card = admin.locator(`[data-team-index="${i}"]`);
    await card.locator('[data-field="people"]').fill(String(i + 2));
    await card.locator('[data-field="pin"]').fill(String(i + 1).repeat(8));
    await card.locator('[data-field="biz"]').fill(['Local Loop', 'Slow Stay', 'Trip Match', 'Hidden Scene'][i]);
    await card.locator('[data-field="desc"]').fill(`프로젝트 ${i + 1}의 가능성에 투자하세요.`);
    await card.locator('[data-field="landingUrl"]').fill(`landing/team${i + 1}.html?project=1`);
    await card.locator('[data-field="thumbnail"]').fill(`assets/team${i + 1}.svg?v=2`);
  }
  await admin.click('#saveAllButton');
  await waitText(admin, '#adminMsg', '설정이 저장되었습니다');
  await admin.click('#toggleOpenButton');
  await waitText(admin, '#openStateText', '받고 있습니다');
  await student.goto(base);
  await waitText(student, '#projectTitle', '우리들의 벤처 프로젝트');
  for (let i = 1; i <= 4; i++) {
    await student.selectOption('#teamSelect', `team${i}`);
    assert.equal(await student.locator('#personSelect option').count(), i + 1);
  }
  await student.fill('#pinInput', '0000');
  await student.click('#enterButton');
  await waitText(student, '#entryMsg', 'PIN이 맞지');
  await enter('team1', 1, '11111111');
  assert.equal(await student.locator('[data-invest-scroll="team1"]').isDisabled(), true);
  assert.equal(await student.locator('[data-plus]').count(), 3);
  for (let i = 0; i < 10; i++) await student.click('[data-plus="team2"]');
  assert.equal(await student.locator('[data-plus="team3"]').isDisabled(), true);
  for (let i = 0; i < 7; i++) await student.click('[data-minus="team2"]');
  await student.click('[data-plus="team3"]');
  await assertNoOverflow(student);
  await student.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await student.screenshot({ path: `${artifacts}/student-mobile.png`, fullPage: true });
  await submit(false);
  assert.equal(await student.locator('#submitButton').isEnabled(), true);
  await submit();
  await waitText(student, '#studentMsg', '제출이 완료');
  assert.equal(await student.locator('[data-plus="team2"]').isDisabled(), true);
  await waitText(admin, '#submissionsTable', '3천만원');
  await student.click('#changeInvestorButton');
  await enter('team1', 1, '11111111');
  assert.equal(await student.locator('#submitButton').isEnabled(), true);
  await submit();
  await waitText(student, '#studentMsg', '이미 제출한 번호');
  await student.click('#changeInvestorButton');
  await enter('team2', 1, '22222222');
  await student.click('[data-plus="team1"]');
  await student.click('[data-plus="team1"]');
  await submit();
  await waitText(student, '#studentMsg', '제출이 완료');
  await student.click('#changeInvestorButton');
  await enter('team3', 1, '33333333');
  await submit(); // Zero investment counts as an external evaluator.
  await waitText(student, '#studentMsg', '제출이 완료');
  await waitText(admin, '#statusCards', '1 / 4');
  await admin.click('#toggleOpenButton');
  await waitText(admin, '#openStateText', '마감');
  await student.click('#changeInvestorButton');
  assert.equal(await student.locator('#enterButton').isDisabled(), true);
  const downloadPromise = admin.waitForEvent('download');
  await admin.click('#exportButton');
  const download = await downloadPromise;
  await download.saveAs(`${artifacts}/submissions.csv`);
  const csv = await readFile(`${artifacts}/submissions.csv`, 'utf8');
  assert.ok(csv.includes('30000000'));
  assert.ok(!csv.includes('11111111')); // PINs must not be exported.
  await admin.evaluate(() => {
    window.revealOrder = [];
    new MutationObserver(records => {
      for (const r of records) if (r.target.matches?.('.podium-item.show')) {
        const rank = r.target.classList.contains('second') ? 2 : r.target.classList.contains('third') ? 3 : 1;
        if (!window.revealOrder.includes(rank)) window.revealOrder.push(rank);
      }
    }).observe(document.querySelector('#resultArea'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await admin.click('#revealButton');
  await admin.locator('#rankingTable').waitFor({ state: 'visible' });
  assert.deepEqual(await admin.evaluate(() => window.revealOrder), [2, 3, 1]);
  assert.equal(await admin.locator('.confetti').count(), 90);
  const positions = await admin.locator('.podium-item').evaluateAll(items => items.map(i => ({
    x: i.getBoundingClientRect().x, height: i.querySelector('.step').getBoundingClientRect().height
  })));
  assert.ok(positions[0].x < positions[1].x && positions[1].x < positions[2].x);
  assert.ok(positions[1].height > positions[0].height && positions[0].height > positions[2].height);
  await admin.locator('.results-stage').screenshot({ animations: 'disabled', path: `${artifacts}/podium-desktop.png` });
  assert.equal(await admin.locator('.results-stage').evaluate(stage => {
    const titleBottom = stage.querySelector('.stage-title').getBoundingClientRect().bottom;
    return [...stage.querySelectorAll('.podium-item')].every(item => item.getBoundingClientRect().top >= titleBottom);
  }), true, 'podium must not overlap the result heading');
  await admin.screenshot({ path: `${artifacts}/admin-desktop.png`, fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await admin.setViewportSize({ width, height: 900 });
    await student.setViewportSize({ width, height: 900 });
    await assertNoOverflow(admin); await assertNoOverflow(student);
  }
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.locator('.results-stage').screenshot({ animations: 'disabled', path: `${artifacts}/podium-mobile.png` });
  admin.once('dialog', dialog => dialog.accept());
  await admin.click('#resetButton');
  await waitText(admin, '#adminMsg', '모든 제출을 초기화');
  await waitText(admin, '#submissionsTable', '아직 제출이 없습니다');
  await env.withSecurityRulesDisabled(async c => {
    const snap = await getDocs(collection(c.firestore(), 'sessions', 'venture-pick-2026', 'submissions'));
    assert.equal(snap.size, 0);
  });
  await admin.click('#logoutButton');
  await admin.locator('#loginView').waitFor({ state: 'visible' });
  assert.equal(await admin.locator('#teamEditors').innerHTML(), '');
} finally {
  await admin.screenshot({ path: `${artifacts}/last-admin.png`, fullPage: true }).catch(() => {});
  await student.screenshot({ path: `${artifacts}/last-student.png`, fullPage: true }).catch(() => {});
  await browser.close();
  await env.cleanup();
  await new Promise(resolve => server.close(resolve));
}
assert.deepEqual(errors, []);
console.log('PASS: login, settings, PIN, budget, partial/zero submissions, duplicates, live totals, CSV, reveal order, mobile layout.');
