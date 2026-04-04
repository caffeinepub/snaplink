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

const USERS_KEY = "snaplink_users";
const REQUESTS_KEY = "snaplink_requests";
const MESSAGES_KEY = "snaplink_messages";
const SESSION_KEY = "snaplink_session";

export function getUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

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

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { userId: string; expiry: number };
    if (Date.now() > session.expiry) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const users = getUsers();
    return users.find((u) => u.id === session.userId) ?? null;
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
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function registerUser(
  username: string,
  password: string,
  displayName: string,
): { ok: User } | { err: string } {
  const users = getUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { err: "Username already taken" };
  }
  const user: User = {
    id: crypto.randomUUID(),
    username: username.toLowerCase(),
    displayName,
    bio: "",
    createdAt: Date.now(),
    passwordHash: simpleHash(password),
    useII: false,
  };
  users.push(user);
  saveUsers(users);
  return { ok: user };
}

export function loginUser(
  username: string,
  password: string,
): { ok: User } | { err: string } {
  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (!user) return { err: "User not found" };
  if (user.passwordHash !== simpleHash(password))
    return { err: "Incorrect password" };
  return { ok: user };
}

export function loginOrRegisterII(principal: string): User {
  const users = getUsers();
  const username = `ii_${principal.slice(0, 8)}`;
  let user = users.find((u) => u.username === username);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      username,
      displayName: `User ${principal.slice(0, 6)}`,
      bio: "",
      createdAt: Date.now(),
      passwordHash: "",
      useII: true,
    };
    users.push(user);
    saveUsers(users);
  }
  return user;
}

export function updateUserProfile(
  userId: string,
  displayName: string,
  bio: string,
): void {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    users[idx].displayName = displayName;
    users[idx].bio = bio;
    saveUsers(users);
  }
}

export function searchUsers(query: string, currentUserId: string): User[] {
  if (!query.trim()) return [];
  const users = getUsers();
  return users.filter(
    (u) =>
      u.id !== currentUserId &&
      (u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.displayName.toLowerCase().includes(query.toLowerCase())),
  );
}

export function sendConnectionRequest(
  fromUser: User,
  toUsername: string,
): { ok: null } | { err: string } {
  const users = getUsers();
  const toUser = users.find((u) => u.username === toUsername);
  if (!toUser) return { err: "User not found" };
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
  const users = getUsers();
  const friendUsernames = requests
    .filter(
      (r) =>
        (r.fromUser === username || r.toUser === username) &&
        r.status === "accepted",
    )
    .map((r) => (r.fromUser === username ? r.toUser : r.fromUser));
  return users.filter((u) => friendUsernames.includes(u.username));
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
): Message {
  const messages = getMessages();
  const msg: Message = {
    id: crypto.randomUUID(),
    senderId: from.username,
    receiverId: toUsername,
    content: isEphemeral ? "📸 Sent a snap" : "📷 Sent a photo",
    timestamp: Date.now(),
    isRead: false,
    isSnap: true,
    snapDataUrl,
    isEphemeral,
    snapViewed: false,
    savedToChat,
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

// Seed some demo data
export function seedDemoData(): void {
  const users = getUsers();
  if (users.length > 0) return; // Already seeded

  const demoUsers: User[] = [
    {
      id: "demo-1",
      username: "alex_nova",
      displayName: "Alex Nova",
      bio: "Photographer | Explorer | Living life one snap at a time",
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      passwordHash: simpleHash("demo123"),
      useII: false,
    },
    {
      id: "demo-2",
      username: "sara_moon",
      displayName: "Sara Moon",
      bio: "Design lover & coffee enthusiast ☕",
      createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
      passwordHash: simpleHash("demo123"),
      useII: false,
    },
    {
      id: "demo-3",
      username: "kai_zen",
      displayName: "Kai Zen",
      bio: "Building cool things on the internet",
      createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
      passwordHash: simpleHash("demo123"),
      useII: false,
    },
    {
      id: "demo-4",
      username: "priya_v",
      displayName: "Priya Verma",
      bio: "Artist & traveler 🌍",
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      passwordHash: simpleHash("demo123"),
      useII: false,
    },
  ];
  saveUsers(demoUsers);
}
