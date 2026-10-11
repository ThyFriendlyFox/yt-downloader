import { getVideo } from '../lib/youtube.js';
import { downloadUrl, infoPayload, parseOptions, plan } from '../lib/service.js';
import { baseUrl, cors, preflight, readJson, sendJson } from '../lib/http.js';

// Stateless MCP server over Streamable HTTP: every POST is a complete JSON-RPC exchange.
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'yt-downloader', version: '1.0.0' };

const URL_PROP = { type: 'string', description: 'YouTube video URL (watch, youtu.be, shorts, embed, live) or 11-character video ID.' };
const TOOLS = [
  {
    name: 'get_video_info',
    description: 'Get title, author, duration, every available stream, and ready-made download URLs for one YouTube video.',
    inputSchema: { type: 'object', properties: { url: URL_PROP }, required: ['url'] },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'get_download_link',
    description:
      'Get a direct HTTP download URL for one YouTube video. Fetch the returned URL with any HTTP client (for example `curl -OJ <url>`) to receive the file. Video is MP4 with merged audio.',
    inputSchema: {
      type: 'object',
      properties: {
        url: URL_PROP,
        type: { type: 'string', enum: ['video', 'audio'], default: 'video' },
        quality: { type: 'string', description: '"best" or a maximum height: 2160, 1440, 1080, 720, 480, 360, 240, 144.', default: 'best' },
        codec: { type: 'string', enum: ['any', 'h264', 'av1', 'vp9'], default: 'any', description: 'Video codec. Use h264 for the widest player support (max 1080p).' },
        format: { type: 'string', enum: ['mp4', 'm4a', 'mp3', 'opus'], description: 'mp4 for video; m4a (default), mp3 or opus for audio.' },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

async function callTool(name, args, base) {
  if (name === 'get_video_info') {
    const { id } = parseOptions(args ?? {});
    return infoPayload(base, await getVideo(id));
  }
  if (name === 'get_download_link') {
    const opts = parseOptions(args ?? {});
    const video = await getVideo(opts.id);
    const p = plan(video, opts);
    const streams = p.mode === 'merge' ? [p.video, p.audio] : [p.format];
    return {
      download_url: downloadUrl(base, {
        url: opts.id,
        type: opts.type === 'video' ? undefined : opts.type,
        quality: opts.type === 'video' && opts.quality !== 'best' ? opts.quality : undefined,
        codec: opts.codec === 'any' ? undefined : opts.codec,
        format: opts.type === 'audio' ? opts.format : undefined,
      }),
      filename: p.filename,
      content_type: p.contentType,
      title: video.title,
      duration_seconds: video.duration,
      streams: streams.map(({ source, ...f }) => f),
      approx_size: streams.every((f) => f.size) && p.mode !== 'mp3' ? streams.reduce((n, f) => n + f.size, 0) : null,
    };
  }
  const err = new Error(`Unknown tool: ${name}`);
  err.rpc = -32602;
  throw err;
}

async function handle(msg, base) {
  const { id, method, params } = msg ?? {};
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

  if (msg?.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid Request');
  // Notifications get no response.
  if (id === undefined) return null;

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Call get_download_link, then fetch download_url over HTTP to receive the file. No API key, no captcha.',
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call':
      try {
        const result = await callTool(params?.name, params?.arguments, base);
        return reply({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: false,
        });
      } catch (err) {
        if (err.rpc) return fail(err.rpc, err.message);
        // Tool failures go back as results so the model sees the reason.
        return reply({
          content: [{ type: 'text', text: `${err.code ?? 'ERROR'}: ${err.message}` }],
          isError: true,
        });
      }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(res);
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 405, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Method not allowed. This MCP server is stateless: send JSON-RPC with POST.' },
    });
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const base = baseUrl(req);
  const out = Array.isArray(body)
    ? (await Promise.all(body.map((m) => handle(m, base)))).filter(Boolean)
    : await handle(body, base);
  if (!out || (Array.isArray(out) && !out.length)) {
    res.statusCode = 202;
    return res.end();
  }
  sendJson(res, 200, out);
}
