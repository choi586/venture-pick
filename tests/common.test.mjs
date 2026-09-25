import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../js/default-config.js';
import { calculateRanking, validateConfig, validInvestments, safeUrl, hashPin, money, downloadCsv } from '../js/common.js';

test('ranking uses total investment first; average remains a reference based on actual external submissions', () => {
  const config = structuredClone(DEFAULT_CONFIG);
  config.teamCounts = { team1: 99, team2: 2, team3: 40, team4: 1 };
  const results = calculateRanking(config, [
    { teamId: 'team1', investments: { team2: 60, team3: 40 } },
    { teamId: 'team1', investments: { team2: 60, team3: 0 } },
    { teamId: 'team2', investments: { team1: 100 } },
  ]);
  assert.equal(results[0].team.id, 'team2'); // Total 120 beats 100, despite average 60 vs 100.
  assert.deepEqual(results.map(x => [x.team.id, x.total, x.eligible, x.avg]), [
    ['team2', 120, 2, 60], ['team1', 100, 1, 100], ['team3', 40, 3, 40 / 3], ['team4', 0, 3, 0]
  ]);
  assert.ok(calculateRanking(config, []).every(x => x.avg === 0));
});
test('investment validation rejects self investment, negative, fractional, extra and excess amounts', () => {
  const config = { ...DEFAULT_CONFIG, budget: 105, unit: 10 };
  const valid = { team1: 0, team2: 20, team3: 10, team4: 0 };
  assert.ok(validInvestments(config, 'team1', valid));
  assert.ok(validInvestments(config, 'team1', { team1: 0, team2: 0, team3: 0, team4: 0 }));
  for (const invalid of [{ ...valid, team1: 10 }, { ...valid, team2: -10 }, { ...valid, team2: 0.5 },
    { ...valid, team2: 11 }, { ...valid, team2: 100 }, { ...valid, extra: 0 }]) {
    assert.equal(validInvestments(config, 'team1', invalid), false);
  }
});
test('configuration and links reject bad values without rewriting Pages relative links', () => {
  const config = structuredClone(DEFAULT_CONFIG);
  const pins = { team1: '01234567', team2: '2222', team3: '3333', team4: '4444' };
  assert.doesNotThrow(() => validateConfig(config, pins));
  for (const budget of [0, -1, 1.1, Infinity, 1e13]) assert.throws(() => validateConfig({ ...config, budget }, pins));
  for (const unit of [0, 0.1, 1e10]) assert.throws(() => validateConfig({ ...config, unit }, pins));
  assert.throws(() => validateConfig({ ...config, teamCounts: { ...config.teamCounts, team1: 100 } }, pins));
  assert.throws(() => validateConfig(config, { ...pins, team1: 'abc' }));
  assert.equal(safeUrl('landing/team1.html'), 'landing/team1.html');
  assert.equal(safeUrl('https://example.com/project?a=1&b=2'), 'https://example.com/project?a=1&b=2');
  for (const url of ['javascript:alert(1)', 'data:text/html,evil', '//evil.com', '/assets/a.png', 'http://example.com', 'java\nscript:alert(1)']) assert.equal(safeUrl(url), '');
});
test('PIN digest is stable and scoped to project/team; amount labels preserve exact value', async () => {
  const pin = await hashPin('project', 'team1', '01234567');
  assert.match(pin, /^[a-f0-9]{64}$/);
  assert.equal(await hashPin('project', 'team1', '01234567'), pin);
  assert.notEqual(await hashPin('project', 'team2', '01234567'), pin);
  assert.equal(money(123456789), '123,456,789원');
});
test('CSV preserves Korean, quotes and line breaks while neutralizing spreadsheet formulas', async () => {
  let blob;
  let clicked = false;
  const oldDocument = globalThis.document;
  const oldCreate = URL.createObjectURL;
  const oldRevoke = URL.revokeObjectURL;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { clicked = true; }, remove() {} }) };
  URL.createObjectURL = (b) => { blob = b; return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  try {
    downloadCsv('test.csv', [['사업명', '=SUM(A1)', 'a"b\nc', 100]]);
    assert.ok(clicked);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
    assert.equal(await blob.text(), '"사업명","\'=SUM(A1)","a""b\nc","100"');
  } finally {
    globalThis.document = oldDocument; URL.createObjectURL = oldCreate;
    // Keep the delayed cleanup stub alive until it has run.
    await new Promise(resolve => setTimeout(resolve, 1100));
    URL.revokeObjectURL = oldRevoke;
  }
});
