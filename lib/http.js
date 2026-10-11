import { YouTubeError } from './youtube.js';

export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export function baseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
  return `${proto}://${host}`;
}

export function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, range, mcp-session-id, mcp-protocol-version');
  res.setHeader('access-control-expose-headers', 'content-disposition, content-length, content-range, x-video-id, x-itags');
}

export function preflight(req, res) {
  if (req.method !== 'OPTIONS') return false;
  cors(res);
  res.statusCode = 204;
  res.end();
  return true;
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body, null, 2));
}

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.code = 'BAD_REQUEST';
    this.status = 400;
  }
}

// Every error leaves as {"error": {"code", "message"}} with a matching HTTP status.
export function sendError(res, err) {
  const known = err instanceof YouTubeError || err instanceof BadRequest;
  if (!known) console.error(err);
  if (res.headersSent) {
    res.destroy(err);
    return;
  }
  for (const h of ['content-disposition', 'content-length', 'content-range', 'accept-ranges']) res.removeHeader(h);
  sendJson(res, known ? err.status : 500, {
    error: {
      code: known ? err.code : 'INTERNAL',
      message: known ? err.message : `Internal error: ${err?.message ?? err}`,
    },
  });
}

export async function readJson(req) {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new BadRequest('Request body is larger than 1 MB.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
}
