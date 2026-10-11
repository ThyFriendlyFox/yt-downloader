import vm from 'node:vm';
import { Innertube, Platform, UniversalCache } from 'youtubei.js';
import { normalizeFormat } from './formats.js';

// Tried in order until one returns streams that download in full.
// ANDROID_VR URLs stop after ~1 MB without a PO token, so it is a late fallback.
const CLIENTS = (process.env.YT_CLIENTS ?? 'IOS,VISIONOS,ANDROID_VR,TV_SIMPLY')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// youtubei.js extracts the decipher functions from YouTube's player script;
// this runs them in an empty V8 context with a time limit.
Platform.shim.eval = (data, env) => {
  const args = [env.n, env.sp, env.sig].map((v) => JSON.stringify(v ?? ''));
  const code = `(function () {\n${data.output}\nreturn process(${args.join(', ')});\n})()`;
  return vm.runInNewContext(code, {}, { timeout: 5000 });
};

export class YouTubeError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let clientPromise;
function innertube() {
  clientPromise ??= Innertube.create({
    generate_session_locally: true,
    retrieve_player: true,
    cache: new UniversalCache(false),
  }).catch((err) => {
    clientPromise = undefined;
    throw err;
  });
  return clientPromise;
}

function playabilityError(ps) {
  const reason = ps?.reason ?? ps?.status ?? 'Unknown reason';
  switch (ps?.status) {
    case 'LOGIN_REQUIRED':
      return new YouTubeError('LOGIN_REQUIRED', `YouTube requires sign-in: ${reason}`, 403);
    case 'ERROR':
      return new YouTubeError('UNAVAILABLE', `Video unavailable: ${reason}`, 404);
    case 'LIVE_STREAM_OFFLINE':
      return new YouTubeError('LIVE', `Live stream is not available: ${reason}`, 422);
    default:
      return new YouTubeError('UNPLAYABLE', `Video is not playable: ${reason}`, 422);
  }
}

// Fetches video data and stream URLs. Stream URLs are bound to the IP that
// requested them, so callers must fetch the streams from this same process.
// `exclude` skips clients whose URLs already failed.
export async function getVideo(id, { exclude = [] } = {}) {
  const yt = await innertube();
  let lastError;
  for (const client of CLIENTS.filter((c) => !exclude.includes(c))) {
    try {
      const info = await yt.getBasicInfo(id, { client });
      const ps = info.playability_status;
      if (ps?.status !== 'OK') {
        lastError = playabilityError(ps);
        // A deleted or private video fails the same way on every client.
        if (lastError.code === 'UNAVAILABLE') break;
        continue;
      }
      const sd = info.streaming_data;
      const basic = info.basic_info;
      if (basic.is_live) {
        throw new YouTubeError('LIVE', 'Live streams are not supported. Try again after the stream ends.', 422);
      }
      const raw = [...(sd?.formats ?? []), ...(sd?.adaptive_formats ?? [])];
      if (!raw.length) {
        lastError = new YouTubeError('NO_FORMATS', 'YouTube returned no streams for this video.', 422);
        continue;
      }
      const formats = raw.map((f) => ({ ...normalizeFormat(f), source: f }));
      if (formats.every((f) => f.drm)) {
        throw new YouTubeError('DRM', 'This video is DRM-protected and cannot be downloaded.', 422);
      }
      return {
        client,
        id,
        title: basic.title ?? id,
        author: basic.author ?? null,
        channel_id: basic.channel_id ?? null,
        duration: basic.duration ?? null,
        views: basic.view_count ?? null,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        formats,
        resolveUrl: (f) => f.source.decipher(yt.session.player),
      };
    } catch (err) {
      if (err instanceof YouTubeError && ['LIVE', 'DRM'].includes(err.code)) throw err;
      lastError = err;
    }
  }
  if (lastError instanceof YouTubeError) throw lastError;
  throw new YouTubeError('UPSTREAM', `YouTube request failed: ${lastError?.message ?? 'no client succeeded'}`, 502);
}

export function publicFormats(video) {
  return video.formats
    .filter((f) => !f.drm && !f.otf)
    .map(({ source, drm, otf, ...rest }) => rest);
}
