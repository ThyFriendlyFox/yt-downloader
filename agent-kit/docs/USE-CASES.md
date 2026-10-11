# Use cases

Each case has the same shape.
**Ask** is the request a person or agent sends. **Get** is what comes back.

## Save a video

**Ask.** Paste a YouTube URL on the page. Click a quality.
**Get.** An MP4 file with video and audio, named after the video.

## Save the audio

**Ask.** Click M4A or MP3 on the page, or call `/api/download?url=…&type=audio&format=mp3`.
**Get.** An audio file. M4A is the original stream; MP3 is transcoded.

## Download from an agent

**Ask.** An agent runs `curl -OJ "<host>/api/download?url=<url>"`.
**Get.** The file in the working directory. No key, no captcha.

## Choose a quality from an agent

**Ask.** An agent calls `/api/info?url=<url>` and reads `downloads.video`.
**Get.** One URL per quality with codec and size. The agent fetches one.

## Use as an MCP tool

**Ask.** Add `<host>/mcp` as an HTTP MCP server. Call `get_download_link`.
**Get.** A download URL, filename and size to fetch.

## Check before a batch

**Ask.** Call one cheap endpoint before a long run of downloads.
**Get.** Whether YouTube blocks the server right now.

## Run at home

**Ask.** Run the app on a home machine with `npm run dev`.
**Get.** The same API, on an IP that YouTube's bot check flags less.

## Get a transcript

**Ask.** Request subtitles for a video in one language.
**Get.** A WebVTT file.

## Cut a clip

**Ask.** Request a start and end time.
**Get.** An MP4 of that part only.
