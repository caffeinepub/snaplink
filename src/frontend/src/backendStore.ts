/**
 * backendStore.ts
 * Wraps the ICP backend canister for async user/connection operations.
 * All auth-dependent calls pass callerUsername explicitly so both
 * username/password users AND Internet Identity users work correctly.
 */
import type { Identity } from "@icp-sdk/core/agent";
import { createActorWithConfig } from "./config";
import type { ConnectionRequest, User } from "./types";

// ─── Motoko types (raw canister shapes) ─────────────────────────────────────

export interface MotokoUserProfile {
  username: string;
  displayName: string;
  passwordHash: string;
  principalText: string;
  bio: string;
  createdAt: bigint | number;
}

export interface MotokoConnectionRequest {
  id: string;
  fromUser: string;
  toUser: string;
  status: { pending?: null } | { accepted?: null } | { declined?: null };
  createdAt: bigint | number;
}

// ─── Conversion helpers ──────────────────────────────────────────────────────

export function moProfileToUser(p: MotokoUserProfile): User {
  return {
    id: p.username,
    username: p.username,
    displayName: p.displayName,
    bio: p.bio ?? "",
    avatarUrl: undefined,
    createdAt:
      typeof p.createdAt === "bigint"
        ? Number(p.createdAt) / 1_000_000
        : p.createdAt,
    passwordHash: p.passwordHash ?? "",
    useII: !p.passwordHash || p.passwordHash === "",
  };
}

export function moRequestToFrontend(
  r: MotokoConnectionRequest,
  fromProfile?: MotokoUserProfile,
): ConnectionRequest {
  let status: "pending" | "accepted" | "declined" = "pending";
  if ("accepted" in r.status) status = "accepted";
  else if ("declined" in r.status) status = "declined";

  return {
    id: r.id,
    fromUser: r.fromUser,
    fromDisplayName: fromProfile?.displayName ?? r.fromUser,
    fromAvatarUrl: undefined,
    toUser: r.toUser,
    status,
    createdAt:
      typeof r.createdAt === "bigint"
        ? Number(r.createdAt) / 1_000_000
        : r.createdAt,
  };
}

// ─── Actor factory helpers ───────────────────────────────────────────────────

async function getAnonActor(): Promise<any> {
  return createActorWithConfig() as any;
}

async function getAuthActor(identity?: Identity): Promise<any> {
  if (!identity) return getAnonActor();
  return createActorWithConfig({ agentOptions: { identity } }) as any;
}

// ─── Auth functions ──────────────────────────────────────────────────────────

export async function backendRegister(
  username: string,
  password: string,
  displayName: string,
): Promise<{ ok: User } | { err: string }> {
  try {
    const actor = await getAnonActor();
    const result = await actor.register(username, password, displayName);
    if ("ok" in result) {
      return { ok: moProfileToUser(result.ok) };
    }
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendLogin(
  username: string,
  password: string,
): Promise<{ ok: User } | { err: string }> {
  try {
    const actor = await getAnonActor();
    const result = await actor.login(username, password);
    if ("ok" in result) {
      return { ok: moProfileToUser(result.ok) };
    }
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendLoginWithII(
  identity: Identity,
): Promise<{ ok: User } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.loginWithII();
    if ("ok" in result) {
      return { ok: moProfileToUser(result.ok) };
    }
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendRegisterWithII(
  identity: Identity,
  username: string,
  displayName: string,
): Promise<{ ok: User } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.registerWithII(username, displayName);
    if ("ok" in result) {
      return { ok: moProfileToUser(result.ok) };
    }
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function backendSearchUsers(
  query: string,
): Promise<MotokoUserProfile[]> {
  try {
    const actor = await getAnonActor();
    const results = await actor.searchUsers(query);
    return results as MotokoUserProfile[];
  } catch {
    return [];
  }
}

export async function backendGetAllUsers(): Promise<MotokoUserProfile[]> {
  try {
    const actor = await getAnonActor();
    const results = await actor.getAllUsers();
    return results as MotokoUserProfile[];
  } catch {
    return [];
  }
}

export type UserConnectionStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends";

export type UserWithStatus = User & {
  connectionStatus: UserConnectionStatus;
  requestId?: string;
};

// ─── Connection requests ─────────────────────────────────────────────────────

export async function backendSendConnectionRequest(
  callerUsername: string,
  toUsername: string,
  identity?: Identity,
): Promise<{ ok: null } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.sendConnectionRequest(
      callerUsername,
      toUsername,
    );
    if ("ok" in result) return { ok: null };
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendRespondToRequest(
  callerUsername: string,
  requestId: string,
  accept: boolean,
  identity?: Identity,
): Promise<{ ok: null } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.respondToRequest(
      callerUsername,
      requestId,
      accept,
    );
    if ("ok" in result) return { ok: null };
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendGetPendingRequests(
  callerUsername: string,
  identity?: Identity,
): Promise<ConnectionRequest[]> {
  try {
    const actor = await getAuthActor(identity);
    const results: MotokoConnectionRequest[] =
      await actor.getPendingRequests(callerUsername);
    return results.map((r) => moRequestToFrontend(r));
  } catch {
    return [];
  }
}

// Returns outgoing pending requests sent BY the current user
export async function backendGetSentRequests(
  callerUsername: string,
  identity?: Identity,
): Promise<ConnectionRequest[]> {
  try {
    const actor = await getAuthActor(identity);
    const results: MotokoConnectionRequest[] =
      await actor.getSentRequests(callerUsername);
    return results.map((r) => moRequestToFrontend(r));
  } catch {
    return [];
  }
}

export async function backendGetFriends(
  callerUsername: string,
  identity?: Identity,
): Promise<User[]> {
  try {
    const actor = await getAuthActor(identity);
    const results: MotokoUserProfile[] = await actor.getFriends(callerUsername);
    return results.map(moProfileToUser);
  } catch {
    return [];
  }
}

export async function backendGetMessages(
  callerUsername: string,
  withUsername: string,
  since: number,
  identity?: Identity,
): Promise<any[]> {
  try {
    const actor = await getAuthActor(identity);
    const results = await actor.getMessages(
      callerUsername,
      withUsername,
      BigInt(since),
    );
    return results as any[];
  } catch {
    return [];
  }
}

export async function backendSendMessage(
  callerUsername: string,
  toUsername: string,
  content: string,
  identity?: Identity,
): Promise<{ ok: any } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.sendMessage(callerUsername, toUsername, content);
    if ("ok" in result) return { ok: result.ok };
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendSendSnap(
  callerUsername: string,
  toUsername: string,
  blobId: string,
  isEphemeral: boolean,
  saveToChat: boolean,
  identity?: Identity,
): Promise<{ ok: any } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.sendSnap(
      callerUsername,
      toUsername,
      blobId,
      isEphemeral,
      saveToChat,
    );
    if ("ok" in result) return { ok: result.ok };
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

export async function backendMarkMessageRead(
  callerUsername: string,
  messageId: string,
  identity?: Identity,
): Promise<void> {
  try {
    const actor = await getAuthActor(identity);
    await actor.markMessageRead(callerUsername, messageId);
  } catch {
    // ignore
  }
}

export async function backendViewSnap(
  callerUsername: string,
  messageId: string,
  identity?: Identity,
): Promise<void> {
  try {
    const actor = await getAuthActor(identity);
    await actor.viewSnap(callerUsername, messageId);
  } catch {
    // ignore
  }
}

export async function backendGetUnreadCount(
  callerUsername: string,
  identity?: Identity,
): Promise<number> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.getUnreadCount(callerUsername);
    return Number(result);
  } catch {
    return 0;
  }
}

export async function backendGetConversations(
  callerUsername: string,
  identity?: Identity,
): Promise<any[]> {
  try {
    const actor = await getAuthActor(identity);
    const results = await actor.getConversations(callerUsername);
    return results as any[];
  } catch {
    return [];
  }
}

export async function backendUpdateProfile(
  callerUsername: string,
  displayName: string,
  bio: string,
  identity?: Identity,
): Promise<{ ok: null } | { err: string }> {
  try {
    const actor = await getAuthActor(identity);
    const result = await actor.updateProfile(callerUsername, displayName, bio);
    if ("ok" in result) return { ok: null };
    return { err: result.err };
  } catch (e) {
    return { err: String(e) };
  }
}

// ─── Demo account seeding ────────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { username: "alex_nova", password: "demo123", displayName: "Alex Nova" },
  { username: "sara_moon", password: "demo123", displayName: "Sara Moon" },
  { username: "kai_zen", password: "demo123", displayName: "Kai Zen" },
  { username: "priya_v", password: "demo123", displayName: "Priya Verma" },
];

export async function backendSeedDemoAccounts(): Promise<void> {
  for (const acc of DEMO_ACCOUNTS) {
    try {
      // Try login first — if it succeeds the account already exists
      const loginResult = await backendLogin(acc.username, acc.password);
      if ("ok" in loginResult) continue;
      // Otherwise register
      await backendRegister(acc.username, acc.password, acc.displayName);
    } catch {
      // Silently skip errors for individual accounts
    }
  }
}
