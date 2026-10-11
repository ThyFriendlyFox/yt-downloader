# AGENTS.md — the binding contract

In effect whenever code in this repo is touched, by agent or human.
When this conflicts with intuition, this wins.

## Commands

```sh
npm run build      # build
npm test       # tests
npm run lint       # lint / format check
npm run verify     # full health gate — must pass before any push
```

Requires Node.js 20 or later (ffmpeg comes from the ffmpeg-static package).
`SKIP_LIVE=1 npm run verify` skips the YouTube tests and says so.
`npm run dev` serves the app on http://localhost:3000.

## Invariants — never regress these

1. **No captcha, no API key, no sign-up.** Every endpoint answers a plain
   anonymous HTTP request. This is the product.
2. **Stream URLs are IP-bound.** googlevideo URLs work only from the IP that
   requested them. Fetch video data and stream bytes in the same function
   invocation (`api/download.js` calls `getVideo` itself). Never cache stream
   URLs across requests or hand them to the client.
3. **Probe the last byte before sending headers.** Some clients' URLs serve
   the first ~1 MB and then return 403. `probe()` checks byte `size-1`, so a
   bad client can still fall back before the response starts.
4. **Video output is a stream copy.** ffmpeg merges with `-c copy` into
   fragmented MP4. No re-encode for video; MP3 is the only transcode.
5. **A failed job never looks like a complete file.** Merged responses end
   only after ffmpeg exits 0; otherwise the connection is destroyed.
6. **Errors are JSON** `{"error":{"code","message"}}` with a matching HTTP
   status, and the codes are a public contract (`public/llms.txt`,
   `public/openapi.json`). Add codes; do not rename them.
7. **Agent docs move with the API.** A parameter or error code change updates
   `public/llms.txt`, `public/openapi.json`, the MCP tool schema in
   `api/mcp.js`, and the table in `public/index.html` in the same commit.
8. **No bot-detection evasion.** Do not add BotGuard/PO-token minting,
   attestation spoofing, or proxy rotation to get past YouTube's bot check.
   This stays out of scope unless the human decides otherwise.

## Landmine map

<!-- Places where the obvious change is the wrong change. -->

| Area | Why it bites |
|---|---|
| `lib/youtube.js` `CLIENTS` | Which InnerTube clients work changes often. A client can return OK data and still serve dead URLs. Test the last byte, not the first. |
| `lib/youtube.js` eval shim | youtubei.js appends `return process(...)` to the script. It must run inside a function body, or V8 throws "Illegal return statement". |
| `lib/media.js` `CHUNK` | One long request to googlevideo gets throttled. Keep ranged chunks. |
| `vercel.json` `includeFiles` | The ffmpeg binary is not traced automatically. Removing the include breaks every merge in production only. |
| `package.json` `build` | Vercel runs `npm run build` on deploy. It must not need YouTube access. |
| `res.on('close')` | Fires on client disconnect. It aborts fetches and kills ffmpeg. Do not move cleanup to `req`. |

## House style

- Match the surrounding code's idiom, naming, and comment density.
- No demo scaffolding, no leftover diagnostics, no dead flags.
- Comments state constraints the code can't show — never narration.
- User-facing copy states the thing plainly; no reassurance microcopy.

## Process rules

- Branch from `main`; never commit to it directly.
- `npm run verify` green before every push. Flaky gate → fix or
  quarantine in the same PR; never route around it.
- After adding/removing/renaming source files, run the stack's
  regeneration step (project gen, lockfile, tidy) and commit the result.
- Commit at boundaries; message says what changed and cites evidence.
- Docs move with behavior — same commit or PR.
- Report outcomes faithfully; failing is failing, with output.
