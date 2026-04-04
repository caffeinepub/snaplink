# SnapLink

## Current State

All auth-dependent canister methods (`getSentRequests`, `getFriends`, `getPendingRequests`, `sendConnectionRequest`, `getConversations`, `sendMessage`, `sendSnap`, `getMessages`, `markMessageRead`, `viewSnap`, `getUnreadCount`, `getPendingRequestCount`, `updateProfile`, `respondToRequest`) use `caller` (the IC principal) to identify the current user.

Username/password users call with an anonymous principal because no identity is passed to the actor. This means `caller` is anonymous, all user lookups return null, and all authenticated calls silently return empty arrays or errors.

Internet Identity users work because their II principal is stored in `usersByPrincipal` and is correctly resolved via `caller`.

## Requested Changes (Diff)

### Add
- `callerUsername: Text` parameter to every auth-dependent backend method
- A `verifyUser` helper in the backend that accepts `(callerUsername, principal)` and resolves the correct username: if `callerUsername` is non-empty and the user exists, use it; otherwise fall back to `getPrincipalUsername(caller)` for II users
- `callerUsername` parameter to `backendStore.ts` wrapper functions so the frontend can pass the logged-in username

### Modify
- All auth-dependent Motoko methods to use `verifyUser` instead of directly calling `getPrincipalUsername(caller)`
- `backendStore.ts` functions to accept and forward `callerUsername` 
- `RequestsTab.tsx` to pass `currentUser.username` to all backend calls
- `ChatsTab.tsx` and any other component using backend calls to pass `currentUser.username`
- IDL bindings (`backend.did.js` and `backend.did.d.ts`) to reflect new method signatures

### Remove
- Nothing

## Implementation Plan

1. Update `main.mo`: add `callerUsername` param to `sendConnectionRequest`, `getSentRequests`, `getPendingRequests`, `getFriends`, `getConversations`, `sendMessage`, `sendSnap`, `getMessages`, `markMessageRead`, `viewSnap`, `getUnreadCount`, `getPendingRequestCount`, `updateProfile`, `respondToRequest`. Add `verifyUser` helper.
2. Update `backend.did.js` and `backend.did.d.ts` IDL bindings to match new signatures.
3. Update `backendStore.ts` wrapper functions to accept and pass `callerUsername`.
4. Update `RequestsTab.tsx` to pass `currentUser.username`.
5. Update `ChatsTab.tsx` and `ProfileTab.tsx` to pass `currentUser.username`.
6. Validate (typecheck + build) and deploy.
