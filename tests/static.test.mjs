import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
test('all JavaScript parses; static HTML links and script element IDs exist', async () => {
  for (const name of ['student', 'admin', 'common', 'firebase', 'firebase-config', 'default-config']) {
    execFileSync(process.execPath, ['--check', `${root}/js/${name}.js`]);
  }
  for (const page of ['index.html', 'admin.html', 'preview.html', ...[1,2,3,4].map(n => `landing/team${n}.html`)]) {
    const html = await readFile(`${root}/${page}`, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `${page}: duplicate IDs`);
    for (const [, link] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|#|data:)/.test(link)) continue;
      assert.ok(!link.startsWith('/'), `${page}: root-relative link ${link}`);
      await access(resolve(root, dirname(page), link));
    }
    if (page === 'index.html' || page === 'admin.html') {
      const js = await readFile(`${root}/js/${page === 'index.html' ? 'student' : 'admin'}.js`, 'utf8');
      for (const [, id] of js.matchAll(/\bel\("([^"]+)"\)/g)) {
        assert.ok(ids.includes(id) || js.includes(`id="${id}"`), `${page}: missing #${id}`);
      }
    }
  }
});
