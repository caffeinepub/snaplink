# SnapLink - Social Chat & Snap App

## Current State
New project. No existing application files.

## Requested Changes (Diff)

### Add
- Full user authentication: Username/Password login + Internet Identity (ICP wallet)
- User profile system: display name, username, avatar stored on-chain per principal/user ID
- Friend/Connection system: send, accept, decline connection requests; pending requests screen
- Chat interface: real-time messaging via polling (every 2-3s), timestamps, read receipts, message bubbles
- Snap feature: capture photo via live device camera OR upload from gallery; optional ephemeral (disappear after view) or save-to-chat toggle; snap preview with ephemeral countdown timer
- Full-screen camera viewfinder with glowing UI controls
- Bottom navigation bar: Chats, Requests, Camera, Profile tabs
- Settings page with "Made by Deepak Chahal" branding
- Splash/Login screen with "Made by Deepak Chahal" branding
- Pending Requests screen with accept (glowing blue) and decline (muted red border) buttons, checkmark animation on accept
- Smooth screen transitions, bounce animations on buttons, slide-in effects

### Modify
N/A (new project)

### Remove
N/A (new project)

## Implementation Plan

### Backend (Motoko)
1. **User Store** -- Map principal/username -> UserProfile { id, username, passwordHash, displayName, avatarUrl, createdAt }
2. **Auth** -- register(username, password), login(username, password) -> session token; also support Internet Identity principal directly
3. **Connection System** -- sendRequest(toUserId), acceptRequest(fromUserId), declineRequest(fromUserId), getPendingRequests(), getFriends()
4. **Messaging** -- sendMessage(toUserId, content, isSnap, saveToChat), getMessages(withUserId, since), markRead(messageId)
5. **Snap Storage** -- store snap blob reference (via blob-storage), ephemeral flag, viewedBy tracking; auto-expire after view if ephemeral
6. **Notification counts** -- unread message count, pending request count per user

### Frontend (React + TypeScript)
1. Splash screen with logo, gradient branding, "Made by Deepak Chahal"
2. Login/Register screen with tab toggle (Username/Password vs Internet Identity)
3. Bottom nav layout shell with 4 tabs
4. Chats tab: conversation list, individual chat view with message bubbles
5. Requests tab: pending requests list with accept/decline, checkmark animation
6. Camera tab: live camera viewfinder + gallery upload, snap preview with timer, save-to-chat toggle
7. Profile tab: display info, settings, "Made by Deepak Chahal" footer
8. Animations: screen slide transitions, button bounce, accept checkmark
