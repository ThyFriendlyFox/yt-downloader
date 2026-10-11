#!/usr/bin/env node
// Runs the downloader on this machine, so every YouTube request leaves from
// this machine's IP instead of a server's.
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import { parseOptions, prepare } from '../lib/service.js';
import { getVideo, publicFormats } from '../lib/youtube.js';
import { mergeToMp4, rangeStream, transcodeToMp3 } from '../lib/media.js';

const HELP = `Usage: ytdl <youtube-url-or-id> [options]

Options:
  --type <video|audio>        default: video
  --quality <best|2160|…|144> maximum height; default: best
  --codec <any|h264|av1|vp9>  default: any
  --format <mp4|m4a|mp3|opus> mp4 for video; m4a (default), mp3 or opus for audio
  --itag <n>                  one raw stream from --info
  --out <dir>                 output folder; default: current folder
  --info                      print video data and streams as JSON; download nothing
  --quiet                     no progress on stderr

The last stdout line is JSON: {"file", "bytes", "title", "id", "itags"}.
Errors go to stderr as JSON {"error": {"code", "message"}} and exit with 1.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    type: { type: 'string' },
    quality: { type: 'string' },
    codec: { type: 'string' },
    format: { type: 'string' },
    itag: { type: 'string' },
    out: { type: 'string', default: '.' },
    info: { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function progress(stream, label) {
  if (values.quiet || !process.stderr.isTTY) return stream;
  let bytes = 0;
  let last = 0;
  stream.on('data', (chunk) => {
    bytes += chunk.length;
    const now = Date.now();
    if (now - last > 250) {
      last = now;
      process.stderr.write(`\r${label} ${(bytes / 1048576).toFixed(1)} MB`);
    }
  });
  stream.on('end', () => process.stderr.write(`\r${label} ${(bytes / 1048576).toFixed(1)} MB\n`));
  return stream;
}

async function main() {
  if (values.help || positionals.length !== 1) {
    console.log(HELP);
    process.exitCode = values.help ? 0 : 1;
    return;
  }
  const opts = parseOptions({ url: positionals[0], ...values });

  if (values.info) {
    const video = await getVideo(opts.id);
    const { id, title, author, channel_id, duration, views, thumbnail } = video;
    console.log(JSON.stringify({ id, title, author, channel_id, duration_seconds: duration, views, thumbnail, formats: publicFormats(video) }, null, 2));
    return;
  }

  const { video, plan: p, urls } = await prepare(opts.id, opts);
  const file = resolve(join(values.out, p.filename));
  const partial = `${file}.part`;
  const out = createWriteStream(partial);
  try {
    if (p.mode === 'passthrough') {
      await pipeline(progress(rangeStream(urls[0], { size: p.format.size }), 'download'), out);
    } else {
      const job =
        p.mode === 'merge'
          ? mergeToMp4(
              progress(rangeStream(urls[0], { size: p.video.size }), 'video'),
              rangeStream(urls[1], { size: p.audio.size }),
            )
          : transcodeToMp3(progress(rangeStream(urls[0], { size: p.format.size }), 'audio'));
      await Promise.all([pipeline(job.stdout, out), job.done]);
    }
    await rename(partial, file);
  } catch (err) {
    await rm(partial, { force: true });
    throw err;
  }
  const bytes = out.bytesWritten;
  const itags = (p.mode === 'merge' ? [p.video, p.audio] : [p.format]).map((f) => f.itag);
  console.log(JSON.stringify({ file, bytes, title: video.title, id: video.id, itags }));
}

main().catch((err) => {
  const code = err.code && typeof err.code === 'string' ? err.code : 'INTERNAL';
  process.stderr.write(`${JSON.stringify({ error: { code, message: err.message } })}\n`);
  process.exitCode = 1;
});
