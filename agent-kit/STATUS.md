# STATUS.md — where the project actually stands

The single source of truth for project state. Claims require evidence: a
passing gate, a linked run, a tag. Updated in the same commit as the
behavior change. The weekly cycle (WEEKLY.md step 5) refreshes it.

| Area | State | Evidence |
|---|---|---|
| Web page (`public/index.html`) | ✅ | Served at production URL, HTTP 200 |
| `GET /api/info` | ✅ | live test `info lists streams and links` green against production |
| `GET /api/download` video (MP4 merge) | ✅ | live test green; 1080p (84 MB, 5 s) and 2160p AV1 (244 MB, 11 s) downloaded from production |
| `GET /api/download` audio (M4A, Range) | ✅ | live test `M4A supports Range` green against production |
| `GET /api/download` audio (MP3) | ✅ | live test `MP3 transcode decodes fully` green against production |
| MCP server (`/mcp`) | ✅ | unit test + live test `MCP get_download_link` green |
| Agent docs (`/llms.txt`, `/openapi.json`) | ✅ | served, JSON parses in `npm run lint` |
| Coverage of arbitrary videos on Vercel | 🚧 | YouTube answers `BOT_CHECK` for most videos from Vercel IPs; 6 of 7 sampled videos failed on 2026-10-11 |
| Local CLI (`bin/ytdl.js`) | ✅ | `test/cli.test.js` green; MP4 360p (11.8 MB) and MP3 (5.1 MB) downloaded locally |
| CI | 🚧 | `.github/workflows/ci.yml` runs `SKIP_LIVE=1 npm run verify`; first run pending |

States: ✅ done (gated) · 🚧 in progress · ❌ not started · 🧊 frozen/won't do.

## Current week

- **Shipping:** between cycles
- **Last release:** v1.1.0 — 2026-10-11
- **Known red:** YouTube's bot check blocks most videos from Vercel's datacenter IPs. Workaround: the local CLI runs on the caller's IP. Plan: ROADMAP items 1 and 2.
