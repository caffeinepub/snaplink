# SnapLink

## Current State
All backend methods that take `callerUsername` as first argument gate access via `AccessControl.hasPermission(caller, #user)`. This permission is only assigned to a principal at registration time. Username/password users call the backend via an anonymous actor (no identity), so their principal has no `#user` role. This causes `getFriends`, `getSentRequests`, `sendConnectionRequest`, `getPendingRequestCount`, `getPendingRequests`, `sendMessage`, `getMessages`, and all other authenticated calls to fail or return empty arrays silently. The result: friends appear as strangers, "Add" button shows for friends, and sending requests appears to do nothing.

## Requested Changes (Diff)

### Add
- Username-based auth validation helper `isValidUser(username)` that checks the username exists in `usersByUsername`

### Modify
- Replace `AccessControl.hasPermission(caller, #user)` with `isValidUser(callerUsername)` for all methods that take `callerUsername` as their first argument and are meant to work for both II and username/password users
- Keep `AccessControl.hasPermission` only for admin operations and methods that specifically require II (none currently)
- `updateProfile` already uses `resolveUsername` which validates the user exists -- simplify to match the same pattern

### Remove
- Principal-based user permission gate on all `callerUsername`-keyed methods

## Implementation Plan
1. Add `isValidUser` helper in backend main.mo
2. Replace all `AccessControl.hasPermission(accessControlState, caller, #user)` with `isValidUser(callerUsername)` for every method that has a `callerUsername` parameter
3. Keep admin check on `clearAllData`
4. No frontend changes needed -- the backend fix is sufficient
