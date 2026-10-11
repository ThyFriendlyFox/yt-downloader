import { pipeline } from 'node:stream/promises';
import { getVideo, YouTubeError } from '../lib/youtube.js';
import { parseOptions, plan } from '../lib/service.js';
import { contentDisposition } from '../lib/formats.js';
import { mergeToMp4, probe, rangeStream, transcodeToMp3 } from '../lib/media.js';
import { cors, preflight, query, sendError } from '../lib/http.js';

async function prepare(id, opts) {
  const tried = [];
  for (;;) {
    let video;
    try {
      video = await getVideo(id, { exclude: tried });
    } catch (err) {
      if (tried.length) {
        throw new YouTubeError('UPSTREAM', `googlevideo refused the stream URLs from clients: ${tried.join(', ')}.`, 502);
      }
      throw err;
    }
    const p = plan(video, opts);
    const parts = p.mode === 'merge' ? [p.video, p.audio] : [p.format];
    // Probe before any response bytes go out, so a dead URL can still fall back.
    const urls = await Promise.all(parts.map((f) => video.resolveUrl(f).catch(() => null)));
    const ok = await Promise.all(urls.map((u, i) => u !== null && probe(u, parts[i].size)));
    if (ok.every(Boolean)) return { video, plan: p, urls };
    tried.push(video.client);
  }
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || !size) return null;
  let start = m[1] === '' ? null : Number(m[1]);
  let end = m[2] === '' ? null : Number(m[2]);
  if (start === null) {
    if (end === null) return null;
    start = Math.max(0, size - end);
    end = size - 1;
  }
  end = end === null ? size - 1 : Math.min(end, size - 1);
  if (start > end) return 'invalid';
  return { start, end };
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(res);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    const opts = parseOptions(query(req));
    const { video, plan: p, urls } = await prepare(opts.id, opts);

    res.setHeader('content-type', p.contentType);
    res.setHeader('content-disposition', contentDisposition(p.filename));
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-video-id', video.id);
    res.setHeader('x-itags', (p.mode === 'merge' ? [p.video, p.audio] : [p.format]).map((f) => f.itag).join(','));

    if (p.mode === 'passthrough') {
      const size = p.format.size;
      res.setHeader('accept-ranges', size ? 'bytes' : 'none');
      const range = parseRange(req.headers.range, size);
      if (range === 'invalid') {
        res.statusCode = 416;
        res.setHeader('content-range', `bytes */${size}`);
        res.end();
        return;
      }
      const start = range?.start ?? 0;
      const end = range?.end ?? (size ? size - 1 : null);
      if (range) {
        res.statusCode = 206;
        res.setHeader('content-range', `bytes ${start}-${end}/${size}`);
      }
      if (end !== null) res.setHeader('content-length', String(end - start + 1));
      if (req.method === 'HEAD') return res.end();
      await pipeline(rangeStream(urls[0], { size, start, end, signal: abort.signal }), res);
      return;
    }

    // Merged and transcoded output has no known length and no range support.
    res.setHeader('accept-ranges', 'none');
    if (req.method === 'HEAD') return res.end();

    const job =
      p.mode === 'merge'
        ? mergeToMp4(
            rangeStream(urls[0], { size: p.video.size, signal: abort.signal }),
            rangeStream(urls[1], { size: p.audio.size, signal: abort.signal }),
            { signal: abort.signal },
          )
        : transcodeToMp3(rangeStream(urls[0], { size: p.format.size, signal: abort.signal }), { signal: abort.signal });
    // End the response only after ffmpeg exits 0; a failed job must not look like a complete file.
    job.stdout.pipe(res, { end: false });
    await job.done;
    res.end();
  } catch (err) {
    if (abort.signal.aborted) return;
    sendError(res, err);
  }
}
