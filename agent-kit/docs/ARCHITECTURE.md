# Architecture

YT Downloader is a set of Vercel Node.js functions plus one static page. The code has 5 parts.

| Part | Folder | Task |
|---|---|---|
| Page and agent docs | `public/` | The web page, `llms.txt`, `openapi.json`, `robots.txt` |
| Functions | `api/` | One file per endpoint: `info.js`, `download.js`, `mcp.js` |
| Library | `lib/` | YouTube access, format choice, streaming, ffmpeg, HTTP helpers |
| Local server | `dev/server.js` | Serves `public/` and `api/` the way Vercel does, for dev and tests |
| Gates | `verify/`, `test/` | Lint, build, unit tests, live tests |

## Data flow

`GET /api/download?url=…&quality=1080`:

1. `api/download.js` validates the query with `parseOptions` (`lib/service.js`).
2. `getVideo` (`lib/youtube.js`) asks InnerTube for the video, trying each client in `YT_CLIENTS` order.
3. `plan` (`lib/service.js`) picks the video stream (`pickVideo`) and the audio stream (`pickAudio`).
4. `probe` (`lib/media.js`) fetches the last byte of each stream. A failure falls back to the next client.
5. The function sends headers: `content-type`, `content-disposition`, `x-itags`.
6. `rangeStream` fetches each stream in 10 MB ranges; `mergeToMp4` pipes both into ffmpeg.
7. ffmpeg writes fragmented MP4 to stdout, which streams to the client. The response ends when ffmpeg exits 0.

## Library

| File | Task |
|---|---|
| `lib/video-id.js` | URL or ID in, 11-character video ID out |
| `lib/formats.js` | Normalize youtubei.js formats; pick video and audio; safe filenames |
| `lib/youtube.js` | InnerTube session, client fallback, error mapping, decipher shim |
| `lib/media.js` | Ranged fetches, last-byte probe, ffmpeg merge and MP3 transcode |
| `lib/service.js` | Option parsing, download plan, link building, info payload |
| `lib/http.js` | CORS, JSON responses, error responses, body reading |

## Boundaries

| Boundary | Rule |
|---|---|
| function ↔ googlevideo | Stream URLs stay inside one invocation. They never reach the client. |
| function ↔ client | Errors are JSON before the first byte; after it, the connection is destroyed. |
| `api/` ↔ `lib/` | `api/` files only parse HTTP and call `lib/`. Logic lives in `lib/`. |
| MCP ↔ HTTP API | MCP tools return HTTP download URLs. MCP never carries file bytes. |
