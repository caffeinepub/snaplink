# SnapLink — Snap Sending Speed Optimization

## Current State

Snap sending (both photo and video) currently takes 5–10 seconds. The bottleneck is in `CameraTab.tsx` `handleSendSnap` and `StorageClient.putFile`.

Key findings:
- **StorageClient**: Already a module-level singleton in `backendStore.ts` via `getStorageClient()`. No issue here.
- **Photo compression**: Applied for plain photos (max 1200px, 0.75 quality). For baked images (with filters/drawings/stickers), quality is 0.82. This is acceptable.
- **Video**: No compression or bitrate constraint at all. Raw blob uploaded at whatever the browser records (2–8 Mbps). This is the biggest bottleneck for video snaps.
- **Upload pipeline in `StorageClient.putFile`**: Steps 1–3 (hash chunks, getCertificate, uploadBlobTree) are fully sequential and silent — no progress shown during these steps. Only the parallel chunk upload phase shows progress, so the button stays on "Sending..." for several seconds before progress appears.
- **Multi-recipient sending**: `backendSendSnap` calls run in a serial `for` loop. If sending to 3+ friends, each canister call waits for the previous one.
- **Progress feedback gap**: During the sequential setup phase of the upload, the button shows nothing meaningful.

## Requested Changes (Diff)

### Add
- Video compression/bitrate cap: set `videoBitsPerSecond: 1_500_000` (1.5 Mbps) on `MediaRecorder` to reduce video file size by ~50–75% vs browser default
- Immediate progress feedback: start showing progress ("Preparing...") from the moment the user taps Send, covering the silent pre-upload phase
- Parallel `backendSendSnap` calls: replace serial for-loop with `Promise.all` when sending to multiple recipients

### Modify
- `CameraTab.tsx` `startRecording`: add `videoBitsPerSecond: 1_500_000` and `audioBitsPerSecond: 64_000` to `MediaRecorder` options
- `CameraTab.tsx` `handleSendSnap`: change serial `for` loop for `backendSendSnap` to `Promise.all`
- `CameraTab.tsx` upload progress states: show "Preparing snap..." immediately when `sending` becomes true, before upload progress ticks
- Photo compression: reduce `maxWidth` from 1200 to 900 and quality from 0.75 to 0.7 for faster uploads (still visually fine for mobile screens)
- Baked image quality: reduce from 0.82 to 0.75 in `bakeImageFull`

### Remove
- Nothing removed — no features, UI, or behavior changes

## Implementation Plan

1. In `startRecording`, add `videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 64_000` to the `MediaRecorder` constructor options object.
2. In `handleSendSnap`, replace the serial `for (const friend of recipientFriends)` loop with `await Promise.all(recipientFriends.map(friend => backendSendSnap(...)))`.
3. Update `compressImage` call: change `maxWidth` to 900 and `quality` to 0.7.
4. Update baked image `canvas.toBlob` quality from 0.82 to 0.75.
5. In the `SendToSheet` button label, show `"Preparing snap..."` as soon as `sending` is true and `uploadProgress` is null or 0 (covers the silent pre-upload phase).
6. Validate, typecheck, and build.
