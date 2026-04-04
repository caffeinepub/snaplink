import type {
  ConnectionRequest,
  ConversationSummary,
  Message,
  User,
} from "./types";

// Simple hash for demo (not cryptographically secure)
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const REQUESTS_KEY = "snaplink_requests";
const MESSAGES_KEY = "snaplink_messages";
const SESSION_KEY = "snaplink_session";
const PROFILE_CACHE_KEY = "snaplink_profile_cache";

export function getRequests(): ConnectionRequest[] {
  try {
    return JSON.parse(localStorage.getItem(REQUESTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRequests(requests: ConnectionRequest[]): void {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

export function getMessages(): Message[] {
  try {
    return JSON.parse(localStorage.getItem(MESSAGES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveMessages(messages: Message[]): void {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

// ─── Profile cache (avatarUrl + local overrides) ─────────────────────────────

export function getUserProfileCache(): Record<string, Partial<User>> {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setUserProfileCache(
  username: string,
  data: Partial<User>,
): void {
  const cache = getUserProfileCache();
  cache[username] = { ...cache[username], ...data };
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
}

export function mergeWithCache(user: User): User {
  const cache = getUserProfileCache();
  const cached = cache[user.username];
  if (!cached) return user;
  return { ...user, ...cached };
}

// ─── Session ─────────────────────────────────────────────────────────────────

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as {
      userId: string;
      expiry: number;
      user?: User;
    };
    if (Date.now() > session.expiry) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Use stored user object (for backend-authed users)
    if (session.user) {
      return mergeWithCache(session.user);
    }
    return null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  const session = {
    userId: user.id,
    user,
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ─── Connection requests (local cache for messages & friends) ────────────────

export function sendConnectionRequest(
  fromUser: User,
  toUsername: string,
): { ok: null } | { err: string } {
  const requests = getRequests();
  const existing = requests.find(
    (r) =>
      r.fromUser === fromUser.username &&
      r.toUser === toUsername &&
      r.status === "pending",
  );
  if (existing) return { err: "Request already sent" };
  const alreadyFriends = requests.find(
    (r) =>
      ((r.fromUser === fromUser.username && r.toUser === toUsername) ||
        (r.fromUser === toUsername && r.toUser === fromUser.username)) &&
      r.status === "accepted",
  );
  if (alreadyFriends) return { err: "Already connected" };
  requests.push({
    id: crypto.randomUUID(),
    fromUser: fromUser.username,
    fromDisplayName: fromUser.displayName,
    fromAvatarUrl: fromUser.avatarUrl,
    toUser: toUsername,
    status: "pending",
    createdAt: Date.now(),
  });
  saveRequests(requests);
  return { ok: null };
}

export function respondToRequest(requestId: string, accept: boolean): void {
  const requests = getRequests();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx !== -1) {
    requests[idx].status = accept ? "accepted" : "declined";
    saveRequests(requests);
  }
}

export function getPendingRequests(username: string): ConnectionRequest[] {
  const requests = getRequests();
  return requests.filter(
    (r) => r.toUser === username && r.status === "pending",
  );
}

export function getFriends(username: string): User[] {
  const requests = getRequests();
  // Build friend list from accepted connection requests
  // Returns partial User objects with just username & displayName from request data
  const friendUsernames = requests
    .filter(
      (r) =>
        (r.fromUser === username || r.toUser === username) &&
        r.status === "accepted",
    )
    .map((r) => (r.fromUser === username ? r.toUser : r.fromUser));

  return friendUsernames.map((uname) => {
    // Find display name from requests
    const req = requests.find(
      (r) =>
        (r.fromUser === uname || r.toUser === uname) && r.status === "accepted",
    );
    const displayName =
      req?.fromUser === uname
        ? req.fromDisplayName
        : req?.fromUser === username
          ? req.toUser
          : uname;
    return {
      id: uname,
      username: uname,
      displayName: displayName || uname,
      bio: "",
      avatarUrl: undefined,
      createdAt: 0,
      passwordHash: "",
      useII: false,
    } as User;
  });
}

export function sendMessage(
  from: User,
  toUsername: string,
  content: string,
): Message {
  const messages = getMessages();
  const msg: Message = {
    id: crypto.randomUUID(),
    senderId: from.username,
    receiverId: toUsername,
    content,
    timestamp: Date.now(),
    isRead: false,
    isSnap: false,
    isEphemeral: false,
    snapViewed: false,
  };
  messages.push(msg);
  saveMessages(messages);
  return msg;
}

export function sendSnap(
  from: User,
  toUsername: string,
  snapDataUrl: string,
  isEphemeral: boolean,
  savedToChat: boolean,
  caption?: string,
  isVideo?: boolean,
): Message {
  const messages = getMessages();
  let content: string;
  if (caption?.trim()) {
    content = caption.trim();
  } else if (isVideo) {
    content = "🎥 Sent a video snap";
  } else if (isEphemeral) {
    content = "📸 Sent a snap";
  } else {
    content = "📷 Sent a photo";
  }
  const msg: Message = {
    id: crypto.randomUUID(),
    senderId: from.username,
    receiverId: toUsername,
    content,
    timestamp: Date.now(),
    isRead: false,
    isSnap: true,
    snapDataUrl,
    isEphemeral,
    snapViewed: false,
    savedToChat,
    isVideo: isVideo ?? false,
  };
  messages.push(msg);
  saveMessages(messages);
  return msg;
}

export function getConversationMessages(
  username: string,
  withUsername: string,
): Message[] {
  const messages = getMessages();
  return messages
    .filter(
      (m) =>
        (m.senderId === username && m.receiverId === withUsername) ||
        (m.senderId === withUsername && m.receiverId === username),
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function markMessagesRead(username: string, fromUsername: string): void {
  const messages = getMessages();
  let changed = false;
  for (const msg of messages) {
    if (
      msg.senderId === fromUsername &&
      msg.receiverId === username &&
      !msg.isRead
    ) {
      msg.isRead = true;
      changed = true;
    }
  }
  if (changed) saveMessages(messages);
}

export function viewSnap(messageId: string): void {
  const messages = getMessages();
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx !== -1) {
    messages[idx].snapViewed = true;
    if (messages[idx].isEphemeral) {
      messages[idx].snapDataUrl = undefined;
    }
    saveMessages(messages);
  }
}

export function getConversations(username: string): ConversationSummary[] {
  const messages = getMessages();
  const friends = getFriends(username);
  const summaryMap = new Map<string, ConversationSummary>();

  for (const friend of friends) {
    summaryMap.set(friend.username, {
      username: friend.username,
      displayName: friend.displayName,
      lastMessageContent: "Say hi!",
      lastMessageTimestamp: 0,
      unreadCount: 0,
    });
  }

  for (const msg of messages) {
    if (msg.senderId !== username && msg.receiverId !== username) continue;
    const otherUser = msg.senderId === username ? msg.receiverId : msg.senderId;
    const existing = summaryMap.get(otherUser);
    if (existing) {
      if (msg.timestamp > existing.lastMessageTimestamp) {
        existing.lastMessageContent = msg.content;
        existing.lastMessageTimestamp = msg.timestamp;
      }
      if (!msg.isRead && msg.receiverId === username) {
        existing.unreadCount++;
      }
    }
  }

  const result = Array.from(summaryMap.values());
  result.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
  return result;
}

export function getUnreadCount(username: string): number {
  const messages = getMessages();
  return messages.filter((m) => m.receiverId === username && !m.isRead).length;
}

export function getPendingRequestCount(username: string): number {
  return getPendingRequests(username).length;
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
