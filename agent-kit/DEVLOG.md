# DEVLOG.md — the live devlog

The plain history of this project. A person who knows nothing about the
code reads this file and knows what happened, in order, with no jargon.
Append only. Never rewrite an old entry — a wrong entry gets a
correction entry, not an edit.

Write every entry in the voice of `TONE.md`.

## Entry shape

Every entry has the same shape:

```
## YYYY-MM-DD — <one line: what happened>

<What we did. What worked. What broke. What we learned.
3–10 short sentences. Plain words. Past tense for what happened,
present tense for how things now stand.>

Evidence: <commit / tag / gate run / screenshot>
```

## When to write

- Every WEEKLY.md cycle writes one entry at step 5 (before merge).
- A failed or abandoned attempt gets an entry too. The devlog records
  what happened, not what succeeded. A week with no shipped feature
  still gets its entry.
- Out-of-band work (security patch, gate repair, big triage) gets one.
- SETUP.md writes the first entry: "Installed the agent kit."

## What does not go here

- Code detail that belongs in commit messages.
- Promises about the future — that is ROADMAP.md.
- State claims — that is STATUS.md. The devlog is the story; STATUS is
  the snapshot.

---

<!-- Entries below, newest first. -->

## 2026-10-11 — Built the downloader and installed the agent kit

I built YT Downloader: a page, an HTTP API and an MCP server on Vercel.
It downloads YouTube video as MP4 and audio as M4A, MP3 or Opus.
ffmpeg merges video and audio with a stream copy, so 4K takes seconds.
The ANDROID_VR client broke first: its URLs stop after about 1 MB.
I now probe the last byte of each stream before the response starts.
Production downloaded a 244 MB 4K file in 11 seconds.
Then YouTube's bot check blocked 6 of 7 sampled videos from Vercel's IPs.
I tested a PO-token route past the check and stopped: it evades bot detection.
The queue now holds bot-check visibility, a self-host guide, subtitles and clips.

Evidence: `npm run verify` green; `LIVE_BASE_URL=<prod> npm run test:live` 5/5 green.
