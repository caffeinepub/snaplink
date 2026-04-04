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

export interface Story {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  blobId: string;
  caption: string;
  timestamp: bigint;
  expiresAt: bigint;
}

export interface Reaction {
  username: string;
  emoji: string;
  timestamp: bigint;
}

export interface GroupInfo {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  createdAt: bigint;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderUsername: string;
  content: string;
  timestamp: bigint;
  isSnap: boolean;
  snapBlobId: [] | [string];
}

export interface backendInterface {
  // ── Auth ────────────────────────────────────────────────────────────────────────────
  register(username: string, password: string, displayName: string): Promise<{ ok: UserProfile } | { err: string }>;
  login(username: string, password: string): Promise<{ ok: UserProfile } | { err: string }>;
  loginWithII(): Promise<{ ok: UserProfile } | { err: string }>;
  registerWithII(username: string, displayName: string): Promise<{ ok: UserProfile } | { err: string }>;
  getProfile(username: string): Promise<[] | [UserProfile]>;
  /** callerUsername, displayName, bio */
  updateProfile(callerUsername: string, displayName: string, bio: string): Promise<{ ok: null } | { err: string }>;
  searchUsers(q: string): Promise<UserProfile[]>;
  getAllUsers(): Promise<UserProfile[]>;

  // ── Connections ─────────────────────────────────────────────────────────────────
  /** callerUsername, toUsername */
  sendConnectionRequest(callerUsername: string, toUsername: string): Promise<{ ok: null } | { err: string }>;
  /** callerUsername, requestId, accept */
  respondToRequest(callerUsername: string, requestId: string, accept: boolean): Promise<{ ok: null } | { err: string }>;
  getPendingRequests(callerUsername: string): Promise<ConnectionRequest[]>;
  getSentRequests(callerUsername: string): Promise<ConnectionRequest[]>;
  getFriends(callerUsername: string): Promise<UserProfile[]>;

  // ── Messaging ──────────────────────────────────────────────────────────────────
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

  // ── Stories ────────────────────────────────────────────────────────────────────
  /** callerUsername, blobId, caption */
  postStory(callerUsername: string, blobId: string, caption: string): Promise<{ ok: null } | { err: string }>;
  /** callerUsername — returns non-expired stories from friends + self */
  getFriendStories(callerUsername: string): Promise<Story[]>;

  // ── Reactions ──────────────────────────────────────────────────────────────────
  /** callerUsername, messageId, emoji */
  addReaction(callerUsername: string, messageId: string, emoji: string): Promise<{ ok: null } | { err: string }>;
  getReactions(messageId: string): Promise<Reaction[]>;

  // ── Group Chats ────────────────────────────────────────────────────────────────
  /** callerUsername, groupName, memberUsernames */
  createGroup(callerUsername: string, groupName: string, memberUsernames: string[]): Promise<{ ok: GroupInfo } | { err: string }>;
  getGroups(callerUsername: string): Promise<GroupInfo[]>;
  /** callerUsername, groupId, content */
  sendGroupMessage(callerUsername: string, groupId: string, content: string): Promise<{ ok: GroupMessage } | { err: string }>;
  /** callerUsername, groupId, since */
  getGroupMessages(callerUsername: string, groupId: string, since: bigint): Promise<GroupMessage[]>;

  // ── Streaks ─────────────────────────────────────────────────────────────────────
  getStreak(user1: string, user2: string): Promise<bigint>;

  // ── Snap Score ─────────────────────────────────────────────────────────────────
  getSnapScore(username: string): Promise<bigint>;

  // ── Admin ────────────────────────────────────────────────────────────────────────────
  /** Wipe ALL data from the canister (users, connections, messages). Irreversible. */
  clearAllData(): Promise<{ ok: null }>;
}
