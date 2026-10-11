import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoId } from '../lib/video-id.js';

test('parses every supported URL shape', () => {
  const id = 'dQw4w9WgXcQ';
  for (const input of [
    id,
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
    `youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `  ${id}  `,
  ]) {
    assert.equal(parseVideoId(input), id, input);
  }
});

test('rejects inputs that name no video', () => {
  for (const input of [
    '',
    'hello',
    'dQw4w9WgXc',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/',
    'https://www.youtube.com/@channel',
    'https://youtu.be/',
    'https://evil.com/youtu.be/dQw4w9WgXcQ',
    null,
    42,
  ]) {
    assert.equal(parseVideoId(input), null, String(input));
  }
});
