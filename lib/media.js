import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// googlevideo throttles one long request; fixed-size ranges keep full speed.
const CHUNK = Number(process.env.CHUNK_BYTES ?? 10 * 1024 * 1024);
const RETRIES = 3;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  origin: 'https://www.youtube.com',
  referer: 'https://www.youtube.com/',
};

export function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  return require('ffmpeg-static');
}

async function fetchRange(url, start, end, signal) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...HEADERS, range: `bytes=${start}-${end}` }, signal });
      if (res.status === 206 || res.status === 200) return res;
      await res.body?.cancel();
      lastError = new Error(`googlevideo returned HTTP ${res.status}`);
      lastError.status = res.status;
      // 403 means the URL is dead for this IP; retrying the same URL does not help.
      if (res.status === 403 || res.status === 404) break;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

// True when a stream URL serves its last byte to this IP. The first ~1 MB can
// succeed on URLs that YouTube then cuts off, so probing byte 0 proves nothing.
export async function probe(url, size) {
  const at = size ? size - 1 : 0;
  try {
    const res = await fetchRange(url, at, at);
    await res.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

// Streams bytes [start, end] of a googlevideo URL as a sequence of range requests.
// `size` is the total length when known; without it, reading stops at the first short chunk.
export function rangeStream(url, { size = null, start = 0, end = null, signal } = {}) {
  const last = end ?? (size ? size - 1 : null);
  async function* chunks() {
    let pos = start;
    while (last === null || pos <= last) {
      const from = pos;
      const to = last === null ? from + CHUNK - 1 : Math.min(from + CHUNK - 1, last);
      const res = await fetchRange(url, from, to, signal);
      let received = 0;
      for await (const part of res.body) {
        received += part.length;
        yield part;
      }
      if (received === 0) return;
      pos += received;
      if (last === null && received < to - from + 1) return;
    }
  }
  return Readable.from(chunks(), { objectMode: false });
}

// Runs ffmpeg with readable streams wired to pipe:3, pipe:4, … and returns its stdout.
export function runFfmpeg(args, inputs, { signal } = {}) {
  const stdio = ['ignore', 'pipe', 'pipe', ...inputs.map(() => 'pipe')];
  const proc = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { stdio });
  let stderr = '';
  proc.stderr.on('data', (d) => {
    if (stderr.length < 4000) stderr += d;
  });
  inputs.forEach((input, i) => {
    const pipe = proc.stdio[3 + i];
    // ffmpeg may close an input early (e.g. after the last packet it needs).
    pipe.on('error', () => {});
    input.on('error', (err) => {
      proc.emit('input-error', err);
      proc.kill('SIGKILL');
    });
    input.pipe(pipe);
  });
  const kill = () => {
    proc.kill('SIGKILL');
    inputs.forEach((s) => s.destroy());
  };
  signal?.addEventListener('abort', kill, { once: true });
  const done = new Promise((resolve, reject) => {
    let inputError;
    proc.on('input-error', (err) => (inputError = err));
    proc.on('close', (code) => {
      signal?.removeEventListener('abort', kill);
      if (code === 0) resolve();
      else reject(inputError ?? new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`));
    });
    proc.on('error', reject);
  });
  return { stdout: proc.stdout, done, kill };
}

// Video + audio -> one fragmented MP4. Stream copy only: no re-encode.
export function mergeToMp4(videoStream, audioStream, opts) {
  return runFfmpeg(
    [
      '-i', 'pipe:3',
      '-i', 'pipe:4',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c', 'copy',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ],
    [videoStream, audioStream],
    opts,
  );
}

export function transcodeToMp3(audioStream, opts) {
  return runFfmpeg(
    ['-i', 'pipe:3', '-vn', '-c:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', 'pipe:1'],
    [audioStream],
    opts,
  );
}
