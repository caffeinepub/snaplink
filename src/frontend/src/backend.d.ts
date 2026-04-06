import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Reaction {
    username: string;
    emoji: string;
    timestamp: bigint;
}
export interface LeaderboardEntry {
    username: string;
    displayName: string;
    rank: bigint;
    snapScore: bigint;
}
export interface GroupMessage {
    id: string;
    content: string;
    senderUsername: string;
    isSnap: boolean;
    groupId: string;
    timestamp: bigint;
    snapBlobId?: string;
}
export interface Story {
    id: string;
    authorUsername: string;
    expiresAt: bigint;
    timestamp: bigint;
    caption: string;
    blobId: string;
    authorDisplayName: string;
}
export interface Badge {
    id: string;
    name: string;
    unlocked: boolean;
    description: string;
}
export interface CapsuleMessage {
    id: string;
    unlockAt: bigint;
    receiverId: string;
    timestamp: bigint;
    blobId: string;
    isUnlocked: boolean;
    senderId: string;
}
export interface GroupInfo {
    id: string;
    members: Array<string>;
    name: string;
    createdAt: bigint;
    createdBy: string;
}
export interface ConnectionRequest {
    id: string;
    status: ConnectionStatus;
    createdAt: bigint;
    toUser: string;
    fromUser: string;
}
export interface Message {
    id: string;
    content: string;
    isRead: boolean;
    isSnap: boolean;
    isEphemeral: boolean;
    receiverId: string;
    timestamp: bigint;
    snapBlobId?: string;
    senderId: string;
    snapViewed: boolean;
}
export interface UserProfile {
    bio: string;
    username: string;
    displayName: string;
    createdAt: bigint;
    principalText: string;
    passwordHash: string;
}
export enum ConnectionStatus {
    pending = "pending",
    accepted = "accepted",
    declined = "declined"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_ok {
    ok = "ok"
}
export interface backendInterface {
    addReaction(callerUsername: string, messageId: string, emoji: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearAllData(): Promise<Variant_ok>;
    createGroup(callerUsername: string, groupName: string, memberUsernames: Array<string>): Promise<{
        __kind__: "ok";
        ok: GroupInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteStory(callerUsername: string, storyId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAchievements(callerUsername: string): Promise<Array<Badge>>;
    getAllUsers(): Promise<Array<UserProfile>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCapsuleMessages(callerUsername: string, withUsername: string): Promise<Array<CapsuleMessage>>;
    getCapsuleStatus(callerUsername: string, messageId: string): Promise<CapsuleMessage | null>;
    getConversations(callerUsername: string): Promise<Array<{
        lastMessageContent: string;
        lastMessageTimestamp: bigint;
        username: string;
        displayName: string;
        unreadCount: bigint;
    }>>;
    getFriendStories(callerUsername: string): Promise<Array<Story>>;
    getFriends(callerUsername: string): Promise<Array<UserProfile>>;
    getGroupMessages(callerUsername: string, groupId: string, since: bigint): Promise<Array<GroupMessage>>;
    getGroups(callerUsername: string): Promise<Array<GroupInfo>>;
    getLeaderboard(callerUsername: string): Promise<Array<LeaderboardEntry>>;
    getMessages(callerUsername: string, withUsername: string, since: bigint): Promise<Array<Message>>;
    getPendingRequestCount(callerUsername: string): Promise<bigint>;
    getPendingRequests(callerUsername: string): Promise<Array<ConnectionRequest>>;
    getProfile(username: string): Promise<UserProfile | null>;
    getReactions(messageId: string): Promise<Array<Reaction>>;
    getReadReceiptsEnabled(username: string): Promise<boolean>;
    getSentRequests(callerUsername: string): Promise<Array<ConnectionRequest>>;
    getSnapScore(username: string): Promise<bigint>;
    getStreak(user1: string, user2: string): Promise<bigint>;
    getUnreadCount(callerUsername: string): Promise<bigint>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    isGhostMode(username: string): Promise<boolean>;
    login(username: string, password: string): Promise<{
        __kind__: "ok";
        ok: UserProfile;
    } | {
        __kind__: "err";
        err: string;
    }>;
    loginWithII(): Promise<{
        __kind__: "ok";
        ok: UserProfile;
    } | {
        __kind__: "err";
        err: string;
    }>;
    markMessageRead(callerUsername: string, messageId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    postStory(callerUsername: string, blobId: string, caption: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    recordDailyLogin(callerUsername: string): Promise<bigint>;
    register(username: string, password: string, displayName: string): Promise<{
        __kind__: "ok";
        ok: UserProfile;
    } | {
        __kind__: "err";
        err: string;
    }>;
    registerWithII(username: string, displayName: string): Promise<{
        __kind__: "ok";
        ok: UserProfile;
    } | {
        __kind__: "err";
        err: string;
    }>;
    respondToRequest(callerUsername: string, requestId: string, accept: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    searchUsers(q: string): Promise<Array<UserProfile>>;
    sendCapsuleSnap(callerUsername: string, toUsername: string, blobId: string, unlockAt: bigint): Promise<{
        __kind__: "ok";
        ok: CapsuleMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    sendConnectionRequest(callerUsername: string, toUsername: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    sendGroupMessage(callerUsername: string, groupId: string, content: string): Promise<{
        __kind__: "ok";
        ok: GroupMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    sendMessage(callerUsername: string, toUsername: string, content: string): Promise<{
        __kind__: "ok";
        ok: Message;
    } | {
        __kind__: "err";
        err: string;
    }>;
    sendSnap(callerUsername: string, toUsername: string, blobId: string, isEphemeral: boolean, saveToChat: boolean): Promise<{
        __kind__: "ok";
        ok: Message;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setGhostMode(callerUsername: string, enabled: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setReadReceiptsEnabled(callerUsername: string, enabled: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateProfile(callerUsername: string, displayName: string, bio: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    viewSnap(callerUsername: string, messageId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
