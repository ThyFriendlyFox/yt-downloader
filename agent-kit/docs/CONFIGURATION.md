# Configuration

YT Downloader reads environment variables. Set them in the Vercel dashboard
(Project → Settings → Environment Variables) or in the shell for `npm run dev`.
`vercel.json` holds the function limits.

All variables are optional. A missing or empty variable uses its default.

## Environment variables

| Field | Type | Default | Use |
|---|---|---|---|
| `YT_CLIENTS` | comma list | `IOS,VISIONOS,ANDROID_VR,TV_SIMPLY` | InnerTube clients to try, in order |
| `CHUNK_BYTES` | integer | `10485760` | Size of each range request to googlevideo |
| `FFMPEG_PATH` | path | the `ffmpeg-static` binary | ffmpeg to run |
| `PORT` | integer | `3000` | Port for `npm run dev` only |
| `LIVE_BASE_URL` | URL | none (starts a local server) | Target for `npm run test:live` |
| `LIVE_VIDEO_ID` | video ID | `dQw4w9WgXcQ` | Video for `npm run test:live` |
| `SKIP_LIVE` | `1` | unset | `npm run verify` skips the live tests and prints that it did |

## `vercel.json`

| Field | Value | Use |
|---|---|---|
| `functions["api/download.js"].maxDuration` | `300` | Seconds one download may run |
| `functions["api/download.js"].includeFiles` | `node_modules/ffmpeg-static/ffmpeg` | Ships the ffmpeg binary |
| `functions["api/info.js"].maxDuration` | `30` | Seconds for one info call |
| `functions["api/mcp.js"].maxDuration` | `60` | Seconds for one MCP call |
| `rewrites` | `/mcp` → `/api/mcp` | Short MCP URL |
