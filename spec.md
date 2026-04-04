# SnapLink

## Current State
- CameraTab has a single-tap capture button for photos only
- No video recording capability
- After capture, preview screen shows the photo with a Send To sheet (bottom sheet friend selector)
- Send To sheet already supports multi-select friends with checkboxes
- Caption exists but is only auto-filled by AI Assistant; no manual caption input
- RequestsTab has a basic `FindPeopleSection` with a text search input that filters users client-side
- Search shows results with username/displayName and a Connect button
- No profile preview, mutual friends indicator, or request status awareness in search
- Backend has `searchUsers(q)` query that does substring matching on username and displayName
- Backend has `sendConnectionRequest(toUsername)` for sending friend requests
- No `sendSnapWithCaption` or video support in backend

## Requested Changes (Diff)

### Add
- **Hold-to-record video**: Camera button records video while held, stops on release. No hard time limit. Uses MediaRecorder API.
- **Video preview**: After recording, show video playback preview before sending (similar to photo preview)
- **Manual caption input**: Text input on the preview screen so users can type a caption before sending (separate from AI-generated captions)
- **Caption in snap**: Caption text passed along with the snap when sending
- **Improved friend search system**: Enhanced FindPeopleSection with:
  - Real-time search as user types
  - Profile preview cards showing avatar, display name, username, bio
  - Show request status: sent/pending/already friends
  - Mutual friend count if possible
  - Suggested people section (show all users when search is empty, excluding already-friends and self)
  - Better empty state messaging

### Modify
- **Camera capture button UI**: Visual distinction between tap (photo) and hold (video) -- outer ring pulses/animates during recording
- **Preview screen**: Add video `<video>` element for video previews alongside existing `<img>` for photos; add manual caption input box below the snap
- **Send snap flow**: Include caption in snap content when sending
- **RequestsTab FindPeopleSection**: Rebuild with better UX -- shows suggested users by default, updates on search query, shows relationship status per user
- **Backend sendSnap**: Accept optional caption parameter and store it in message content

### Remove
- Nothing removed

## Implementation Plan
1. Update `sendSnap` backend function to accept an optional caption parameter and store it in the message content field
2. Update CameraTab:
   - Add `isRecording` state and MediaRecorder logic for hold-to-record video
   - Camera button: `onPointerDown` starts recording, `onPointerUp`/`onPointerLeave` stops recording
   - Visual recording indicator (pulsing red ring) during recording
   - Add `capturedVideo` state (Blob URL) alongside `capturedImage`
   - Preview screen renders `<video>` for video media and `<img>` for photo media
   - Add manual caption `<input>` or `<textarea>` on the preview screen
   - Pass caption along in `handleSendSnap`
3. Update RequestsTab FindPeopleSection:
   - Show a "Suggested People" list when query is empty (all users excluding self and existing connections)
   - Filter to search results when query is non-empty
   - Add profile card with bio snippet
   - Show relationship state badge: already friends, pending sent, pending received, or Connect button
4. Update store.ts if needed to support caption in sendSnap call
