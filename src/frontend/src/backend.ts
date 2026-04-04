/* eslint-disable */
// backend.ts — typed actor wrapper for SnapLink's ICP canister.
// All authenticated methods take callerUsername as the first argument
// so both username/password and Internet Identity users work correctly.

import {
  Actor,
  HttpAgent,
  type HttpAgentOptions,
  type ActorConfig,
  type Agent,
  type ActorSubclass,
} from "@icp-sdk/core/agent";
import { idlFactory, type _SERVICE } from "./declarations/backend.did";
export type {
  UserProfile,
  ConnectionRequest,
  Message,
  ConversationEntry,
} from "./declarations/backend.did";

// ─── Option helpers (kept for compatibility) ──────────────────────────────────

export interface Some<T> { __kind__: "Some"; value: T; }
export interface None    { __kind__: "None"; }
export type Option<T> = Some<T> | None;

// ─── ExternalBlob stub (required by config.ts for blob storage compatibility) ─

export class ExternalBlob {
  constructor(
    private data: Uint8Array,
    public onProgress?: (p: number) => void,
  ) {}

  async getBytes(): Promise<Uint8Array> {
    return this.data;
  }

  static fromURL(_url: string): ExternalBlob {
    return new ExternalBlob(new Uint8Array());
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface backendInterface {
  _initializeAccessControlWithSecret(secret: string): Promise<void>;
  // Auth
  register(username: string, password: string, displayName: string): Promise<{ ok: any } | { err: string }>;
  login(username: string, password: string): Promise<{ ok: any } | { err: string }>;
  loginWithII(): Promise<{ ok: any } | { err: string }>;
  registerWithII(username: string, displayName: string): Promise<{ ok: any } | { err: string }>;
  getProfile(username: string): Promise<any[]>;
  updateProfile(callerUsername: string, displayName: string, bio: string): Promise<{ ok: null } | { err: string }>;
  searchUsers(q: string): Promise<any[]>;
  getAllUsers(): Promise<any[]>;
  // Connections
  sendConnectionRequest(callerUsername: string, toUsername: string): Promise<{ ok: null } | { err: string }>;
  respondToRequest(callerUsername: string, requestId: string, accept: boolean): Promise<{ ok: null } | { err: string }>;
  getPendingRequests(callerUsername: string): Promise<any[]>;
  getSentRequests(callerUsername: string): Promise<any[]>;
  getFriends(callerUsername: string): Promise<any[]>;
  // Messaging
  sendMessage(callerUsername: string, toUsername: string, content: string): Promise<{ ok: any } | { err: string }>;
  sendSnap(callerUsername: string, toUsername: string, blobId: string, isEphemeral: boolean, saveToChat: boolean): Promise<{ ok: any } | { err: string }>;
  getMessages(callerUsername: string, withUsername: string, since: bigint): Promise<any[]>;
  markMessageRead(callerUsername: string, messageId: string): Promise<{ ok: null } | { err: string }>;
  viewSnap(callerUsername: string, messageId: string): Promise<{ ok: null } | { err: string }>;
  getUnreadCount(callerUsername: string): Promise<bigint>;
  getPendingRequestCount(callerUsername: string): Promise<bigint>;
  getConversations(callerUsername: string): Promise<any[]>;
  // Stories
  postStory(callerUsername: string, blobId: string, caption: string): Promise<{ ok: any } | { err: string }>;
  getFriendStories(callerUsername: string): Promise<any[]>;
  // Reactions
  addReaction(callerUsername: string, messageId: string, emoji: string): Promise<{ ok: any } | { err: string }>;
  getReactions(messageId: string): Promise<any[]>;
  // Groups
  createGroup(callerUsername: string, groupName: string, memberUsernames: string[]): Promise<{ ok: any } | { err: string }>;
  getGroups(callerUsername: string): Promise<any[]>;
  sendGroupMessage(callerUsername: string, groupId: string, content: string): Promise<{ ok: any } | { err: string }>;
  getGroupMessages(callerUsername: string, groupId: string, since: bigint): Promise<any[]>;
  // Streaks
  getStreak(user1: string, user2: string): Promise<bigint>;
  // Snap Score
  getSnapScore(username: string): Promise<bigint>;
  // Admin
  clearAllData(): Promise<{ ok: null }>;
}

// ─── Concrete class ───────────────────────────────────────────────────────────

export class Backend implements backendInterface {
  constructor(
    private actor: ActorSubclass<_SERVICE>,
    private processError?: (error: unknown) => never,
  ) {}

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (this.processError) this.processError(e);
      throw e;
    }
  }

  // No-op: access control not used in this app
  async _initializeAccessControlWithSecret(_secret: string): Promise<void> {}

  // ── Auth ────────────────────────────────────────────────────────────────────

  register(username: string, password: string, displayName: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).register(username, password, displayName));
  }
  login(username: string, password: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).login(username, password));
  }
  loginWithII(): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).loginWithII());
  }
  registerWithII(username: string, displayName: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).registerWithII(username, displayName));
  }
  getProfile(username: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getProfile(username));
  }
  updateProfile(callerUsername: string, displayName: string, bio: string): Promise<{ ok: null } | { err: string }> {
    return this.call(() => (this.actor as any).updateProfile(callerUsername, displayName, bio));
  }
  searchUsers(q: string): Promise<any[]> {
    return this.call(() => (this.actor as any).searchUsers(q));
  }
  getAllUsers(): Promise<any[]> {
    return this.call(() => (this.actor as any).getAllUsers());
  }

  // ── Connections ─────────────────────────────────────────────────────────────

  sendConnectionRequest(callerUsername: string, toUsername: string): Promise<{ ok: null } | { err: string }> {
    return this.call(() => (this.actor as any).sendConnectionRequest(callerUsername, toUsername));
  }
  respondToRequest(callerUsername: string, requestId: string, accept: boolean): Promise<{ ok: null } | { err: string }> {
    return this.call(() => (this.actor as any).respondToRequest(callerUsername, requestId, accept));
  }
  getPendingRequests(callerUsername: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getPendingRequests(callerUsername));
  }
  getSentRequests(callerUsername: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getSentRequests(callerUsername));
  }
  getFriends(callerUsername: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getFriends(callerUsername));
  }

  // ── Messaging ───────────────────────────────────────────────────────────────

  sendMessage(callerUsername: string, toUsername: string, content: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).sendMessage(callerUsername, toUsername, content));
  }
  sendSnap(callerUsername: string, toUsername: string, blobId: string, isEphemeral: boolean, saveToChat: boolean): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).sendSnap(callerUsername, toUsername, blobId, isEphemeral, saveToChat));
  }
  getMessages(callerUsername: string, withUsername: string, since: bigint): Promise<any[]> {
    return this.call(() => (this.actor as any).getMessages(callerUsername, withUsername, since));
  }
  markMessageRead(callerUsername: string, messageId: string): Promise<{ ok: null } | { err: string }> {
    return this.call(() => (this.actor as any).markMessageRead(callerUsername, messageId));
  }
  viewSnap(callerUsername: string, messageId: string): Promise<{ ok: null } | { err: string }> {
    return this.call(() => (this.actor as any).viewSnap(callerUsername, messageId));
  }
  getUnreadCount(callerUsername: string): Promise<bigint> {
    return this.call(() => (this.actor as any).getUnreadCount(callerUsername));
  }
  getPendingRequestCount(callerUsername: string): Promise<bigint> {
    return this.call(() => (this.actor as any).getPendingRequestCount(callerUsername));
  }
  getConversations(callerUsername: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getConversations(callerUsername));
  }

  // ── Stories ─────────────────────────────────────────────────────────────────

  postStory(callerUsername: string, blobId: string, caption: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).postStory(callerUsername, blobId, caption));
  }
  getFriendStories(callerUsername: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getFriendStories(callerUsername));
  }

  // ── Reactions ───────────────────────────────────────────────────────────────

  addReaction(callerUsername: string, messageId: string, emoji: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).addReaction(callerUsername, messageId, emoji));
  }
  getReactions(messageId: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getReactions(messageId));
  }

  // ── Groups ──────────────────────────────────────────────────────────────────

  createGroup(callerUsername: string, groupName: string, memberUsernames: string[]): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).createGroup(callerUsername, groupName, memberUsernames));
  }
  getGroups(callerUsername: string): Promise<any[]> {
    return this.call(() => (this.actor as any).getGroups(callerUsername));
  }
  sendGroupMessage(callerUsername: string, groupId: string, content: string): Promise<{ ok: any } | { err: string }> {
    return this.call(() => (this.actor as any).sendGroupMessage(callerUsername, groupId, content));
  }
  getGroupMessages(callerUsername: string, groupId: string, since: bigint): Promise<any[]> {
    return this.call(() => (this.actor as any).getGroupMessages(callerUsername, groupId, since));
  }

  // ── Streaks ─────────────────────────────────────────────────────────────────

  getStreak(user1: string, user2: string): Promise<bigint> {
    return this.call(() => (this.actor as any).getStreak(user1, user2));
  }

  // ── Snap Score ──────────────────────────────────────────────────────────────

  getSnapScore(username: string): Promise<bigint> {
    return this.call(() => (this.actor as any).getSnapScore(username));
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  clearAllData(): Promise<{ ok: null }> {
    return this.call(() => (this.actor as any).clearAllData());
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export interface CreateActorOptions {
  agent?: Agent;
  agentOptions?: HttpAgentOptions;
  actorOptions?: ActorConfig;
  processError?: (error: unknown) => never;
}

export function createActor(
  canisterId: string,
  uploadFileOrOptions?: ((blob: ExternalBlob) => Promise<Uint8Array>) | CreateActorOptions,
  downloadFile?: (bytes: Uint8Array) => Promise<ExternalBlob>,
  options: CreateActorOptions = {},
): Backend {
  // If the second arg is a plain options object (not a function), treat it as options
  const resolvedOptions: CreateActorOptions =
    typeof uploadFileOrOptions === "object" &&
    uploadFileOrOptions !== null &&
    !("getBytes" in uploadFileOrOptions)
      ? (uploadFileOrOptions as CreateActorOptions)
      : options;

  const agent =
    resolvedOptions.agent ||
    HttpAgent.createSync({ ...resolvedOptions.agentOptions });

  if (resolvedOptions.agent && resolvedOptions.agentOptions) {
    console.warn(
      "Detected both agent and agentOptions passed to createActor. Ignoring agentOptions.",
    );
  }

  const actor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId,
    ...resolvedOptions.actorOptions,
  });

  return new Backend(actor, resolvedOptions.processError);
}
