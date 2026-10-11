import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentDisposition, normalizeFormat, parseQuality, pickAudio, pickVideo, safeFilename } from '../lib/formats.js';

const v = (itag, height, codec, extra = {}) =>
  normalizeFormat({
    itag,
    mime_type: codec === 'vp9' ? 'video/webm; codecs="vp9"' : `video/mp4; codecs="${codec === 'h264' ? 'avc1.640028' : 'av01.0.08M.08'}"`,
    has_video: true,
    has_audio: false,
    height,
    width: Math.round((height * 16) / 9),
    fps: 30,
    bitrate: height * 1000,
    content_length: height * 10000,
    quality_label: `${height}p`,
    ...extra,
  });
const a = (itag, codec, bitrate, extra = {}) =>
  normalizeFormat({
    itag,
    mime_type: codec === 'opus' ? 'audio/webm; codecs="opus"' : 'audio/mp4; codecs="mp4a.40.2"',
    has_video: false,
    has_audio: true,
    bitrate,
    content_length: bitrate * 100,
    ...extra,
  });

const formats = [
  v(401, 2160, 'av1'), v(313, 2160, 'vp9'),
  v(137, 1080, 'h264'), v(399, 1080, 'av1'), v(248, 1080, 'vp9'),
  v(136, 720, 'h264'), v(160, 144, 'h264'),
  a(140, 'aac', 130000), a(139, 'aac', 50000), a(251, 'opus', 136000),
];

test('normalizes codec, kind and container', () => {
  assert.deepEqual(
    [formats[0].video_codec, formats[1].video_codec, formats[2].video_codec, formats[1].container],
    ['av1', 'vp9', 'h264', 'webm'],
  );
  assert.equal(formats[7].kind, 'audio');
  assert.equal(formats[7].audio_codec, 'aac');
  assert.equal(formats[9].audio_codec, 'opus');
});

test('best picks the tallest stream, AV1 over VP9 at equal height', () => {
  assert.equal(pickVideo(formats).itag, 401);
});

test('quality is a cap, and H.264 wins at equal height', () => {
  assert.equal(pickVideo(formats, { quality: 1080 }).itag, 137);
  assert.equal(pickVideo(formats, { quality: 1000 }).itag, 136);
  assert.equal(pickVideo(formats, { quality: 100 }).itag, 160);
});

test('codec filter limits the pool', () => {
  assert.equal(pickVideo(formats, { codec: 'h264' }).itag, 137);
  assert.equal(pickVideo(formats, { codec: 'vp9', quality: 720 }).itag, 248);
});

test('DRM and OTF streams are never picked', () => {
  const only = [v(137, 1080, 'h264', { drm_families: ['WIDEVINE'] }), v(136, 720, 'h264', { is_type_otf: true })];
  assert.equal(pickVideo(only), null);
});

test('audio prefers the codec, the original track, and the highest bitrate', () => {
  assert.equal(pickAudio(formats).itag, 140);
  assert.equal(pickAudio(formats, { codec: 'opus' }).itag, 251);
  const dubbed = [
    a(140, 'aac', 130000, { audio_track: { display_name: 'French', audio_is_default: false } }),
    a(141, 'aac', 120000, { audio_track: { display_name: 'English original', audio_is_default: true } }),
    a(142, 'aac', 140000, { is_drc: true }),
  ];
  assert.equal(pickAudio(dubbed).itag, 141);
});

test('parseQuality', () => {
  assert.equal(parseQuality(undefined), 'best');
  assert.equal(parseQuality('best'), 'best');
  assert.equal(parseQuality('720'), 720);
  assert.equal(parseQuality('720p'), 720);
  assert.equal(parseQuality('high'), null);
  assert.equal(parseQuality('-1'), null);
});

test('filenames are safe on every OS and headers are ASCII', () => {
  assert.equal(safeFilename('a/b\\c:d*e?"f<g>h|i', 'mp4'), 'a b c d e f g h i.mp4');
  assert.equal(safeFilename('...hidden', 'mp4'), 'hidden.mp4');
  assert.equal(safeFilename('', 'mp3'), 'video.mp3');
  assert.equal(safeFilename('x'.repeat(300), 'mp4').length, 154);
  const header = contentDisposition('Café "live" ☕.mp4');
  assert.match(header, /^attachment; filename="Caf_ _live_ _\.mp4"; filename\*=UTF-8''Caf%C3%A9%20%22live%22%20%E2%98%95\.mp4$/);
  assert.ok(/^[\x20-\x7e]+$/.test(header));
});
