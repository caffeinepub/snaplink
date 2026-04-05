/* eslint-disable */
// @ts-nocheck

import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';
import type { Principal } from '@icp-sdk/core/principal';

export interface UserProfile {
  username: string;
  displayName: string;
  passwordHash: string;
  principalText: string;
  bio: string;
  createdAt: bigint;
}

export type ConnectionStatus =
  | { pending: null }
  | { accepted: null }
  | { declined: null };

export interface ConnectionRequest {
  id: string;
  fromUser: string;
  toUser: string;
  status: ConnectionStatus;
  createdAt: bigint;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: bigint;
  isRead: boolean;
  isSnap: boolean;
  snapBlobId: [] | [string];
  isEphemeral: boolean;
  snapViewed: boolean;
}

export interface ConversationEntry {
  username: string;
  displayName: string;
  lastMessageContent: string;
  lastMessageTimestamp: bigint;
  unreadCount: bigint;
}

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

export interface _SERVICE {
  // Auth
  register: ActorMethod<[string, string, string], { ok: UserProfile } | { err: string }>;
  login: ActorMethod<[string, string], { ok: UserProfile } | { err: string }>;
  loginWithII: ActorMethod<[], { ok: UserProfile } | { err: string }>;
  registerWithII: ActorMethod<[string, string], { ok: UserProfile } | { err: string }>;
  getProfile: ActorMethod<[string], [] | [UserProfile]>;
  updateProfile: ActorMethod<[string, string, string], { ok: null } | { err: string }>;
  searchUsers: ActorMethod<[string], UserProfile[]>;
  getAllUsers: ActorMethod<[], UserProfile[]>;
  // Connections
  sendConnectionRequest: ActorMethod<[string, string], { ok: null } | { err: string }>;
  respondToRequest: ActorMethod<[string, string, boolean], { ok: null } | { err: string }>;
  getPendingRequests: ActorMethod<[string], ConnectionRequest[]>;
  getSentRequests: ActorMethod<[string], ConnectionRequest[]>;
  getFriends: ActorMethod<[string], UserProfile[]>;
  // Messaging
  sendMessage: ActorMethod<[string, string, string], { ok: Message } | { err: string }>;
  sendSnap: ActorMethod<[string, string, string, boolean, boolean], { ok: Message } | { err: string }>;
  getMessages: ActorMethod<[string, string, bigint], Message[]>;
  markMessageRead: ActorMethod<[string, string], { ok: null } | { err: string }>;
  viewSnap: ActorMethod<[string, string], { ok: null } | { err: string }>;
  getUnreadCount: ActorMethod<[string], bigint>;
  getPendingRequestCount: ActorMethod<[string], bigint>;
  getConversations: ActorMethod<[string], ConversationEntry[]>;
  // Stories
  postStory: ActorMethod<[string, string, string], { ok: null } | { err: string }>;
  getFriendStories: ActorMethod<[string], Story[]>;
  // Reactions
  addReaction: ActorMethod<[string, string, string], { ok: null } | { err: string }>;
  getReactions: ActorMethod<[string], Reaction[]>;
  // Groups
  createGroup: ActorMethod<[string, string, string[]], { ok: GroupInfo } | { err: string }>;
  getGroups: ActorMethod<[string], GroupInfo[]>;
  sendGroupMessage: ActorMethod<[string, string, string], { ok: GroupMessage } | { err: string }>;
  getGroupMessages: ActorMethod<[string, string, bigint], GroupMessage[]>;
  // Streaks
  getStreak: ActorMethod<[string, string], bigint>;
  // Snap Score
  getSnapScore: ActorMethod<[string], bigint>;
  // Ghost Mode
  setGhostMode: ActorMethod<[string, boolean], { ok: null } | { err: string }>;
  isGhostMode: ActorMethod<[string], boolean>;
  // Read Receipts
  setReadReceiptsEnabled: ActorMethod<[string, boolean], { ok: null } | { err: string }>;
  getReadReceiptsEnabled: ActorMethod<[string], boolean>;
  // Daily Login
  recordDailyLogin: ActorMethod<[string], bigint>;
  // Admin
  clearAllData: ActorMethod<[], { ok: null }>;
}

export declare const idlService: IDL.ServiceClass;
export declare const idlInitArgs: IDL.Type[];
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
