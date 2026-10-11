import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions } from '../lib/service.js';

const q = (o) => new URLSearchParams(o);

test('defaults', () => {
  assert.deepEqual(parseOptions(q({ url: 'https://youtu.be/dQw4w9WgXcQ' })), {
    id: 'dQw4w9WgXcQ', type: 'video', quality: 'best', codec: 'any', format: 'mp4', itag: null,
  });
  assert.equal(parseOptions({ url: 'dQw4w9WgXcQ', type: 'audio' }).format, 'm4a');
  assert.equal(parseOptions(q({ v: 'dQw4w9WgXcQ' })).id, 'dQw4w9WgXcQ');
});

test('rejects bad input with BAD_REQUEST', () => {
  for (const params of [
    {},
    { url: 'not a video' },
    { url: 'dQw4w9WgXcQ', type: 'gif' },
    { url: 'dQw4w9WgXcQ', quality: 'ultra' },
    { url: 'dQw4w9WgXcQ', codec: 'hevc' },
    { url: 'dQw4w9WgXcQ', type: 'audio', format: 'flac' },
    { url: 'dQw4w9WgXcQ', format: 'mkv' },
    { url: 'dQw4w9WgXcQ', itag: 'x' },
  ]) {
    assert.throws(() => parseOptions(q(params)), (err) => err.code === 'BAD_REQUEST' && err.status === 400, JSON.stringify(params));
  }
});
