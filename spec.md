# SnapLink

## Current State

Version 47 is live. SnapLink is a Snapchat-inspired mobile web app built on ICP with:
- Dual auth (Internet Identity + Username/Password)
- Full backend-driven messaging, snaps, stories, groups, streaks
- All 17 features live: Stories, Reactions, Group Chats, Filters, Drawing, Stickers, Text Styles, Screenshot Detection, Disappearing Messages, Ghost Mode, Best Friends, Daily Snap Challenge, Snap Score, Voice Messages, Location Sharing, Read Receipts Toggle
- Colors: #1A1A2E bg, #00CFFF electric blue, #BD00FF neon purple
- Branding: "Made by Deepak Chahal"

## Requested Changes (Diff)

### Add

**New Features:**
1. **Chat Themes** -- Per-conversation color accent selector (6 preset themes: default blue, neon purple, sunset orange, mint green, rose pink, gold). Stored in localStorage per conversation. Theme tints the message bubbles and chat header.
2. **Message Recall** -- Long-press any sent message to get a "Delete for everyone" option within 60 seconds. Shows "Message deleted" placeholder in both sender and receiver views.
3. **Mood Status** -- Daily mood picker in Profile (emoji + label: Happy 😊, Chill 😎, Busy 🔥, Tired 😴, Excited 🎉, Focused 💪). Shown as a subtle badge on the user's avatar in chat list and stories row. Stored in localStorage.
4. **Snap Streak Celebration** -- When a streak hits 7, 14, 30 days, show a confetti/celebration animation and toast.
5. **Online Pulse** -- Subtle animated green dot on friend avatars in chat list when they were recently active (active within last 5 minutes, based on message timestamp heuristic). Respects Ghost Mode.

**UI Polish (Rich UI):**
- **Glassmorphism cards** -- Replace flat card surfaces with frosted glass style (backdrop-blur, subtle border glow) on chat items, story bubbles, profile stats
- **Gradient message bubbles** -- Sent messages use a vivid blue→purple gradient; received use a softer glass style
- **Animated bottom nav** -- Active tab indicator uses a glowing pill + icon scale animation
- **Header blur** -- Chat and profile headers get a blur backdrop so content scrolls under them elegantly
- **Story ring glow** -- Story avatar rings pulse with a neon glow animation
- **Snap open animation** -- Snap viewer entrance uses a cinematic scale-up + blur fade
- **Profile header** -- Avatar gets a larger ring with animated gradient border; stats section gets gradient icon backgrounds
- **Login screen** -- Full-screen gradient backdrop with floating particles/shapes, larger logo, smoother form card
- **Micro-animations** -- Button press feedback, list item entrance stagger, reaction pill pop animation
- **Typography** -- Use heavier font weights for names, softer weight for metadata; improve hierarchy

### Modify
- ChatsTab: Add theme picker in chat header (⚙ icon), add message recall on long-press, add online pulse dots, improve message bubble styling
- ProfileTab: Add mood status picker section, improve stats cards with gradient backgrounds, improve Best Friends section styling
- StoriesRow: Add pulsing glow ring animation on story bubbles
- LoginScreen: Enhanced backdrop and visual richness
- BottomNav: Glowing active tab pill
- index.css: Add glassmorphism utilities, gradient bubble classes, glow animations

### Remove
- Nothing removed

## Implementation Plan

1. **index.css** -- Add glassmorphism `.glass-card` class, gradient bubble classes `.message-sent-gradient`, `.message-received-glass`, glow keyframes for story rings, pulse dot animation, confetti utility
2. **ChatsTab.tsx**
   - Add chat theme state (localStorage per convo), theme picker sheet in chat header
   - Add message recall: long-press (500ms) on sent message shows context menu with "Delete for everyone"; sends special `[DELETED]` content via backend; receiver sees greyed placeholder
   - Add online pulse dot on ConversationItem avatars (green dot if lastMessageTimestamp < 5min ago as heuristic)
   - Upgrade message bubble styling to use theme-tinted gradients
   - Glassmorphism on conversation list items
3. **ProfileTab.tsx**
   - Add MoodStatus section after stats: emoji grid picker, saves to localStorage, shown as overlay badge on avatar
   - Improve stats card styling with colored gradient backgrounds
   - Show mood badge on avatar
4. **Shared.tsx / UserAvatar** -- Support mood badge prop, online pulse dot prop
5. **StoriesRow** -- Add CSS pulsing glow ring to story bubbles via keyframe animation
6. **LoginScreen.tsx** -- Enhanced gradient backdrop with animated floating orbs, larger centered logo, improved form card with glass styling
7. **BottomNav.tsx** -- Animated glowing pill indicator under active tab icon
