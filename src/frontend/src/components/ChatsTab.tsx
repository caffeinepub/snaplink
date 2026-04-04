import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Image,
  MessageCircle,
  MessageSquarePlus,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  backendGetConversations,
  backendGetFriends,
  backendGetMessages,
  backendGetSnapUrl,
  backendMarkMessageRead,
  backendSendMessage,
  backendViewSnap,
} from "../backendStore";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { ConversationSummary, Message, User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

function formatTime(ts: number): string {
  if (ts === 0) return "";
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Strip the "v:" / "p:" encoding prefix from a blobId to get the raw hash. */
function decodeBlobId(blobId: string): { hash: string; isVideo: boolean } {
  if (blobId.startsWith("v:")) return { hash: blobId.slice(2), isVideo: true };
  if (blobId.startsWith("p:")) return { hash: blobId.slice(2), isVideo: false };
  // Legacy or plain hashes — assume photo
  return { hash: blobId, isVideo: false };
}

/** Map a raw backend message object to the frontend Message type. */
function mapBackendMessage(msg: any): Message & { snapBlobId?: string } {
  const blobIdRaw: string | undefined = msg.snapBlobId?.[0] ?? undefined;
  const isVideo = blobIdRaw ? decodeBlobId(blobIdRaw).isVideo : false;
  return {
    id: String(msg.id),
    senderId: String(msg.senderId),
    receiverId: String(msg.receiverId),
    content: String(msg.content ?? ""),
    timestamp:
      typeof msg.timestamp === "bigint"
        ? Number(msg.timestamp) / 1_000_000
        : Number(msg.timestamp ?? 0),
    isRead: Boolean(msg.isRead),
    isSnap: Boolean(msg.isSnap),
    isEphemeral: Boolean(msg.isEphemeral),
    snapViewed: Boolean(msg.snapViewed),
    savedToChat: Boolean(msg.savedToChat),
    isVideo,
    snapBlobId: blobIdRaw,
    snapDataUrl: undefined, // loaded lazily from blob-storage
  };
}

// Wraps video element to allow biome suppression at component level
function SnapVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: videoRef is a stable ref; src change handled by re-mounting
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video
      .play()
      .then(() => {
        video.muted = false;
      })
      .catch(() => {});
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      autoPlay
      muted
      loop
      className="w-full rounded-2xl"
      style={{ maxHeight: "70vh", objectFit: "contain" }}
    />
  );
}

function SnapViewer({
  msg,
  snapMediaUrl,
  currentUsername,
  onClose,
  onViewed,
}: {
  msg: Message & { snapBlobId?: string };
  snapMediaUrl?: string;
  currentUsername: string;
  onClose: () => void;
  onViewed: () => void;
}) {
  const isReceived = msg.receiverId === currentUsername;

  // biome-ignore lint/correctness/useExhaustiveDependencies: msg.id is intentionally excluded; effect runs when snap state changes
  useEffect(() => {
    if (isReceived && !msg.snapViewed) {
      onViewed();
    }
  }, [msg.snapViewed, isReceived, onViewed]);

  const mediaSrc = snapMediaUrl ?? msg.snapDataUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.95)" }}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-10 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.15)" }}
        onClick={onClose}
      >
        <X size={20} color="white" />
      </button>

      <div className="absolute top-10 left-4 right-14">
        <p className="text-white font-semibold text-sm">
          {isReceived
            ? `Snap from @${msg.senderId}`
            : `Sent to @${msg.receiverId}`}
        </p>
        {msg.content &&
          msg.content !== "📸 Sent a snap" &&
          msg.content !== "📹 Sent a video snap" &&
          msg.content !== "📷 Sent a photo" && (
            <p className="text-[#B0B0CC] text-xs mt-0.5">{msg.content}</p>
          )}
      </div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay background closes on click */}
      <div
        className="w-full max-w-sm px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaSrc ? (
          msg.isVideo ? (
            <SnapVideo src={mediaSrc} />
          ) : (
            <img
              src={mediaSrc}
              alt="snap"
              className="w-full rounded-2xl"
              style={{ maxHeight: "70vh", objectFit: "contain" }}
            />
          )
        ) : (
          <div
            className="w-full h-64 rounded-2xl flex flex-col items-center justify-center gap-3"
            style={{ background: "#1A1F33" }}
          >
            <Camera size={48} color="#B0B0CC" />
            <p className="text-[#B0B0CC] text-sm text-center px-4">
              {msg.isEphemeral
                ? "This snap has already been viewed and disappeared."
                : "Snap media unavailable."}
            </p>
          </div>
        )}
      </div>

      <p className="absolute bottom-8 text-[#B0B0CC] text-xs">
        Tap anywhere to close
      </p>
    </motion.div>
  );
}

function SnapBubble({
  msg,
  isSent,
  snapMediaUrl,
  onOpenSnap,
}: {
  msg: Message;
  isSent: boolean;
  snapMediaUrl?: string;
  onOpenSnap: (msg: Message) => void;
}) {
  const isViewed = msg.snapViewed;
  const isReceived = !isSent;

  if (isReceived) {
    if (isViewed) {
      return (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: "#1A1F33", border: "1px solid #2A3048" }}
        >
          <Camera size={16} color="#B0B0CC" />
          <span className="text-sm" style={{ color: "#B0B0CC" }}>
            {msg.isVideo ? "Video opened" : "Snap opened"}
          </span>
        </div>
      );
    }
    return (
      <motion.button
        type="button"
        onClick={() => onOpenSnap(msg)}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-3 rounded-2xl cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #00CFFF22, #BD00FF22)",
          border: "1.5px solid #00CFFF",
        }}
      >
        <Camera size={16} color="#00CFFF" />
        <span className="text-sm font-semibold" style={{ color: "#00CFFF" }}>
          {msg.isVideo ? "🎥 Tap to open video" : "📸 Tap to open snap"}
        </span>
      </motion.button>
    );
  }

  // Sent side
  const previewSrc = snapMediaUrl ?? msg.snapDataUrl;

  return (
    <button
      type="button"
      className="rounded-2xl overflow-hidden w-full text-left"
      onClick={() => onOpenSnap(msg)}
    >
      {previewSrc && !msg.isVideo ? (
        <div className="relative">
          <img
            src={previewSrc}
            alt="snap preview"
            className="max-w-full rounded-2xl"
            style={{ maxHeight: 160, objectFit: "cover", width: "100%" }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 px-3 py-2 rounded-b-2xl"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <span className="text-xs text-white">
              {isViewed ? "✓ Seen" : "Sent"}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: "linear-gradient(135deg, #00CFFF, #0099CC)" }}
        >
          <Camera size={16} color="white" />
          <span className="text-sm font-medium text-white">
            {msg.isVideo
              ? isViewed
                ? "🎥 Video seen"
                : "🎥 Video sent"
              : isViewed
                ? "📸 Snap seen"
                : "📸 Snap sent"}
          </span>
        </div>
      )}
    </button>
  );
}

// ─── New Chat Sheet ───────────────────────────────────────────────────────────

function NewChatSheet({
  onSelect,
  onClose,
}: {
  onSelect: (user: User) => void;
  onClose: () => void;
}) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [friends, setFriends] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    backendGetFriends(currentUser.username, identity ?? undefined)
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [currentUser, identity]);

  const filtered = query.trim()
    ? friends.filter(
        (f) =>
          f.displayName.toLowerCase().includes(query.toLowerCase()) ||
          f.username.toLowerCase().includes(query.toLowerCase()),
      )
    : friends;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
        className="rounded-t-3xl px-5 pt-5 pb-8"
        style={{ background: "#1A1F33", maxHeight: "75vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-bold text-lg">New Chat</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X size={16} color="#B0B0CC" />
          </button>
        </div>

        {/* Search */}
        <div
          className="relative mb-4"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            color="#B0B0CC"
          />
          <input
            className="w-full bg-transparent text-white text-sm pl-9 pr-8 py-2.5 outline-none placeholder-[#B0B0CC]"
            placeholder="Search friends..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: intentional focus for search UX
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={12} color="#B0B0CC" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "#00CFFF", borderTopColor: "transparent" }}
            />
            <p className="text-[#B0B0CC] text-sm">Loading friends...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <UserPlus size={28} color="#2A3048" />
            <p className="text-[#B0B0CC] text-sm">
              {friends.length === 0
                ? "Add friends first to start chatting"
                : `No friends matching "${query}"`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((friend) => (
              <button
                key={friend.username}
                type="button"
                onClick={() => onSelect(friend)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left w-full active:opacity-70 transition-opacity"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <UserAvatar
                  name={friend.displayName}
                  size={44}
                  avatarUrl={friend.avatarUrl}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {friend.displayName}
                  </p>
                  <p className="text-[#B0B0CC] text-xs truncate">
                    @{friend.username}
                  </p>
                </div>
                <MessageSquarePlus size={18} color="#00CFFF" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Conversation List ────────────────────────────────────────────────────────

function ConversationList({
  onSelect,
}: {
  onSelect: (username: string, displayName: string) => void;
}) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      const raw = await backendGetConversations(
        currentUser.username,
        identity ?? undefined,
      );
      setConversations(
        raw.map((c: any) => ({
          username: String(c.username),
          displayName: String(c.displayName),
          lastMessageContent: String(c.lastMessageContent ?? ""),
          lastMessageTimestamp:
            typeof c.lastMessageTimestamp === "bigint"
              ? Number(c.lastMessageTimestamp) / 1_000_000
              : Number(c.lastMessageTimestamp ?? 0),
          unreadCount: Number(c.unreadCount ?? 0),
        })),
      );
    } catch {
      // keep existing list
    }
  }, [currentUser, identity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filtered = conversations.filter(
    (c) =>
      !searchQuery.trim() ||
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleNewChatSelect = (user: User) => {
    setShowNewChat(false);
    onSelect(user.username, user.displayName);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#1A1A2E" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Chats</h1>
          {/* New Chat button */}
          <PressableButton
            onClick={() => setShowNewChat(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
            style={{
              background: "linear-gradient(135deg, #00CFFF22, #BD00FF22)",
              border: "1px solid rgba(0,207,255,0.3)",
              color: "#00CFFF",
            }}
            data-ocid="chats.primary_button"
          >
            <MessageSquarePlus size={15} />
            <span>New Chat</span>
          </PressableButton>
        </div>
      </div>

      {/* Search bar — always visible */}
      <div className="px-5 pb-3">
        <div
          className="relative"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            color="#B0B0CC"
          />
          <input
            className="w-full bg-transparent text-white text-sm pl-9 pr-8 py-2.5 outline-none placeholder-[#B0B0CC]"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-ocid="chats.search_input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X size={12} color="#B0B0CC" />
            </button>
          )}
        </div>
      </div>

      {conversations.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center"
          data-ocid="chats.empty_state"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "#1A1F33", border: "1px solid #2A3048" }}
          >
            <MessageCircle size={36} color="#B0B0CC" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">No chats yet</p>
            <p className="text-[#B0B0CC] text-sm mt-1">
              Tap <span className="text-[#00CFFF] font-semibold">New Chat</span>{" "}
              to message a friend
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <Search size={32} color="#2A3048" />
          <p className="text-[#B0B0CC] text-sm">
            No chats matching &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filtered.map((conv, i) => {
            return (
              <motion.div
                key={conv.username}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onSelect(conv.username, conv.displayName)}
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer active:bg-[#1A1F33] transition-colors"
                style={{ borderBottom: "1px solid rgba(42,48,72,0.5)" }}
                data-ocid={`chats.item.${i + 1}`}
              >
                <UserAvatar name={conv.displayName} size={50} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold text-[15px]">
                      {conv.displayName}
                    </span>
                    <span className="text-[#B0B0CC] text-xs">
                      {formatTime(conv.lastMessageTimestamp)}
                    </span>
                  </div>
                  <p
                    className="text-[#B0B0CC] text-sm truncate mt-0.5"
                    style={{ maxWidth: "200px" }}
                  >
                    {conv.lastMessageContent}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <div
                    className="rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                      minWidth: 20,
                    }}
                  >
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Chat sheet */}
      <AnimatePresence>
        {showNewChat && (
          <NewChatSheet
            onSelect={handleNewChatSelect}
            onClose={() => setShowNewChat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────

function ChatView({
  username,
  displayName,
  onBack,
  onCamera,
}: {
  username: string;
  displayName: string;
  onBack: () => void;
  onCamera: () => void;
}) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [messages, setMessages] = useState<
    (Message & { snapBlobId?: string })[]
  >([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [viewingSnap, setViewingSnap] = useState<
    (Message & { snapBlobId?: string }) | null
  >(null);
  const [snapMediaUrls, setSnapMediaUrls] = useState<Record<string, string>>(
    {},
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      const rawMsgs = await backendGetMessages(
        currentUser.username,
        username,
        0,
        identity ?? undefined,
      );
      const mapped = rawMsgs.map(mapBackendMessage);
      setMessages(mapped);
      // Mark received messages as read
      for (const msg of mapped) {
        if (!msg.isRead && msg.receiverId === currentUser.username) {
          backendMarkMessageRead(
            currentUser.username,
            msg.id,
            identity ?? undefined,
          ).catch(() => {});
        }
      }
    } catch {
      // keep existing messages
    }
  }, [currentUser, username, identity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll on message count change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || sending) return;
    setSending(true);
    await backendSendMessage(
      currentUser.username,
      username,
      inputText.trim(),
      identity ?? undefined,
    );
    setInputText("");
    await refresh();
    setSending(false);
  };

  const handleOpenSnap = useCallback(
    async (msg: Message & { snapBlobId?: string }) => {
      setViewingSnap(msg);
      // Load media URL from blob-storage if not already loaded
      if (msg.snapBlobId && !snapMediaUrls[msg.id]) {
        const { hash } = decodeBlobId(msg.snapBlobId);
        const url = await backendGetSnapUrl(hash);
        if (url) {
          setSnapMediaUrls((prev) => ({ ...prev, [msg.id]: url }));
        }
      }
      // Mark snap as viewed on backend
      if (msg.receiverId === currentUser?.username && !msg.snapViewed) {
        await backendViewSnap(
          currentUser.username,
          msg.id,
          identity ?? undefined,
        );
        await refresh();
      }
    },
    [currentUser, snapMediaUrls, identity, refresh],
  );

  const handleCloseSnap = useCallback(() => {
    setViewingSnap(null);
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#1A1A2E" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-12 pb-4"
        style={{ borderBottom: "1px solid #2A3048" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2"
          data-ocid="chats.secondary_button"
        >
          <ArrowLeft size={22} color="#00CFFF" />
        </button>
        <UserAvatar name={displayName} size={38} />
        <div className="flex-1">
          <p className="text-white font-semibold text-[15px]">{displayName}</p>
          <p className="text-[#B0B0CC] text-xs">@{username}</p>
        </div>
        <button
          type="button"
          onClick={onCamera}
          className="p-2"
          data-ocid="chats.secondary_button"
        >
          <Camera size={22} color="#00CFFF" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#B0B0CC] text-sm">
              Say hi to {displayName}! 👋
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isSent = msg.senderId === currentUser?.username;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
              className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              data-ocid={`chats.item.${i + 1}`}
            >
              <div style={{ maxWidth: "75%" }}>
                {msg.isSnap ? (
                  <SnapBubble
                    msg={msg}
                    isSent={isSent}
                    snapMediaUrl={snapMediaUrls[msg.id]}
                    onOpenSnap={handleOpenSnap}
                  />
                ) : (
                  <div
                    className={`px-4 py-2.5 ${
                      isSent ? "message-bubble-sent" : "message-bubble-received"
                    }`}
                  >
                    <p
                      className="text-sm"
                      style={{ color: isSent ? "white" : "#FFFFFF" }}
                    >
                      {msg.content}
                    </p>
                  </div>
                )}
                <div
                  className={`flex items-center gap-1 mt-1 ${
                    isSent ? "justify-end" : "justify-start"
                  }`}
                >
                  <span className="text-[10px]" style={{ color: "#B0B0CC" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                  {isSent &&
                    (msg.isRead ? (
                      <CheckCheck size={12} color="#00CFFF" />
                    ) : (
                      <Check size={12} color="#B0B0CC" />
                    ))}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderTop: "1px solid #2A3048", background: "#1A1F33" }}
      >
        <button
          type="button"
          onClick={onCamera}
          className="p-2"
          data-ocid="chats.secondary_button"
        >
          <Image size={22} color="#B0B0CC" />
        </button>
        <input
          className="flex-1 py-2.5 px-4 text-sm rounded-full"
          style={{
            background: "#1A1A2E",
            border: "1px solid #2A3048",
            color: "#FFFFFF",
            outline: "none",
          }}
          placeholder="Message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          data-ocid="chats.input"
        />
        <PressableButton
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center btn-glow-blue flex-shrink-0"
          style={{
            background: inputText.trim()
              ? "linear-gradient(135deg, #00CFFF, #0099CC)"
              : "#1A1F33",
          }}
          data-ocid="chats.submit_button"
        >
          <Send size={16} color="white" />
        </PressableButton>
      </div>

      {/* Full-screen snap viewer */}
      <AnimatePresence>
        {viewingSnap && (
          <SnapViewer
            msg={viewingSnap}
            snapMediaUrl={snapMediaUrls[viewingSnap.id]}
            currentUsername={currentUser?.username ?? ""}
            onClose={handleCloseSnap}
            onViewed={() => {
              backendViewSnap(
                currentUser?.username ?? "",
                viewingSnap.id,
                identity ?? undefined,
              ).catch(() => {});
              refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ChatsTab ─────────────────────────────────────────────────────────────────

export function ChatsTab() {
  const { selectedConversation, setSelectedConversation, setActiveTab } =
    useApp();
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [convDetails, setConvDetails] = useState<{
    username: string;
    displayName: string;
  } | null>(null);

  const openConversation = useCallback(
    (username: string, displayName: string) => {
      setConvDetails({ username, displayName });
      setSelectedConversation(username);
    },
    [setSelectedConversation],
  );

  useEffect(() => {
    if (selectedConversation && currentUser) {
      if (!convDetails || convDetails.username !== selectedConversation) {
        // Look up display name from backend conversations
        backendGetConversations(currentUser.username, identity ?? undefined)
          .then((convs: any[]) => {
            const found = convs.find(
              (c: any) => String(c.username) === selectedConversation,
            );
            setConvDetails({
              username: selectedConversation,
              displayName: found
                ? String(found.displayName)
                : selectedConversation,
            });
          })
          .catch(() => {
            setConvDetails({
              username: selectedConversation,
              displayName: selectedConversation,
            });
          });
      }
    } else {
      setConvDetails(null);
    }
  }, [selectedConversation, currentUser, identity, convDetails]);

  const handleCameraFromChat = () => {
    setActiveTab("camera");
  };

  return (
    <AnimatePresence mode="wait">
      {selectedConversation && convDetails ? (
        <motion.div
          key="chat"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
          className="absolute inset-0"
        >
          <ChatView
            username={convDetails.username}
            displayName={convDetails.displayName}
            onBack={() => setSelectedConversation(null)}
            onCamera={handleCameraFromChat}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
          className="absolute inset-0"
        >
          <ConversationList onSelect={openConversation} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
