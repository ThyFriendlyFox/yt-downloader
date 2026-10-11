import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../dev/server.js';

async function withServer(fn) {
  const server = createServer().listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}
const rpc = (base, body) =>
  fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('MCP handshake, tool list, and errors (no network)', () =>
  withServer(async (base) => {
    const init = await (await rpc(base, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })).json();
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.ok(init.result.capabilities.tools);

    const note = await rpc(base, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(note.status, 202);

    const list = await (await rpc(base, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
    assert.deepEqual(list.result.tools.map((t) => t.name), ['get_video_info', 'get_download_link']);

    const bad = await (await rpc(base, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_video_info', arguments: { url: 'nope' } } })).json();
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /^BAD_REQUEST/);

    const unknown = await (await rpc(base, { jsonrpc: '2.0', id: 4, method: 'nope' })).json();
    assert.equal(unknown.error.code, -32601);

    const get = await fetch(`${base}/mcp`);
    assert.equal(get.status, 405);
  }));

test('HTTP errors are JSON with a code', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/download?url=nope`);
    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal(res.headers.get('content-disposition'), null);
    assert.equal((await res.json()).error.code, 'BAD_REQUEST');
  }));
