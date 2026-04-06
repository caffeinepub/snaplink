# SnapLink — Version 50

## Current State
SnapLink is a full-featured mobile-first social snapping app on ICP. Version 49 is live with:
- All 17 core features (Streaks, Stories, Reactions, Group Chats, Filters, Drawing, Stickers, Text Styles, Screenshot Detection, Disappearing Messages, Ghost Mode, Best Friends, Daily Snap Challenge, Snap Score, Voice Messages, Location Sharing, Read Receipts Toggle)
- v48 additions: Chat Themes, Message Recall, Mood Status, Online Pulse, full UI polish
- Mobile-optimized: no zoom, fit-to-device viewport
- Backend: Motoko canister with snap scores, streaks, stories, groups, reactions, ghost mode, read receipts, daily login bonus
- Frontend: React/TypeScript, 5-tab bottom nav (Chats, Requests, Camera, Profile), dark theme (#1A1A2E bg, #00CFFF / #BD00FF accents)

## Requested Changes (Diff)

### Add
1. **Snap Leaderboard** — new section/screen accessible from Profile tab
   - `getLeaderboard(callerUsername)` backend query: returns all friends' snap scores + caller's own score, sorted descending
   - Frontend: podium display for top 3 (gold/silver/bronze medals), ranked list for positions 4–10, caller's rank always shown (highlighted) even if outside top 10
   - All-time ranking (no weekly reset)

2. **Achievement Badges** — new section in Profile tab
   - Backend: `getAchievements(callerUsername)` returns 12 badge unlock states based on existing data
   - Badge criteria evaluated server-side from existing snap scores, friend counts, streak counts, story/group/voice/location data
   - 12 badges: First Snap Sent, First Friend Added, 7-Day Streak, 30-Day Streak, 10 Friends, 50 Snaps Sent, 100 Snaps Sent, Story Posted, Group Chat Created, Voice Message Sent, Location Shared, Snap Score 500
   - Frontend: badge grid in Profile tab with locked (grayscale/dim) and unlocked (glowing, colored) states
   - Toast notification fires when a badge unlocks (track previously-seen badge state in localStorage)

3. **Time Capsule Snap** — extension to the snap send flow
   - New message type: `capsule` snaps with `unlockAt: Int` timestamp
   - Backend: `sendCapsuleSnap(callerUsername, toUsername, blobId, unlockAt)` — stores snap with future unlock timestamp
   - Backend: `getCapsuleStatus(messageId)` — returns whether capsule is locked/unlocked
   - Frontend sender side: after photo/video capture, optional "Time Capsule" toggle → date picker (Tomorrow / 1 Week / 1 Month / Custom date)
   - Frontend recipient side: locked capsule shows sealed capsule icon + countdown timer in chat; when unlockAt is reached, shows normal "Tap to open snap" button
   - Both sender and recipient get toast notification when capsule unlocks (checked on each message poll)

### Modify
- `ProfileTab.tsx` — add Leaderboard button/section and Achievement Badges grid below existing stats
- `ChatsTab.tsx` — handle `capsule` message type rendering (sealed icon + countdown)
- `CameraTab.tsx` — add Time Capsule option in send flow
- `backend.did.js` and `backend.d.ts` — add new method signatures for leaderboard, achievements, capsule snap
- `main.mo` — add new stable state, types, and query/update methods

### Remove
- Nothing removed

## Implementation Plan
1. Update Motoko backend (`main.mo`) — add `TimeCapsuleSnap` message extension, `getLeaderboard`, `getAchievements`, `sendCapsuleSnap`, `getCapsuleStatus` methods; add stable state for tracking badge-related counters (voice messages sent, location shares, stories posted, groups created per user)
2. Update IDL declarations (`backend.did.js`, `backend.d.ts`) — add new method types
3. Update `ProfileTab.tsx` — add Leaderboard panel (podium + list) and Achievements badge grid with toast on unlock
4. Update `ChatsTab.tsx` — render capsule snaps with countdown timer, handle unlock state
5. Update `CameraTab.tsx` — add Time Capsule toggle and date picker in send sheet
