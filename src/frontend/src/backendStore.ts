/**
 * backendStore.ts
 * Clean, from-scratch wrapper around the ICP backend canister.
 *
 * All authenticated calls pass callerUsername as the first argument
 * so both username/password AND Internet Identity users are handled
 * identically — no reliance on IC "caller" principal for auth.
 *
 * Actor instances are cached to avoid recreating HttpAgent on every call.
 */
import type { Identity } from "@icp-sdk/core/agent";
import { HttpAgent } from "@icp-sdk/core/agent";
import { createActorWithConfig, loadConfig } from "./config";
import type { ConnectionRequest, User } from "./types";
import { StorageClient } from "./utils/StorageClient";

// ─── Error sanitization ──────────────────────────────────────────────────────

const ICP_INFRASTRUCTURE_KEYWORDS = [
  "AgentHTTP",
  "Replica",
  "Certificate",
  "Failed to fetch",
  "NetworkError",
  "CBOR",
  "Could not decode",
  "is stopped",
  "canister is stopped",
  "canister stopped",
  "out of cycles",
  "has been stopped",
  "IC0504",
  "IC0503",
  "IC0302",
  "IC0301",
  "503",
  "unavailable",
  "Call failed to parse",
  "body could not be parsed",
];

function sanitizeError(e: unknown): string {
  const msg = String(e);
  if (
    ICP_INFRASTRUCTURE_KEYWORDS.some((kw) =>
      msg.toLowerCase().includes(kw.toLowerCase()),
    )
  ) {
    return "Server is temporarily unavailable. Please try again in a moment.";
  }
  const colonIdx = msg.lastIndexOf(": ");
  if (colonIdx !== -1) {
    const extracted = msg.substring(colonIdx + 2).trim();
    if (extracted.startsWith("{") || extracted.startsWith("[")) {
      return "Server is temporarily unavailable. Please try again in a moment.";
    }
    return extracted;
  }
  if (msg.trim().startsWith("{") || msg.trim().startsWith("[")) {
    return "Server is temporarily unavailable. Please try again in a moment.";
  }
  return msg;
}

// ─── Raw Motoko types ────────────────────────────────────────────────────────

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

// ─── Story types ──────────────────────────────────────────────────────────────

export interface Story {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  blobId: string;
  caption: string;
  timestamp: number;
  expiresAt: number;
}

// ─── Reaction types ──────────────────────────────────────────────────────────

export interface Reaction {
  username: string;
  emoji: string;
  timestamp: number;
}

// ─── Group types ─────────────────────────────────────────────────────────────

export interface GroupInfo {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  createdAt: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderUsername: string;
  content: string;
  timestamp: number;
  isSnap: boolean;
  snapBlobId?: string;
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

function moStoryToFrontend(s: any): Story {
  return {
    id: String(s.id),
    authorUsername: String(s.authorUsername),
    authorDisplayName: String(s.authorDisplayName ?? s.authorUsername),
    blobId: String(s.blobId ?? ""),
    caption: String(s.caption ?? ""),
    timestamp:
      typeof s.timestamp === "bigint"
        ? Number(s.timestamp) / 1_000_000
        : Number(s.timestamp ?? 0),
    expiresAt:
      typeof s.expiresAt === "bigint"
        ? Number(s.expiresAt) / 1_000_000
        : Number(s.expiresAt ?? 0),
  };
}

function moReactionToFrontend(r: any): Reaction {
  return {
    username: String(r.username),
    emoji: String(r.emoji),
    timestamp:
      typeof r.timestamp === "bigint"
        ? Number(r.timestamp) / 1_000_000
        : Number(r.timestamp ?? 0),
  };
}

function moGroupToFrontend(g: any): GroupInfo {
  return {
    id: String(g.id),
    name: String(g.name),
    createdBy: String(g.createdBy),
    members: Array.isArray(g.members)
      ? g.members.map((m: any) => String(m))
      : [],
    createdAt:
      typeof g.createdAt === "bigint"
        ? Number(g.createdAt) / 1_000_000
        : Number(g.createdAt ?? 0),
  };
}

function moGroupMessageToFrontend(m: any): GroupMessage {
  return {
    id: String(m.id),
    groupId: String(m.groupId),
    senderUsername: String(m.senderUsername),
    content: String(m.content ?? ""),
    timestamp:
      typeof m.timestamp === "bigint"
        ? Number(m.timestamp) / 1_000_000
        : Number(m.timestamp ?? 0),
    isSnap: Boolean(m.isSnap),
    snapBlobId: m.snapBlobId?.[0] ? String(m.snapBlobId[0]) : undefined,
  };
}

// ─── Actor caching ────────────────────────────────────────────────────────────
// We cache one anonymous actor and one per identity key to avoid
// recreating HttpAgent on every backend call (major source of lag/errors).

let _anonActorCache: any = null;
const _identityActorCache = new Map<string, any>();

async function anonActor(): Promise<any> {
  if (_anonActorCache) return _anonActorCache;
  _anonActorCache = (await createActorWithConfig()) as any;
  return _anonActorCache;
}

async function actor(identity?: Identity): Promise<any> {
  if (!identity) return anonActor();
  // Use the identity's principal text as a cache key
  let key: string;
  try {
    key = identity.getPrincipal().toText();
  } catch {
    key = "__unknown__";
  }
  if (_identityActorCache.has(key)) return _identityActorCache.get(key);
  const a = (await createActorWithConfig({
    agentOptions: { identity },
  })) as any;
  _identityActorCache.set(key, a);
  return a;
}

/** Call this after logout to flush cached actors */
export function clearActorCache(): void {
  _anonActorCache = null;
  _identityActorCache.clear();
  _storageClientCache = null;
  _configCache = null;
}

// ─── StorageClient caching ────────────────────────────────────────────────────
// Reuse one StorageClient across all uploads/downloads to avoid recreating
// HttpAgent on every call (the main source of snap upload lag).

let _storageClientCache: StorageClient | null = null;
let _configCache: any = null;

async function getStorageClient(): Promise<StorageClient> {
  if (_storageClientCache) return _storageClientCache;
  const config = _configCache ?? (await loadConfig());
  _configCache = config;
  const agent = new HttpAgent({ host: config.backend_host });
  _storageClientCache = new StorageClient(
    config.bucket_name,
    config.storage_gateway_url,
    config.backend_canister_id,
    config.project_id,
    agent,
  );
  return _storageClientCache;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function backendRegister(
  username: string,
  password: string,
  displayName: string,
): Promise<{ ok: User } | { err: string }> {
  try {
    const a = await anonActor();
    const result = await a.register(username, password, displayName);
    if ("ok" in result) return { ok: moProfileToUser(result.ok) };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendLogin(
  username: string,
  password: string,
): Promise<{ ok: User } | { err: string }> {
  try {
    const a = await anonActor();
    const result = await a.login(username, password);
    if ("ok" in result) return { ok: moProfileToUser(result.ok) };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendLoginWithII(
  identity: Identity,
): Promise<{ ok: User } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.loginWithII();
    if ("ok" in result) return { ok: moProfileToUser(result.ok) };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendRegisterWithII(
  identity: Identity,
  username: string,
  displayName: string,
): Promise<{ ok: User } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.registerWithII(username, displayName);
    if ("ok" in result) return { ok: moProfileToUser(result.ok) };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

// ─── User search / discovery ─────────────────────────────────────────────────

export async function backendSearchUsers(
  query: string,
): Promise<MotokoUserProfile[]> {
  try {
    const a = await anonActor();
    return (await a.searchUsers(query)) as MotokoUserProfile[];
  } catch {
    return [];
  }
}

/**
 * Returns all registered users. Throws on failure so callers can show an error.
 */
export async function backendGetAllUsers(): Promise<MotokoUserProfile[]> {
  const a = await anonActor();
  return (await a.getAllUsers()) as MotokoUserProfile[];
}

export async function backendGetProfile(
  username: string,
): Promise<MotokoUserProfile | null> {
  try {
    const a = await anonActor();
    const result = (await a.getProfile(username)) as [] | [MotokoUserProfile];
    return result.length > 0 ? (result[0] as MotokoUserProfile) : null;
  } catch {
    return null;
  }
}

// ─── Profile update ──────────────────────────────────────────────────────────

export async function backendUpdateProfile(
  callerUsername: string,
  displayName: string,
  bio: string,
  identity?: Identity,
): Promise<{ ok: null } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.updateProfile(callerUsername, displayName, bio);
    if ("ok" in result) return { ok: null };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

// ─── Connection status types ─────────────────────────────────────────────────

export type UserConnectionStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends";

export type UserWithStatus = User & {
  connectionStatus: UserConnectionStatus;
  requestId?: string;
};

// ─── Connections ─────────────────────────────────────────────────────────────

export async function backendSendConnectionRequest(
  callerUsername: string,
  toUsername: string,
  identity?: Identity,
): Promise<{ ok: null } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.sendConnectionRequest(callerUsername, toUsername);
    if ("ok" in result) return { ok: null };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendRespondToRequest(
  callerUsername: string,
  requestId: string,
  accept: boolean,
  identity?: Identity,
): Promise<{ ok: null } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.respondToRequest(callerUsername, requestId, accept);
    if ("ok" in result) return { ok: null };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

/** Pending requests visible to this user (mutual — both sides sent one) */
export async function backendGetPendingRequests(
  callerUsername: string,
  identity?: Identity,
): Promise<ConnectionRequest[]> {
  try {
    const a = await actor(identity);
    const results: MotokoConnectionRequest[] =
      await a.getPendingRequests(callerUsername);
    return results.map((r: MotokoConnectionRequest) => moRequestToFrontend(r));
  } catch {
    return [];
  }
}

/** Fast count of pending requests for this user (any incoming, not just mutual) */
export async function backendGetPendingRequestCount(
  callerUsername: string,
  identity?: Identity,
): Promise<number> {
  try {
    const a = await actor(identity);
    return Number(await a.getPendingRequestCount(callerUsername));
  } catch {
    return 0;
  }
}

/** Outgoing requests sent BY this user (to show "Sent" badge) */
export async function backendGetSentRequests(
  callerUsername: string,
  identity?: Identity,
): Promise<ConnectionRequest[]> {
  try {
    const a = await actor(identity);
    const results: MotokoConnectionRequest[] =
      await a.getSentRequests(callerUsername);
    return results.map((r: MotokoConnectionRequest) => moRequestToFrontend(r));
  } catch {
    return [];
  }
}

export async function backendGetFriends(
  callerUsername: string,
  identity?: Identity,
): Promise<User[]> {
  try {
    const a = await actor(identity);
    const results: MotokoUserProfile[] = await a.getFriends(callerUsername);
    return results.map(moProfileToUser);
  } catch {
    return [];
  }
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export async function backendSendMessage(
  callerUsername: string,
  toUsername: string,
  content: string,
  identity?: Identity,
): Promise<{ ok: any } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.sendMessage(callerUsername, toUsername, content);
    if ("ok" in result) return { ok: result.ok };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
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
    const a = await actor(identity);
    const result = await a.sendSnap(
      callerUsername,
      toUsername,
      blobId,
      isEphemeral,
      saveToChat,
    );
    if ("ok" in result) return { ok: result.ok };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendGetMessages(
  callerUsername: string,
  withUsername: string,
  since: number,
  identity?: Identity,
): Promise<any[]> {
  try {
    const a = await actor(identity);
    return (await a.getMessages(
      callerUsername,
      withUsername,
      BigInt(since),
    )) as any[];
  } catch {
    return [];
  }
}

export async function backendMarkMessageRead(
  callerUsername: string,
  messageId: string,
  identity?: Identity,
): Promise<void> {
  try {
    const a = await actor(identity);
    await a.markMessageRead(callerUsername, messageId);
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
    const a = await actor(identity);
    await a.viewSnap(callerUsername, messageId);
  } catch {
    // ignore
  }
}

export async function backendGetUnreadCount(
  callerUsername: string,
  identity?: Identity,
): Promise<number> {
  try {
    const a = await actor(identity);
    return Number(await a.getUnreadCount(callerUsername));
  } catch {
    return 0;
  }
}

export async function backendGetConversations(
  callerUsername: string,
  identity?: Identity,
): Promise<any[]> {
  try {
    const a = await actor(identity);
    return (await a.getConversations(callerUsername)) as any[];
  } catch {
    return [];
  }
}

// ─── Stories ─────────────────────────────────────────────────────────────────

export async function backendPostStory(
  callerUsername: string,
  blobId: string,
  caption: string,
  identity?: Identity,
): Promise<{ ok: any } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.postStory(callerUsername, blobId, caption);
    if ("ok" in result) return { ok: result.ok };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendGetFriendStories(
  callerUsername: string,
  identity?: Identity,
): Promise<Story[]> {
  try {
    const a = await actor(identity);
    const results = await a.getFriendStories(callerUsername);
    return (results as any[]).map(moStoryToFrontend);
  } catch {
    return [];
  }
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export async function backendAddReaction(
  callerUsername: string,
  messageId: string,
  emoji: string,
  identity?: Identity,
): Promise<{ ok: any } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.addReaction(callerUsername, messageId, emoji);
    if ("ok" in result) return { ok: result.ok };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendGetReactions(
  messageId: string,
): Promise<Reaction[]> {
  try {
    const a = await anonActor();
    const results = await a.getReactions(messageId);
    return (results as any[]).map(moReactionToFrontend);
  } catch {
    return [];
  }
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function backendCreateGroup(
  callerUsername: string,
  groupName: string,
  memberUsernames: string[],
  identity?: Identity,
): Promise<{ ok: GroupInfo } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.createGroup(
      callerUsername,
      groupName,
      memberUsernames,
    );
    if ("ok" in result) return { ok: moGroupToFrontend(result.ok) };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendGetGroups(
  callerUsername: string,
  identity?: Identity,
): Promise<GroupInfo[]> {
  try {
    const a = await actor(identity);
    const results = await a.getGroups(callerUsername);
    return (results as any[]).map(moGroupToFrontend);
  } catch {
    return [];
  }
}

export async function backendSendGroupMessage(
  callerUsername: string,
  groupId: string,
  content: string,
  identity?: Identity,
): Promise<{ ok: GroupMessage } | { err: string }> {
  try {
    const a = await actor(identity);
    const result = await a.sendGroupMessage(callerUsername, groupId, content);
    if ("ok" in result) return { ok: moGroupMessageToFrontend(result.ok) };
    return { err: result.err };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendGetGroupMessages(
  callerUsername: string,
  groupId: string,
  since: number,
  identity?: Identity,
): Promise<GroupMessage[]> {
  try {
    const a = await actor(identity);
    const results = await a.getGroupMessages(
      callerUsername,
      groupId,
      BigInt(since),
    );
    return (results as any[]).map(moGroupMessageToFrontend);
  } catch {
    return [];
  }
}

// ─── Streaks ─────────────────────────────────────────────────────────────────

export async function backendGetStreak(
  user1: string,
  user2: string,
): Promise<number> {
  try {
    const a = await anonActor();
    return Number(await a.getStreak(user1, user2));
  } catch {
    return 0;
  }
}

// ─── Snap Score ──────────────────────────────────────────────────────────────

export async function backendGetSnapScore(
  username: string,
  identity?: Identity,
): Promise<number> {
  try {
    const a = await actor(identity);
    return Number(await a.getSnapScore(username));
  } catch {
    return 0;
  }
}

// ─── Blob storage helpers ─────────────────────────────────────────────────────

export async function backendUploadSnapMedia(
  blob: Blob,
  onProgress?: (percentage: number) => void,
): Promise<{ hash: string } | { err: string }> {
  try {
    const client = await getStorageClient();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { hash } = await client.putFile(bytes, onProgress);
    return { hash };
  } catch (e) {
    return { err: sanitizeError(e) };
  }
}

export async function backendGetSnapUrl(
  blobId: string,
): Promise<string | null> {
  if (!blobId) return null;
  try {
    const client = await getStorageClient();
    return await client.getDirectURL(blobId);
  } catch {
    return null;
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function backendClearAllData(): Promise<
  { ok: null } | { err: string }
> {
  try {
    const a = await anonActor();
    const result = await a.clearAllData();
    if ("ok" in result) return { ok: null };
    return { err: result.err ?? "Unknown error" };
  } catch (e) {
    return { err: sanitizeError(e) };
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
      const loginResult = await backendLogin(acc.username, acc.password);
      if ("ok" in loginResult) continue; // already exists
      await backendRegister(acc.username, acc.password, acc.displayName);
    } catch {
      // silently skip
    }
  }
}
