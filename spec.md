# SnapLink

## Current State
- CameraTab has a preview panel with a "Send To..." bottom sheet (SendToSheet). Friends list is loaded once on mount via `useEffect`. The send sheet may show an empty friends list if loaded before friends data is ready, or if the list is stale.
- RequestsTab/FindPeopleSection shows all non-friend users by default, filtered to hide `friends` status. Users who are already friends are not visible in Find People without searching.

## Requested Changes (Diff)

### Add
- Refresh friends list every time the Send To sheet is opened (not just on mount)
- Show ALL registered users in Find People by default (no search required) — including friends, with a "Friends" badge, and new users who just signed up via any auth method

### Modify
- CameraTab: call `getFriends` fresh when `showSendSheet` becomes true, not just on mount
- RequestsTab FindPeopleSection: remove the `friends` filter so all users appear, sorted as: pending_received first, then none, then pending_sent, then friends last
- FindPeopleSection: section label changes from "People You May Know" to "All People" when no search query

### Remove
- Nothing removed

## Implementation Plan
1. CameraTab: add a `useEffect` on `showSendSheet` that calls `getFriends` and updates the `friends` state whenever the sheet opens
2. RequestsTab FindPeopleSection: change sort order to include friends (connectionStatus: 'friends' moves to end), remove `.filter(u => u.connectionStatus !== 'friends')` from the no-query branch so all users are shown
3. Update the section label text to reflect showing all users
