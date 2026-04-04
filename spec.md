# SnapLink

## Current State
- Requests tab has an "All People" section that auto-loads all registered users
- A "Find People" search section requires typing a query before showing results
- Friend request system: sending a request creates a pending entry visible to the recipient immediately in their pending list
- Backend stores connection requests in a Map; `getPendingRequests` returns all requests where `toUser == caller`

## Requested Changes (Diff)

### Add
- Mutual-interest friend system: two users become friends only when BOTH have independently sent each other a request
- When User A sends a request to User B, User B does NOT see it as a pending request
- When User B also sends a request to User A, the system detects the mutual interest and automatically accepts both into a friendship — both users then see each other as friends
- The "Find People" section shows all users immediately without needing to type (same behavior as All People section)

### Modify
- Backend `sendConnectionRequest`: when a request is sent, check if a reverse pending request already exists from the target user; if yes, automatically accept both and set status to `accepted`
- Backend `getPendingRequests`: only return requests where BOTH sides have sent to each other (i.e., mutual matches) — so a one-sided request is invisible to the receiver
- Frontend `FindPeopleSection`: remove the gate that hides results when query is empty; show all users by default, filter when query is typed
- Frontend `AllPeopleSection`: no change needed (already auto-loads)
- Frontend connection status logic: reflect mutual-only pending logic (no more `pending_received` until mutual)

### Remove
- One-sided pending request visibility from the receiver's side

## Implementation Plan
1. Update `sendConnectionRequest` in `main.mo`: check for reverse request; if found, set both to `#accepted`; otherwise create `#pending` as before
2. Update `getPendingRequests` in `main.mo`: only return requests that are `#pending` AND have a matching reverse `#pending` request (mutual matches only) — or keep returning accepted requests for the accepted state display
3. Update `FindPeopleSection` in `RequestsTab.tsx`: load all users on mount (like AllPeopleSection does) and filter by query when present; no empty-state prompt
4. Update connection status resolution in both sections: `pending_received` should only appear when there is a MUTUAL pending (both sides sent), which the backend now handles by auto-accepting
