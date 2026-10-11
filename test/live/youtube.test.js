// Talks to YouTube. Run with `npm run test:live`; `SKIP_LIVE=1 npm run verify` skips it loudly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../dev/server.js';
import { ffmpegPath } from '../../lib/media.js';

const ID = process.env.LIVE_VIDEO_ID ?? 'dQw4w9WgXcQ';
const base = process.env.LIVE_BASE_URL;

async function withBase(fn) {
  if (base) return fn(base.replace(/\/$/, ''));
  const server = createServer().listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

function probe(buf, ext) {
  const file = join(mkdtempSync(join(tmpdir(), 'ytdl-')), `out.${ext}`);
  writeFileSync(file, buf);
  // ffmpeg decodes the whole file; any truncation or corruption fails here.
  const r = spawnSync(ffmpegPath(), ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const info = spawnSync(ffmpegPath(), ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  return info;
}

test('info lists streams and links', { timeout: 60_000 }, () =>
  withBase(async (b) => {
    const res = await fetch(`${b}/api/info?url=${ID}`);
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.id, ID);
    assert.ok(body.title);
    assert.ok(body.downloads.video.length > 0);
    assert.ok(body.formats.some((f) => f.kind === 'audio'));
  }));

test('360p MP4 has H.264 video and AAC audio and decodes fully', { timeout: 200_000 }, () =>
  withBase(async (b) => {
    const res = await fetch(`${b}/api/download?url=${ID}&quality=360&codec=h264`);
    assert.equal(res.status, 200, await res.clone().text().catch(() => ''));
    assert.match(res.headers.get('content-disposition'), /\.mp4"/);
    const info = probe(Buffer.from(await res.arrayBuffer()), 'mp4');
    assert.match(info, /Video: h264/);
    assert.match(info, /Audio: aac/);
  }));

test('M4A supports Range and matches the full length', { timeout: 120_000 }, () =>
  withBase(async (b) => {
    const url = `${b}/api/download?url=${ID}&type=audio`;
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    const size = Number(head.headers.get('content-length'));
    assert.ok(size > 0);
    const part = await fetch(url, { headers: { range: 'bytes=100-199' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes 100-199/${size}`);
    assert.equal((await part.arrayBuffer()).byteLength, 100);
    const full = await fetch(url);
    const buf = Buffer.from(await full.arrayBuffer());
    assert.equal(buf.length, size);
    assert.match(probe(buf, 'm4a'), /Audio: aac/);
  }));

test('MP3 transcode decodes fully', { timeout: 200_000 }, () =>
  withBase(async (b) => {
    const res = await fetch(`${b}/api/download?url=${ID}&type=audio&format=mp3`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.match(probe(Buffer.from(await res.arrayBuffer()), 'mp3'), /Audio: mp3/);
  }));

test('MCP get_download_link returns a working URL', { timeout: 60_000 }, () =>
  withBase(async (b) => {
    const res = await fetch(`${b}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_download_link', arguments: { url: ID, type: 'audio' } } }),
    });
    const body = await res.json();
    assert.equal(body.result.isError, false, JSON.stringify(body));
    const link = body.result.structuredContent.download_url;
    assert.ok(link.startsWith(b));
    const head = await fetch(link, { method: 'HEAD' });
    assert.equal(head.status, 200);
  }));
