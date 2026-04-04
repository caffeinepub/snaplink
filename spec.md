# SnapLink

## Current State

SnapLink is a fully functional social snap/chat app on ICP. Version 40 is live with these features:
- Dual auth (Internet Identity + Username/Password)
- Full messaging and snap sharing (photos, videos) via backend canister
- Friend system (mutual request model)
- Camera tab: photo capture, video capture, gallery upload
- Filters/Overlays (warm, cool, B&W, vivid, timestamp) -- added v40
- Snap Stories (post + view friend stories) -- added v40
- Reactions (emoji reactions on messages, long-press) -- added v40
- Group Chats (create group from friends, send messages) -- added v40
- Snap Streaks + Snap Score -- added v40
- Real-time notifications, profile stats auto-refresh
- AI Snap Assistant on camera preview

### Backend methods relevant to new features:
- `sendMessage(callerUsername, toUsername, content)` -- sends plain text message
- `getMessages(callerUsername, withUsername, since)` -- fetches messages between two users
- `Message` type: `{ id, senderId, receiverId, content, timestamp, isRead, isSnap, snapBlobId, isEphemeral, snapViewed }`
- `getProfile(username)` -- returns UserProfile
- `updateProfile(callerUsername, displayName, bio)` -- updates profile
- No existing backend methods for: disappearing messages, ghost mode, screenshot detection, drawing tool, sticker packs, text styles

### Frontend components:
- `CameraTab.tsx` (1449 lines) -- handles photo/video capture, filter overlay, AI assistant, send sheet
- `ChatsTab.tsx` (2121 lines) -- handles conversations list, individual chat view, group chat, stories row
- `ProfileTab.tsx` -- user profile with stats, settings
- `types.ts` -- shared types including `Message`, `User`, `Tab`
- `backendStore.ts` -- all backend call wrappers
- `AppContext.tsx` -- global state (currentUser, activeTab, selectedConversation)

## Requested Changes (Diff)

### Add
1. **Drawing & Doodle Tool** -- on the snap preview canvas after photo capture, a toolbar appears with 6 colors + brush size slider; user draws on the canvas; strokes are merged into the JPEG image via Canvas API before sending
2. **Sticker Packs** -- a sticker panel opens from camera preview showing emoji stickers in categories (Expressions, Animals, Symbols, Food); user taps a sticker to place it on the canvas; it can be dragged to reposition; baked into the image before sending
3. **Text Styles** -- a text input with a style selector (Bold, Neon, Typewriter, Bubble, Shadow) renders styled text onto the snap preview canvas, baked in before sending
4. **Screenshot Detection** -- when a snap is open in the chat view (the full-screen snap viewer), a deterrent overlay banner reads "🚫 Screenshots are not allowed"; `user-select: none` and `pointer-events: none` on the snap image; a CSS blur is applied if the user tries to right-click
5. **Disappearing Messages** -- a timer icon (⏱) is added next to the chat message input; tapping it shows a picker: Off / 1 min / 1 hour / 24 hours; chosen duration is stored; when a message is sent with a timer, the timer value is embedded in the message content as a metadata prefix `[DISAPPEAR:60]`; frontend parses this on load and auto-deletes messages client-side when expired; a small clock icon shows on timed messages; a new backend field `disappearAfter` (optional Nat, seconds) is added to Message type

### Modify
- `Message` type: add optional `disappearAfter` field (seconds as Nat, 0 = never) -- backend and frontend types
- `sendMessage` backend call: accept additional `disappearAfter` parameter
- `CameraTab.tsx`: add Drawing Tool toolbar, Sticker panel, and Text Styles toolbar to the snap preview stage
- `ChatsTab.tsx`: add disappearing message timer UI, screenshot deterrent overlay on snap viewer
- `types.ts`: add `disappearAfter?: number` to `Message` interface
- `backendStore.ts`: update `backendSendMessage` to pass `disappearAfter`

### Remove
- Nothing is removed

## Implementation Plan

1. **Backend**: Add `disappearAfter: ?Nat` to `Message` type; update `sendMessage` to accept it; store and return it in `getMessages`
2. **Types**: Update `Message` in `types.ts` to include `disappearAfter?: number`
3. **backendStore.ts**: Update `backendSendMessage` signature to include `disappearAfter: number`
4. **CameraTab.tsx**: After photo capture, show three new toolbar sections:
   - Draw tab: color palette (red, orange, yellow, green, blue, white) + brush size slider; canvas draws on top of preview
   - Stickers tab: emoji grid by category; tap to place, drag to reposition; baked in on send
   - Text tab: input + 5 style buttons; rendered via Canvas fillText/strokeText with appropriate font/shadow
   - All three tools share the same HTML5 Canvas overlay on the preview image
5. **ChatsTab.tsx**:
   - Screenshot deterrent: when snap viewer is open, add overlay banner + CSS user-select none
   - Disappearing messages: timer button next to message input; store `selectedDisappearTimer` in local state; when sending, embed timer in message; poll/filter expired messages client-side; show clock icon on timed messages
