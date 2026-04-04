# SnapLink

## Current State

Version 27 is live. The app has:
- Dual auth: Username/Password and Internet Identity
- All user/friend data stored in the ICP Motoko backend canister
- Messages and snaps stored in the backend canister with blob-storage for media
- Requests tab with all users shown automatically + Find People search
- Chats tab with backend-driven conversations, search, and New Chat button
- Mutual friend request system
- Demo accounts seeded on startup

**Outstanding issue**: Replica error at login. The error occurs when `backendLogin` or `backendRegister` calls are made via the anonymous actor. The root cause is that the ICP agent's `processError` function in `config.ts` re-throws raw ICP error messages that contain "Replica error" text from the agent's internal certificate validation or network errors. Additionally, the anonymous actor in `backendStore.ts` is created via `anonActor()` which calls `createActorWithConfig()` but that function only fetches root key for localhost — in production (IC mainnet), the agent needs to handle responses gracefully without crashing on certificate verification edge cases.

The second issue is that all error paths in `backendLogin`, `backendRegister`, `backendLoginWithII`, and `backendRegisterWithII` use `String(e)` which can turn an ICP agent Error object into a long internal error message like `AgentHTTPResponseError: Server returned an error:\n  Code: 400\n  Body: ...Replica errors...`.

## Requested Changes (Diff)

### Add
- Friendly error message sanitizer in `backendStore.ts` that strips internal ICP agent error text and shows a human-readable message instead

### Modify
- `backendStore.ts`: Replace raw `String(e)` error handling in all auth functions with a `sanitizeError()` helper that:
  - Detects "Replica error", "AgentHTTPResponse", "Certificate", "fetch", "network" etc. keywords
  - Returns a friendly message like "Could not connect to server. Please try again."
  - For actual canister errors (e.g. "User not found", "Username already taken"), passes them through unchanged
- `backendStore.ts`: Wrap ALL backend call error paths (not just auth) with the sanitizer so the app never shows raw agent errors to users
- `backendStore.ts`: The `anonActor()` function currently uses `createActorWithConfig()` directly. Make it more resilient by catching agent-level errors rather than letting them bubble up as unhandled

### Remove
- Nothing removed

## Implementation Plan

1. Add a `sanitizeError(e: unknown): string` helper in `backendStore.ts` that:
   - Checks if the error message contains ICP agent internal keywords
   - Returns a friendly fallback message for agent/network errors
   - Returns the original error text for canister-level errors (user-facing)
2. Replace all `catch (e) { return { err: String(e) }; }` in auth functions with `sanitizeError(e)`
3. Apply the same sanitization to all other backend functions that return `{ err: string }`
4. Test that login with wrong password still shows the correct canister error, while network/replica errors show the friendly message
