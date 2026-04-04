// backend.d.ts — public interface for SnapLink's ICP canister
// Matches main.mo exactly. callerUsername is the first param on all
// authenticated calls so both username/password and II users work.

import type { Principal } from "@icp-sdk/core/principal";
import type {
  UserProfile,
  ConnectionRequest,
  Message,
  ConversationEntry,
} from "./declarations/backend.did";

export type { UserProfile, ConnectionRequest, Message, ConversationEntry };

export interface backendInterface {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register(username: string, password: string, displayName: string): Promise<{ ok: UserProfile } | { err: string }>;
  login(username: string, password: string): Promise<{ ok: UserProfile } | { err: string }>;
  loginWithII(): Promise<{ ok: UserProfile } | { err: string }>;
  registerWithII(username: string, displayName: string): Promise<{ ok: UserProfile } | { err: string }>;
  getProfile(username: string): Promise<[] | [UserProfile]>;
  /** callerUsername, displayName, bio */
  updateProfile(callerUsername: string, displayName: string, bio: string): Promise<{ ok: null } | { err: string }>;
  searchUsers(q: string): Promise<UserProfile[]>;
  getAllUsers(): Promise<UserProfile[]>;

  // ── Connections ───────────────────────────────────────────────────────────
  /** callerUsername, toUsername */
  sendConnectionRequest(callerUsername: string, toUsername: string): Promise<{ ok: null } | { err: string }>;
  /** callerUsername, requestId, accept */
  respondToRequest(callerUsername: string, requestId: string, accept: boolean): Promise<{ ok: null } | { err: string }>;
  getPendingRequests(callerUsername: string): Promise<ConnectionRequest[]>;
  getSentRequests(callerUsername: string): Promise<ConnectionRequest[]>;
  getFriends(callerUsername: string): Promise<UserProfile[]>;

  // ── Messaging ─────────────────────────────────────────────────────────────
  /** callerUsername, toUsername, content */
  sendMessage(callerUsername: string, toUsername: string, content: string): Promise<{ ok: Message } | { err: string }>;
  /** callerUsername, toUsername, blobId, isEphemeral, saveToChat */
  sendSnap(callerUsername: string, toUsername: string, blobId: string, isEphemeral: boolean, saveToChat: boolean): Promise<{ ok: Message } | { err: string }>;
  /** callerUsername, withUsername, since */
  getMessages(callerUsername: string, withUsername: string, since: bigint): Promise<Message[]>;
  /** callerUsername, messageId */
  markMessageRead(callerUsername: string, messageId: string): Promise<{ ok: null } | { err: string }>;
  /** callerUsername, messageId */
  viewSnap(callerUsername: string, messageId: string): Promise<{ ok: null } | { err: string }>;
  getUnreadCount(callerUsername: string): Promise<bigint>;
  getPendingRequestCount(callerUsername: string): Promise<bigint>;
  getConversations(callerUsername: string): Promise<ConversationEntry[]>;

  // ── Admin ─────────────────────────────────────────────────────────────────
  /** Wipe ALL data from the canister (users, connections, messages). Irreversible. */
  clearAllData(): Promise<{ ok: null }>;
}
