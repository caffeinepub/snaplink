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

// Exact mapping of every public method in main.mo
export interface _SERVICE {
  // Auth
  register: ActorMethod<[string, string, string], { ok: UserProfile } | { err: string }>;
  login: ActorMethod<[string, string], { ok: UserProfile } | { err: string }>;
  loginWithII: ActorMethod<[], { ok: UserProfile } | { err: string }>;
  registerWithII: ActorMethod<[string, string], { ok: UserProfile } | { err: string }>;
  getProfile: ActorMethod<[string], [] | [UserProfile]>;
  // callerUsername, displayName, bio
  updateProfile: ActorMethod<[string, string, string], { ok: null } | { err: string }>;
  searchUsers: ActorMethod<[string], UserProfile[]>;
  getAllUsers: ActorMethod<[], UserProfile[]>;
  // Connections — callerUsername is always first
  sendConnectionRequest: ActorMethod<[string, string], { ok: null } | { err: string }>;
  respondToRequest: ActorMethod<[string, string, boolean], { ok: null } | { err: string }>;
  getPendingRequests: ActorMethod<[string], ConnectionRequest[]>;
  getSentRequests: ActorMethod<[string], ConnectionRequest[]>;
  getFriends: ActorMethod<[string], UserProfile[]>;
  // Messaging — callerUsername is always first
  sendMessage: ActorMethod<[string, string, string], { ok: Message } | { err: string }>;
  sendSnap: ActorMethod<[string, string, string, boolean, boolean], { ok: Message } | { err: string }>;
  getMessages: ActorMethod<[string, string, bigint], Message[]>;
  markMessageRead: ActorMethod<[string, string], { ok: null } | { err: string }>;
  viewSnap: ActorMethod<[string, string], { ok: null } | { err: string }>;
  getUnreadCount: ActorMethod<[string], bigint>;
  getPendingRequestCount: ActorMethod<[string], bigint>;
  getConversations: ActorMethod<[string], ConversationEntry[]>;
}

export declare const idlService: IDL.ServiceClass;
export declare const idlInitArgs: IDL.Type[];
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
