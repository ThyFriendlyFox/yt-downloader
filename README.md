# YT Downloader

Download YouTube video as MP4, or audio as M4A, MP3 or Opus.
No captcha, no API key, no sign-up. Built for people and AI agents.

Live: https://yt-downloader-five-blush.vercel.app

## Use

| Who | How |
|---|---|
| Person | Open the page, paste a URL, click a quality. |
| Agent with a shell (own IP) | `npx -y github:ThyFriendlyFox/yt-downloader "https://youtu.be/dQw4w9WgXcQ" --quality 1080` |
| Script or agent | `curl -OJ "https://yt-downloader-five-blush.vercel.app/api/download?url=https://youtu.be/dQw4w9WgXcQ"` |
| MCP client | `claude mcp add --transport http yt-downloader https://yt-downloader-five-blush.vercel.app/mcp` |

The full API is in [`public/llms.txt`](public/llms.txt) and [`public/openapi.json`](public/openapi.json).

## How it works

1. `youtubei.js` asks YouTube's InnerTube API for the video and its streams.
2. The function picks the best video stream under the quality cap and the best audio stream.
3. It fetches both in 10 MB range requests from the same function, because stream URLs are bound to the requesting IP.
4. ffmpeg merges them into MP4 with a stream copy and streams the result to the client.

Details: [`agent-kit/docs/ARCHITECTURE.md`](agent-kit/docs/ARCHITECTURE.md).

## Limits

- YouTube runs a bot check on datacenter IPs, including Vercel's. Many videos return `503 BOT_CHECK` on the hosted copy. The `npx` command runs the downloader on your machine, so YouTube sees your IP instead.
- One download runs for at most 300 seconds.
- Live streams and DRM-protected videos are not supported.
- Downloading from YouTube is against YouTube's Terms of Service. Copyright law applies to the content. Use it for content you have the right to download.

## Develop

```sh
npm ci
npm run dev                 # http://localhost:3000
npm run verify              # lint, build, unit tests, live tests
SKIP_LIVE=1 npm run verify  # without contacting YouTube
```

Requires Node.js 20 or later. Work in this repo follows [`agent-kit/ROUTING.md`](agent-kit/ROUTING.md).

## License

MIT for this code. The bundled ffmpeg binary (`ffmpeg-static`) is GPL-3.0.
