# SnapLink

## Current State
The Requests tab has three broken areas:
1. **All users not showing**: `backendGetAllUsers()` calls `actor.getAllUsers()` but `getAllUsers` is missing from the IDL bindings (`backend.did.js` and `backend.did.d.ts`), so the call silently returns `[]`.
2. **Search not working**: The Find People section loads from `backendGetAllUsers()` which also returns empty for the same reason.
3. **Connection status wrong**: Both `AllPeopleSection` and `FindPeopleSection` determine friend/pending status from `getRequests()` (localStorage), but all connection requests go through the backend canister. localStorage has no record of backend requests, so every user shows as "none" (Add button) even if you already sent a request or are already friends.
4. **Pending requests not shown**: `getPendingRequests` on the backend uses the mutual-only logic, but the frontend also checks localStorage for incoming requests — which is always empty since requests go through the canister.

## Requested Changes (Diff)

### Add
- `getAllUsers` method to IDL bindings (`backend.did.js`, `backend.did.d.ts`)
- `getSentRequests` backend method in `main.mo` — returns all pending requests sent BY the current user (so frontend can show "Request Sent" badge)
- `getSentRequests` to IDL bindings and `backendStore.ts`

### Modify
- `RequestsTab.tsx`: rewrite `AllPeopleSection` and `FindPeopleSection` to derive connection status purely from backend data:
  - Friends: from `backendGetFriends(identity)`
  - Sent requests: from new `backendGetSentRequests(identity)`
  - Incoming mutual requests: from `backendGetPendingRequests(identity)` (these are mutual-only per the backend logic)
  - Remove all localStorage (`getRequests()`, `saveRequests()`) usage from these sections
- `backendStore.ts`: add `backendGetSentRequests()` function

### Remove
- localStorage dependency for connection status in RequestsTab

## Implementation Plan
1. Add `getSentRequests` to `main.mo` — returns pending requests where `fromUser == caller`
2. Add `getAllUsers` and `getSentRequests` to `backend.did.js` and `backend.did.d.ts`
3. Add `backendGetSentRequests()` to `backendStore.ts`
4. Rewrite `RequestsTab.tsx` to use backend-only status logic — no localStorage
