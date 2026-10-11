export const QUALITIES = [2160, 1440, 1080, 720, 480, 360, 240, 144];
export const VIDEO_CODECS = ['h264', 'av1', 'vp9'];
export const AUDIO_FORMATS = ['m4a', 'mp3', 'opus'];

// Same height: H.264 plays everywhere, AV1 is smaller, VP9 is the fallback.
const CODEC_RANK = { h264: 0, av1: 1, vp9: 2 };

function codecOf(mime) {
  const codecs = /codecs="([^"]+)"/.exec(mime)?.[1] ?? '';
  const parts = codecs.split(',').map((c) => c.trim());
  const name = (c) => {
    if (c.startsWith('avc1')) return 'h264';
    if (c.startsWith('av01')) return 'av1';
    if (c.startsWith('vp9') || c.startsWith('vp09')) return 'vp9';
    if (c.startsWith('mp4a')) return 'aac';
    if (c.startsWith('opus')) return 'opus';
    return c;
  };
  return parts.map(name);
}

// Maps a youtubei.js format object to the public shape. `source` keeps the original.
export function normalizeFormat(f) {
  const mime = f.mime_type ?? '';
  const container = mime.includes('webm') ? 'webm' : 'mp4';
  const codecs = codecOf(mime);
  const kind = f.has_video && f.has_audio ? 'muxed' : f.has_video ? 'video' : 'audio';
  return {
    itag: f.itag,
    kind,
    container,
    video_codec: f.has_video ? codecs[0] : null,
    audio_codec: f.has_audio ? codecs[codecs.length - 1] : null,
    height: f.height ?? null,
    width: f.width ?? null,
    fps: f.fps ?? null,
    quality: f.quality_label ?? null,
    bitrate: f.bitrate ?? null,
    size: f.content_length ? Number(f.content_length) : null,
    audio_language: f.audio_track?.display_name ?? null,
    default_audio: f.audio_track ? Boolean(f.audio_track.audio_is_default) : true,
    drm: Boolean(f.drm_families?.length || f.drm_track_type),
    // Dynamic-range-compressed duplicate of an audio track.
    drc: Boolean(f.is_drc),
    // OTF streams are segment lists, not one file; range requests do not work on them.
    otf: Boolean(f.is_type_otf),
  };
}

export function parseQuality(value) {
  if (value === undefined || value === null || value === '' || value === 'best') return 'best';
  const n = Number(String(value).replace(/p$/i, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function pickVideo(formats, { quality = 'best', codec = 'any' } = {}) {
  let pool = formats.filter((f) => f.kind === 'video' && !f.drm && !f.otf);
  if (codec !== 'any') pool = pool.filter((f) => f.video_codec === codec);
  if (!pool.length) return null;
  if (quality !== 'best') {
    const fit = pool.filter((f) => f.height <= quality);
    // Nothing at or under the cap: take the smallest that exists.
    if (fit.length) pool = fit;
    else {
      const min = Math.min(...pool.map((f) => f.height));
      pool = pool.filter((f) => f.height === min);
    }
  }
  return [...pool].sort(
    (a, b) =>
      b.height - a.height ||
      (b.fps ?? 0) - (a.fps ?? 0) ||
      (CODEC_RANK[a.video_codec] ?? 9) - (CODEC_RANK[b.video_codec] ?? 9) ||
      (b.bitrate ?? 0) - (a.bitrate ?? 0),
  )[0];
}

export function pickAudio(formats, { codec = 'aac' } = {}) {
  let pool = formats.filter((f) => f.kind === 'audio' && !f.drm && !f.otf && !f.drc);
  const preferred = pool.filter((f) => f.audio_codec === codec);
  if (preferred.length) pool = preferred;
  const original = pool.filter((f) => f.default_audio);
  if (original.length) pool = original;
  return [...pool].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0] ?? null;
}

export function safeFilename(title, ext) {
  const base =
    String(title ?? 'video')
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .slice(0, 150)
      .trim() || 'video';
  return `${base}.${ext}`;
}

export function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
