# Clients

A client is an InnerTube identity (app name and version) that YouTube
answers. Each client returns different streams and fails in different
ways. YT Downloader has 4 default clients. Select them with `YT_CLIENTS`.
The first client whose streams pass the last-byte probe wins.

## IOS

The YouTube iOS app. Returns plain stream URLs with no signature work.
URLs download in full. The default first choice.

```sh
YT_CLIENTS=IOS
```

## VISIONOS

The YouTube visionOS app. Same URL shape as IOS. Used when IOS fails.

```sh
YT_CLIENTS=VISIONOS
```

## ANDROID_VR

The YouTube VR app. Returns the most formats, but URLs stop after about
1 MB without a PO token. A late fallback; the probe rejects it when cut off.

```sh
YT_CLIENTS=ANDROID_VR
```

## TV_SIMPLY

A TV client. Needs the player script to decipher URLs. The last fallback.

```sh
YT_CLIENTS=TV_SIMPLY
```

## Adding a client

1. Add its youtubei.js client name to the default list in `lib/youtube.js`.
2. Run `npm run test:live`; the probe proves URLs download in full.
3. Add its section here and update the default in `docs/CONFIGURATION.md`.
