import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/ytdl.js', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

test('--help prints usage and exits 0', () => {
  const r = run('--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^Usage: ytdl/);
});

test('no URL prints usage and exits 1', () => {
  assert.equal(run().status, 1);
});

test('bad input is a JSON error on stderr with exit 1 (no network)', () => {
  const r = run('nope');
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.equal(JSON.parse(r.stderr).error.code, 'BAD_REQUEST');
});
