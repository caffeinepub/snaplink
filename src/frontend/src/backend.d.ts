import type { Principal } from "@icp-sdk/core/principal";
import type { UserProfile, ConnectionRequest, Message, ConversationEntry } from "./declarations/backend.did";

export type { UserProfile, ConnectionRequest, Message, ConversationEntry };

export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;

export interface backendInterface {
    _initializeAccessControlWithSecret(secret: string): Promise<void>;
    register(username: string, password: string, displayName: string): Promise<{ ok: UserProfile } | { err: string }>;
    login(username: string, password: string): Promise<{ ok: UserProfile } | { err: string }>;
    loginWithII(): Promise<{ ok: UserProfile } | { err: string }>;
    registerWithII(username: string, displayName: string): Promise<{ ok: UserProfile } | { err: string }>;
    getProfile(username: string): Promise<[] | [UserProfile]>;
    updateProfile(displayName: string, bio: string): Promise<{ ok: null } | { err: string }>;
    searchUsers(q: string): Promise<UserProfile[]>;
    getAllUsers(): Promise<UserProfile[]>;
    sendConnectionRequest(toUsername: string): Promise<{ ok: null } | { err: string }>;
    respondToRequest(requestId: string, accept: boolean): Promise<{ ok: null } | { err: string }>;
    getPendingRequests(): Promise<ConnectionRequest[]>;
    getFriends(): Promise<UserProfile[]>;
    sendMessage(toUsername: string, content: string): Promise<{ ok: Message } | { err: string }>;
    sendSnap(toUsername: string, blobId: string, isEphemeral: boolean, saveToChat: boolean): Promise<{ ok: Message } | { err: string }>;
    getMessages(withUsername: string, since: bigint): Promise<Message[]>;
    markMessageRead(messageId: string): Promise<{ ok: null } | { err: string }>;
    viewSnap(messageId: string): Promise<{ ok: null } | { err: string }>;
    getUnreadCount(): Promise<bigint>;
    getPendingRequestCount(): Promise<bigint>;
    getConversations(): Promise<ConversationEntry[]>;
}
