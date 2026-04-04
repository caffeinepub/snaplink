// App-wide types for SnapLink
export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  createdAt: number;
  passwordHash: string;
  useII: boolean;
}

export interface ConnectionRequest {
  id: string;
  fromUser: string;
  fromDisplayName: string;
  fromAvatarUrl?: string;
  toUser: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  isRead: boolean;
  isSnap: boolean;
  snapDataUrl?: string;
  isEphemeral: boolean;
  snapViewed: boolean;
  savedToChat?: boolean;
  isVideo?: boolean;
}

export interface ConversationSummary {
  username: string;
  displayName: string;
  lastMessageContent: string;
  lastMessageTimestamp: number;
  unreadCount: number;
}

export type Tab = "chats" | "requests" | "camera" | "profile";
