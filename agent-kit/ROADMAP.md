# ROADMAP.md — the source of all work

**This file is not optional.** Every feature the agent builds flows down
from here. If it isn't on this roadmap, it doesn't get built; if it needs
building, it gets added here first. One item ships per weekly cycle
(see `WEEKLY.md`).

## North star

YT Downloader is a YouTube downloader that a person or an AI agent uses
with one HTTP request: no captcha, no API key, no sign-up. It returns a
correct file or a precise JSON error, and it says plainly when YouTube
blocks it.

## Feature Queue — ordered; top unblocked item ships next

<!-- provisional: true — the human has not ranked this queue yet. -->

### 1. Bot-check visibility
- **Promise:** `GET /api/health` returns the pass/fail result of one live `/api/info` call and the share of `BOT_CHECK` errors in the last 100 requests on this instance.
- **Evidence:** a live test in `test/live/` that asserts the response shape against production.
- **Use case:** Check before a batch.
- **Scope guard:** No persistence across instances. No alerting. No bypass of the bot check.
- **Status:** ready

### 2. Self-host guide for a residential IP
- **Promise:** `docs/SELF-HOST.md` lists the exact commands to run the app with `npm run dev` or Docker on a home machine, and the steps pass on a clean Linux machine.
- **Evidence:** the commands run in CI in a container; `npm run test:live` passes against it.
- **Use case:** Run at home.
- **Scope guard:** No proxy rotation. No sign-in. No tunnel provider setup.
- **Status:** ready

### 3. Subtitles download
- **Promise:** `GET /api/download?url=<id>&type=subtitles&lang=en` returns a valid WebVTT file when the video has English captions, and `404 NO_SUBTITLES` when it does not.
- **Evidence:** a unit test for the VTT conversion and a live test on a captioned video.
- **Use case:** Get a transcript.
- **Scope guard:** No translation. No burned-in subtitles.
- **Status:** ready

### 4. Clip by time range
- **Promise:** `GET /api/download?url=<id>&start=30&end=60` returns an MP4 whose duration is 30 ± 1 seconds.
- **Evidence:** a live test that checks duration with ffmpeg.
- **Use case:** Cut a clip.
- **Scope guard:** Keyframe-accurate cut only (stream copy). No re-encode.
- **Status:** ready

## Later — candidates, not yet specced

- Playlist info — list video IDs and titles of a playlist, so an agent can loop over `/api/download`.
- Chapters in `/api/info` — agents ask for "the part about X".
- Thumbnail download at max resolution.

## Shipped

| Week | Feature | Release | Evidence |
|---|---|---|---|
| 2026-10-11 | Downloader page, HTTP API, MCP server, Vercel deploy | v1.0.0 | `npm run verify` green; live suite green against production |

## Explicitly not doing

- BotGuard/PO-token minting or attestation spoofing to get past YouTube's bot check — it is bot-detection evasion; out of scope unless the human decides otherwise.
- Rotating proxies to hide the server IP — same reason.
- DRM (Widevine) content — cannot be decrypted and must not be.
- Live streams — a single request cannot finish within the 300-second limit.

## Queue changes

- 2026-10-11 — Seeded the queue at setup. Marked provisional.
