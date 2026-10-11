# Changelog

All notable changes to YT Downloader are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-11
### Added
- Web page: paste a YouTube URL, get one download link per quality and per audio format.
- `GET /api/download`: MP4 video with merged audio (2160p to 144p), M4A, MP3 and Opus audio, raw streams by itag with `Range` support.
- `GET /api/info`: video data, every stream, and ready-made download URLs.
- `POST /mcp`: MCP server with `get_video_info` and `get_download_link`.
- `/llms.txt` and `/openapi.json` for AI agents.
- `BOT_CHECK` error (HTTP 503) when YouTube blocks the server IP.
