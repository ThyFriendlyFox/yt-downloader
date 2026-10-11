import { parseVideoId } from './video-id.js';
import {
  AUDIO_FORMATS,
  QUALITIES,
  VIDEO_CODECS,
  parseQuality,
  pickAudio,
  pickVideo,
  safeFilename,
} from './formats.js';
import { publicFormats } from './youtube.js';
import { BadRequest } from './http.js';

const get = (params, key) => {
  const v = typeof params.get === 'function' ? params.get(key) : params[key];
  return v === undefined || v === null || v === '' ? undefined : String(v);
};

// Validates download options. Accepts URLSearchParams or a plain object.
export function parseOptions(params) {
  const input = get(params, 'url') ?? get(params, 'id') ?? get(params, 'v');
  if (!input) throw new BadRequest('Missing "url". Pass a YouTube URL or an 11-character video ID.');
  const id = parseVideoId(input);
  if (!id) throw new BadRequest(`"${input}" is not a YouTube video URL or video ID.`);

  const type = get(params, 'type') ?? 'video';
  if (type !== 'video' && type !== 'audio') throw new BadRequest('"type" must be "video" or "audio".');

  const quality = parseQuality(get(params, 'quality'));
  if (quality === null) throw new BadRequest('"quality" must be "best" or a height such as 1080.');

  const codec = get(params, 'codec') ?? 'any';
  if (codec !== 'any' && !VIDEO_CODECS.includes(codec)) {
    throw new BadRequest(`"codec" must be one of: any, ${VIDEO_CODECS.join(', ')}.`);
  }

  const format = get(params, 'format') ?? (type === 'audio' ? 'm4a' : 'mp4');
  if (type === 'audio' && !AUDIO_FORMATS.includes(format)) {
    throw new BadRequest(`Audio "format" must be one of: ${AUDIO_FORMATS.join(', ')}.`);
  }
  if (type === 'video' && format !== 'mp4') throw new BadRequest('Video "format" must be "mp4".');

  const itagRaw = get(params, 'itag');
  const itag = itagRaw === undefined ? null : Number(itagRaw);
  if (itag !== null && !Number.isInteger(itag)) throw new BadRequest('"itag" must be an integer.');

  return { id, type, quality, codec, format, itag };
}

// Decides which streams to fetch and what to do with them.
export function plan(video, opts) {
  const formats = video.formats;
  if (opts.itag !== null) {
    const f = formats.find((x) => x.itag === opts.itag && !x.drm && !x.otf);
    if (!f) throw new BadRequest(`itag ${opts.itag} is not available for this video. See /api/info.`);
    const ext = f.kind === 'audio' ? (f.container === 'mp4' ? 'm4a' : 'webm') : f.container;
    const label = f.quality ?? `${Math.round((f.bitrate ?? 0) / 1000)}k`;
    return {
      mode: 'passthrough',
      format: f,
      contentType: `${f.kind === 'audio' ? 'audio' : 'video'}/${f.container}`,
      filename: safeFilename(`${video.title} [${label}]`, ext),
    };
  }

  if (opts.type === 'audio') {
    if (opts.format === 'opus') {
      const f = pickAudio(formats, { codec: 'opus' });
      if (!f || f.audio_codec !== 'opus') throw new BadRequest('No Opus audio stream for this video. Use format=m4a.');
      return { mode: 'passthrough', format: f, contentType: 'audio/webm', filename: safeFilename(video.title, 'webm') };
    }
    const f = pickAudio(formats, { codec: 'aac' });
    if (!f) throw new BadRequest('No audio stream for this video.');
    if (opts.format === 'mp3') {
      return { mode: 'mp3', format: f, contentType: 'audio/mpeg', filename: safeFilename(video.title, 'mp3') };
    }
    const ext = f.container === 'mp4' ? 'm4a' : 'webm';
    return { mode: 'passthrough', format: f, contentType: `audio/${f.container}`, filename: safeFilename(video.title, ext) };
  }

  const v = pickVideo(formats, { quality: opts.quality, codec: opts.codec });
  if (!v) throw new BadRequest(`No ${opts.codec === 'any' ? '' : `${opts.codec} `}video stream for this video.`);
  const a = pickAudio(formats, { codec: 'aac' });
  if (!a) throw new BadRequest('No audio stream for this video.');
  return {
    mode: 'merge',
    video: v,
    audio: a,
    contentType: 'video/mp4',
    filename: safeFilename(`${video.title} [${v.quality ?? `${v.height}p`}]`, 'mp4'),
  };
}

export function downloadUrl(base, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return `${base}/api/download?${qs}`;
}

// One ready-made link per quality that exists, plus audio links.
export function downloadLinks(base, video) {
  const aac = pickAudio(video.formats, { codec: 'aac' });
  const opus = pickAudio(video.formats, { codec: 'opus' });
  const heights = new Set(video.formats.filter((f) => f.kind === 'video' && !f.drm && !f.otf).map((f) => f.height));
  const video_links = QUALITIES.filter((q) => heights.has(q)).map((q) => {
    const v = pickVideo(video.formats, { quality: q });
    return {
      quality: `${q}p`,
      video_codec: v.video_codec,
      fps: v.fps,
      approx_size: v.size ? v.size + (aac?.size ?? 0) : null,
      url: downloadUrl(base, { url: video.id, quality: q }),
    };
  });
  const audio_links = [
    { format: 'm4a', approx_size: aac?.size ?? null, url: downloadUrl(base, { url: video.id, type: 'audio', format: 'm4a' }) },
    { format: 'mp3', approx_size: null, url: downloadUrl(base, { url: video.id, type: 'audio', format: 'mp3' }) },
  ];
  if (opus?.audio_codec === 'opus') {
    audio_links.push({ format: 'opus', approx_size: opus.size, url: downloadUrl(base, { url: video.id, type: 'audio', format: 'opus' }) });
  }
  return {
    best: downloadUrl(base, { url: video.id }),
    video: video_links,
    audio: audio_links,
  };
}

export function infoPayload(base, video) {
  return {
    id: video.id,
    title: video.title,
    author: video.author,
    channel_id: video.channel_id,
    duration_seconds: video.duration,
    views: video.views,
    thumbnail: video.thumbnail,
    webpage_url: `https://www.youtube.com/watch?v=${video.id}`,
    downloads: downloadLinks(base, video),
    formats: publicFormats(video),
  };
}
