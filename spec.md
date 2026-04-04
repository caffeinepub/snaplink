# SnapLink

## Current State

SnapLink is a mobile-first social snap/chat app with:
- Username/Password and Internet Identity login
- Chats tab: conversation list + individual chat view with text and snap bubbles, auto-polling every 3s
- Requests tab: pending friend requests with accept/decline, Find People search
- Camera tab: live viewfinder, gallery upload, ephemeral toggle, inline friend picker, send snap flow
- Profile tab: view/edit display name and bio, friends list, sign out, branding footer
- `UserAvatar` component renders initials-based colored circle (no real photo)
- `User` type has `id, username, displayName, bio, createdAt, passwordHash, useII` — NO `avatarUrl` field
- `store.ts` persists all data in localStorage
- No blob-storage component currently active

## Requested Changes (Diff)

### Add
1. **Profile picture (avatarUrl) field on `User` type** — optional string (`avatarUrl?: string`)
2. **Avatar upload on Profile tab** — tapping the circular avatar opens a file picker; selected image is stored as base64 dataUrl on the user object (since blob-storage is in-memory for local dev, use base64 for simplicity)
3. **Updated `UserAvatar` component** — accepts optional `avatarUrl` prop; if present renders `<img>` inside the circle, else falls back to initials gradient
4. **Avatar shown everywhere** — pass `avatarUrl` to `UserAvatar` in: ChatsTab (conversation list + chat header), RequestsTab (request cards + find-people results), CameraTab (friend picker chips), ProfileTab
5. **Bio max 150 chars** — add `maxLength={150}` and character counter to bio textarea in Profile edit mode
6. **Send Snaps to multiple friends from Camera preview** — this already exists; confirm it routes snaps into individual chat threads per friend (already implemented via `sendSnap` in store)
7. **"Send To..." sheet flow on preview** — currently the friend picker is always visible in the preview panel. Enhance: add a prominent "Send To..." button that opens a modal/bottom sheet checklist of accepted friends only. User checks off recipients then taps Send.
8. **Store `avatarUrl` in `updateUserProfile`** — extend store function to also save avatarUrl

### Modify
- `User` type: add `avatarUrl?: string`
- `UserAvatar` component: accept `avatarUrl?: string` prop and render photo if available
- `ProfileTab`: add avatar upload (file input), bio char counter, show avatar photo
- `ChatsTab`: pass `avatarUrl` to all `UserAvatar` uses
- `RequestsTab`: pass `avatarUrl` to all `UserAvatar` uses
- `CameraTab`: pass `avatarUrl` to friend picker chips; refactor friend picker into a bottom-sheet modal triggered by "Send To..." button
- `store.ts`: update `updateUserProfile` to accept and save `avatarUrl`; update `seedDemoData` user objects to include `avatarUrl: undefined`

### Remove
- Nothing removed

## Implementation Plan

1. **types.ts** — Add `avatarUrl?: string` to `User` interface
2. **store.ts** — Update `updateUserProfile` signature to accept optional `avatarUrl` param and save it; ensure `getFriends`, `getConversations`, etc. return full user objects with avatarUrl
3. **Shared.tsx** — Update `UserAvatar` to accept `avatarUrl?: string`; render `<img>` if present, else initials
4. **ProfileTab.tsx** — Add circular avatar with camera-icon overlay that triggers hidden file input; on image select, convert to base64 and call updated `updateUserProfile`; add 150-char counter on bio textarea
5. **ChatsTab.tsx** — Fetch `avatarUrl` from user store/friends when building conversation list and chat header; pass to `UserAvatar`
6. **RequestsTab.tsx** — Fetch `avatarUrl` from user objects; pass to `UserAvatar` in request cards and find-people results
7. **CameraTab.tsx** — Refactor preview bottom panel: replace always-visible friend picker with a "Send To..." button that opens an overlay bottom sheet modal; inside modal, render checkbox-style friend list with avatars; confirm button sends snaps and closes modal
