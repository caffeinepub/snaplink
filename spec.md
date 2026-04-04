# SnapLink

## Current State

- Messages and snaps are stored in **localStorage** — every device has its own isolated copy. Cross-device delivery is impossible.
- Video snaps are stored as `blob:` object URLs, which are session-local and die when the camera session ends. Receivers on any device get a dead URL.
- The backend canister (`main.mo`) already has full messaging APIs: `sendMessage`, `sendSnap` (with `blobId`), `getMessages`, `getConversations`, `markMessageRead`, `viewSnap`, `getUnreadCount`, `getConversations`.
- `backendStore.ts` already wraps all these backend messaging functions, but none are called by the UI — `ChatsTab` and `CameraTab` still call the localStorage `store.ts` functions.
- **Replica error at login**: `backendSeedDemoAccounts()` is called eagerly in `AppContext` `useEffect` and crashes when the canister is unreachable or slow to respond, causing a Replica error before the user even logs in.
- The `blob-storage` Caffeine component is available and should be used to store snap media (photos and videos) so they survive cross-device and across sessions.

## Requested Changes (Diff)

### Add
- Wire `ChatsTab` to use `backendGetMessages`, `backendSendMessage`, `backendGetConversations`, `backendMarkMessageRead`, `backendViewSnap`, `backendGetUnreadCount` from `backendStore.ts` instead of localStorage.
- Wire `CameraTab` / snap sending to: (1) upload media blob to blob-storage to get a `blobId`, (2) call `backendSendSnap` with that `blobId`.
- In `ChatsTab` snap viewer, load snap media from blob-storage URL using the `blobId` from the message.
- Add `isVideo` field support to the backend `Message` type and `sendSnap` call so the receiver knows whether to show a `<video>` or `<img>`.

### Modify
- `AppContext`: Delay / wrap `backendSeedDemoAccounts` in a `setTimeout` with try/catch so it never blocks or crashes the app at login.
- `store.ts`: Remove or deprecate messaging-related localStorage functions (`sendMessage`, `sendSnap`, `getMessages`, `getConversations`, `getUnreadCount`, `viewSnap`, `markMessagesRead`). Keep session/profile/cache functions.
- `backendStore.ts`: Add `backendSendSnapWithMedia` helper that accepts a `Blob`, uploads it to blob-storage, returns the URL, then calls `backendSendSnap` with the blob ID.
- Backend `Message` type: Add optional `isVideo` field to differentiate photo vs video snaps for the receiver.
- `main.mo`: Add `isVideo` field to `Message` type and `sendSnap` method signature.

### Remove
- localStorage-based message read/write from `ChatsTab` and `CameraTab`.
- `blob:` URL creation for video snaps — replaced with blob-storage upload.

## Implementation Plan

1. Update `main.mo`: add `isVideo : Bool` to `Message` type and `sendSnap(callerUsername, toUsername, blobId, caption, isEphemeral, saveToChat, isVideo)` signature.
2. Update `declarations/backend.did.d.ts` and `backend.did.js` to match new `Message` and `sendSnap` signature.
3. Update `backend.d.ts` interface to match.
4. Update `backendStore.ts`: add `isVideo` param to `backendSendSnap`, add `backendSendSnapWithMedia(blob, mimeType, ...)` helper using StorageClient.
5. Fix `AppContext`: wrap seed call in `setTimeout(0)` + silent catch so it never blocks login.
6. Rewrite `ChatsTab` to load conversations and messages from backend, poll every 3s, use `backendMarkMessageRead`, `backendViewSnap`. For snaps, load media via blob-storage URL from `snapBlobId`.
7. Rewrite `CameraTab` snap send flow: convert blob to ArrayBuffer, upload via `StorageClient`, get back a URL/id, then call `backendSendSnap` per recipient.
8. Update `store.ts` to remove unused localStorage message functions.
