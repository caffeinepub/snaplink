import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Image,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  Timer,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  backendAddReaction,
  backendCreateGroup,
  backendGetConversations,
  backendGetFriendStories,
  backendGetFriends,
  backendGetGroupMessages,
  backendGetGroups,
  backendGetMessages,
  backendGetReactions,
  backendGetSnapUrl,
  backendGetStreak,
  backendMarkMessageRead,
  backendPostStory,
  backendSendGroupMessage,
  backendSendMessage,
  backendUploadSnapMedia,
  backendViewSnap,
} from "../backendStore";
import type { GroupInfo, GroupMessage, Reaction, Story } from "../backendStore";
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

function formatTimeLeft(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h left`;
  return `${mins}m left`;
}

/** Strip the "v:" / "p:" encoding prefix from a blobId to get the raw hash. */
function decodeBlobId(blobId: string): { hash: string; isVideo: boolean } {
  if (blobId.startsWith("v:")) return { hash: blobId.slice(2), isVideo: true };
  if (blobId.startsWith("p:")) return { hash: blobId.slice(2), isVideo: false };
  return { hash: blobId, isVideo: false };
}

/** Parse [DISAPPEAR:N] tag embedded in message content */
function parseDisappearTag(content: string): {
  seconds: number;
  cleanContent: string;
} {
  const match = content.match(/^\[DISAPPEAR:(\d+)\]/);
  if (!match) return { seconds: 0, cleanContent: content };
  return {
    seconds: Number.parseInt(match[1], 10),
    cleanContent: content.slice(match[0].length),
  };
}

/** Format remaining time for a disappearing message */
function formatDisappearLabel(seconds: number, timestamp: number): string {
  const elapsedMs = Date.now() - timestamp;
  const remainingMs = seconds * 1000 - elapsedMs;
  if (remainingMs <= 0) return "Expired";
  const secs = Math.floor(remainingMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
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
    snapDataUrl: undefined,
  };
}
// ─── Story Viewer ─────────────────────────────────────────────────────────────

function StoryViewer({
  story,
  mediaUrl,
  onClose,
}: {
  story: Story;
  mediaUrl: string | null;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.97)" }}
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
        <p className="text-white font-bold text-sm">
          {story.authorDisplayName}
        </p>
        <p className="text-[#B0B0CC] text-xs">
          @{story.authorUsername} · {formatTimeLeft(story.expiresAt)}
        </p>
      </div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay closes on click */}
      <div
        className="w-full max-w-sm px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaUrl ? (
          <img
            src={mediaUrl}
            alt="story"
            className="w-full rounded-2xl"
            style={{ maxHeight: "70vh", objectFit: "contain" }}
          />
        ) : (
          <div
            className="w-full h-64 rounded-2xl flex items-center justify-center"
            style={{ background: "#1A1F33" }}
          >
            <Camera size={48} color="#B0B0CC" />
          </div>
        )}
        {story.caption && (
          <div
            className="mt-3 px-4 py-2.5 rounded-xl text-center"
            style={{ background: "rgba(0,0,0,0.7)" }}
          >
            <p className="text-white text-sm">{story.caption}</p>
          </div>
        )}
      </div>

      <p className="absolute bottom-8 text-[#B0B0CC] text-xs">
        Tap anywhere to close
      </p>
    </motion.div>
  );
}

// ─── Story Row ────────────────────────────────────────────────────────────────

function StoriesRow({
  currentUsername,
  onAddStory,
}: {
  currentUsername: string;
  onAddStory: () => void;
}) {
  const { identity } = useInternetIdentity();
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [storyMediaUrl, setStoryMediaUrl] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    const s = await backendGetFriendStories(
      currentUsername,
      identity ?? undefined,
    );
    setStories(s);
  }, [currentUsername, identity]);

  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 30_000);
    return () => clearInterval(interval);
  }, [loadStories]);

  const handleOpenStory = async (story: Story) => {
    setSelectedStory(story);
    if (story.blobId) {
      const { hash } = decodeBlobId(story.blobId);
      const url = await backendGetSnapUrl(hash);
      setStoryMediaUrl(url);
    } else {
      setStoryMediaUrl(null);
    }
  };

  return (
    <>
      <div
        className="flex gap-3 px-5 py-3 overflow-x-auto scrollbar-hide"
        style={{ borderBottom: "1px solid rgba(42,48,72,0.5)" }}
      >
        {/* My story / Add story */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onAddStory}
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #1A1F33, #1A1F33)",
              border: "2px dashed rgba(0,207,255,0.5)",
            }}
            data-ocid="stories.primary_button"
          >
            <Plus size={20} color="#00CFFF" />
          </button>
          <span
            className="text-[10px] text-[#B0B0CC]"
            style={{ maxWidth: 56, textAlign: "center" }}
          >
            Add
          </span>
        </div>

        {/* Friend stories */}
        {stories.map((story) => (
          <div
            key={story.id}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <button
              type="button"
              onClick={() => handleOpenStory(story)}
              className="relative w-14 h-14 rounded-full p-0.5"
              style={{
                background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                boxShadow: "0 0 12px rgba(0,207,255,0.4)",
              }}
            >
              <div
                className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                style={{ background: "#1A1F33" }}
              >
                <UserAvatar name={story.authorDisplayName} size={52} />
              </div>
            </button>
            <span
              className="text-[10px] text-white font-medium"
              style={{
                maxWidth: 56,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {story.authorDisplayName.split(" ")[0]}
            </span>
          </div>
        ))}

        {stories.length === 0 && (
          <div className="flex items-center">
            <p className="text-[#B0B0CC] text-xs italic">No stories yet</p>
          </div>
        )}
      </div>

      {/* Full-screen viewer */}
      <AnimatePresence>
        {selectedStory && (
          <StoryViewer
            story={selectedStory}
            mediaUrl={storyMediaUrl}
            onClose={() => {
              setSelectedStory(null);
              setStoryMediaUrl(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Add Story Sheet ──────────────────────────────────────────────────────────

function AddStorySheet({
  currentUsername,
  onClose,
}: {
  currentUsername: string;
  onClose: () => void;
}) {
  const { identity } = useInternetIdentity();
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handlePost = async () => {
    if (!selectedFile) {
      setError("Select a photo first");
      return;
    }
    setPosting(true);
    setError(null);
    const uploadResult = await backendUploadSnapMedia(selectedFile);
    if ("err" in uploadResult) {
      setError(uploadResult.err);
      setPosting(false);
      return;
    }
    const result = await backendPostStory(
      currentUsername,
      `p:${uploadResult.hash}`,
      caption,
      identity ?? undefined,
    );
    if ("err" in result) {
      setError(result.err);
      setPosting(false);
      return;
    }
    setPosted(true);
    setTimeout(() => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onClose();
    }, 1200);
  };

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
        style={{ background: "#1A1F33", maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-bold text-lg">Post Story</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X size={16} color="#B0B0CC" />
          </button>
        </div>

        {/* Photo picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-40 rounded-2xl flex flex-col items-center justify-center gap-2 mb-4"
          style={{
            background: previewUrl ? "transparent" : "rgba(255,255,255,0.04)",
            border: previewUrl ? "none" : "2px dashed rgba(0,207,255,0.3)",
            overflow: "hidden",
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <>
              <Camera size={28} color="#00CFFF" />
              <p className="text-[#B0B0CC] text-sm">Tap to select photo</p>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Caption */}
        <input
          className="w-full bg-transparent text-white text-sm px-4 py-3 rounded-2xl mb-3 outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          placeholder="Add a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={150}
        />

        {error && (
          <p className="text-xs mb-3 text-center" style={{ color: "#FF6B6B" }}>
            {error}
          </p>
        )}

        <PressableButton
          onClick={handlePost}
          disabled={posting || !selectedFile}
          className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
          style={{
            background: posted
              ? "linear-gradient(135deg, #00CFFF, #00AA88)"
              : "linear-gradient(135deg, #00CFFF, #BD00FF)",
            opacity: !selectedFile ? 0.5 : 1,
          }}
        >
          {posted ? "Posted! ✓" : posting ? "Posting..." : "Post to My Story"}
        </PressableButton>
      </motion.div>
    </motion.div>
  );
}

// ─── Reaction Picker ──────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

function ReactionPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 8 }}
      transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.2 }}
      className="absolute z-50 flex gap-1 px-3 py-2 rounded-2xl"
      style={{
        background: "#1A1F33",
        border: "1px solid #2A3048",
        bottom: "calc(100% + 8px)",
        left: 0,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-[#2A3048] transition-colors active:scale-90"
        >
          {emoji}
        </button>
      ))}
    </motion.div>
  );
}

// ─── Reaction Pill Strip ──────────────────────────────────────────────────────

function ReactionPills({ reactions }: { reactions: Reaction[] }) {
  if (reactions.length === 0) return null;
  // Group by emoji
  const grouped: Record<string, number> = {};
  for (const r of reactions) {
    grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex gap-1 mt-1 flex-wrap"
    >
      {Object.entries(grouped).map(([emoji, count]) => (
        <div
          key={emoji}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-[#B0B0CC]">{count}</span>}
        </div>
      ))}
    </motion.div>
  );
}

// ─── SnapVideo helper ─────────────────────────────────────────────────────────

function SnapVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

// ─── SnapViewer ───────────────────────────────────────────────────────────────

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
      {/* Screenshot deterrent banner */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center py-2"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      >
        <span className="text-white text-xs font-semibold tracking-wide select-none">
          🚫 Screenshots are not allowed
        </span>
      </div>

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
              style={{
                maxHeight: "70vh",
                objectFit: "contain",
                userSelect: "none",
                WebkitUserSelect: "none",
                pointerEvents: "none",
              }}
              onContextMenu={(e) => e.preventDefault()}
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

// ─── SnapBubble ───────────────────────────────────────────────────────────────

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

// ─── New Group Sheet ──────────────────────────────────────────────────────────

function NewGroupSheet({
  onCreated,
  onClose,
}: {
  onCreated: (group: GroupInfo) => void;
  onClose: () => void;
}) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [friends, setFriends] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    backendGetFriends(currentUser.username, identity ?? undefined)
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [currentUser, identity]);

  const toggle = (username: string) => {
    setSelected((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  };

  const handleCreate = async () => {
    if (!currentUser || !groupName.trim() || selected.length === 0) {
      setError("Enter a group name and select at least one friend");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await backendCreateGroup(
      currentUser.username,
      groupName.trim(),
      selected,
      identity ?? undefined,
    );
    setCreating(false);
    if ("err" in result) {
      setError(result.err);
      return;
    }
    onCreated(result.ok);
  };

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
        style={{ background: "#1A1F33", maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-bold text-lg">New Group</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X size={16} color="#B0B0CC" />
          </button>
        </div>

        {/* Group name */}
        <input
          className="w-full bg-transparent text-white text-sm px-4 py-3 rounded-2xl mb-4 outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          placeholder="Group name..."
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={50}
          data-ocid="chats.input"
        />

        <p className="text-[#B0B0CC] text-xs font-medium mb-3 uppercase tracking-wider">
          Add Members
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-6 gap-3">
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "#00CFFF", borderTopColor: "transparent" }}
            />
            <p className="text-[#B0B0CC] text-sm">Loading friends...</p>
          </div>
        ) : friends.length === 0 ? (
          <p className="text-[#B0B0CC] text-sm text-center py-4">
            Add friends first
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {friends.map((friend) => {
              const isSelected = selected.includes(friend.username);
              return (
                <button
                  key={friend.username}
                  type="button"
                  onClick={() => toggle(friend.username)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left w-full"
                  style={{
                    background: isSelected
                      ? "rgba(0,207,255,0.08)"
                      : "rgba(255,255,255,0.04)",
                    border: isSelected
                      ? "1px solid rgba(0,207,255,0.3)"
                      : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <UserAvatar
                    name={friend.displayName}
                    size={40}
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
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                        : "rgba(255,255,255,0.08)",
                      border: isSelected
                        ? "none"
                        : "1.5px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {isSelected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 6l2.5 2.5L9.5 3"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p className="text-xs mb-3 text-center" style={{ color: "#FF6B6B" }}>
            {error}
          </p>
        )}

        <PressableButton
          onClick={handleCreate}
          disabled={creating || !groupName.trim() || selected.length === 0}
          className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
          style={{
            background:
              groupName.trim() && selected.length > 0
                ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                : "#2A3048",
            opacity: !groupName.trim() || selected.length === 0 ? 0.5 : 1,
          }}
          data-ocid="chats.primary_button"
        >
          <Users size={18} />
          {creating
            ? "Creating..."
            : `Create Group (${selected.length} members)`}
        </PressableButton>
      </motion.div>
    </motion.div>
  );
}

// ─── Group Chat View ──────────────────────────────────────────────────────────

function GroupChatView({
  group,
  onBack,
}: {
  group: GroupInfo;
  onBack: () => void;
}) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    const msgs = await backendGetGroupMessages(
      currentUser.username,
      group.id,
      0,
      identity ?? undefined,
    );
    setMessages(msgs);
  }, [currentUser, group.id, identity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message count change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || sending) return;
    const text = inputText.trim();
    setSending(true);
    setInputText("");

    // Optimistic
    const optimistic: GroupMessage = {
      id: `opt-${Date.now()}`,
      groupId: group.id,
      senderUsername: currentUser.username,
      content: text,
      timestamp: Date.now(),
      isSnap: false,
    };
    setMessages((prev) => [...prev, optimistic]);

    await backendSendGroupMessage(
      currentUser.username,
      group.id,
      text,
      identity ?? undefined,
    );
    await refresh();
    setSending(false);
  };

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
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #00CFFF, #BD00FF)" }}
        >
          <Users size={18} color="white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-[15px]">{group.name}</p>
          <p className="text-[#B0B0CC] text-xs">
            {group.members.length} members
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#B0B0CC] text-sm">Start the conversation!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isSent = msg.senderUsername === currentUser?.username;
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
                {!isSent && (
                  <p className="text-[#B0B0CC] text-[10px] mb-1 ml-1">
                    @{msg.senderUsername}
                  </p>
                )}
                <div
                  className={`px-4 py-2.5 ${isSent ? "message-bubble-sent" : "message-bubble-received"}`}
                >
                  <p className="text-sm text-white">{msg.content}</p>
                </div>
                <div
                  className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}
                >
                  <span className="text-[10px]" style={{ color: "#B0B0CC" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderTop: "1px solid #2A3048", background: "#1A1F33" }}
      >
        <input
          className="flex-1 py-2.5 px-4 text-sm rounded-full"
          style={{
            background: "#1A1A2E",
            border: "1px solid #2A3048",
            color: "#FFFFFF",
            outline: "none",
          }}
          placeholder="Message group..."
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
    </div>
  );
}

// ─── Conversation List ────────────────────────────────────────────────────────

function ConversationList({
  onSelect,
  onSelectGroup,
}: {
  onSelect: (username: string, displayName: string) => void;
  onSelectGroup: (group: GroupInfo) => void;
}) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [raw, grps] = await Promise.all([
        backendGetConversations(currentUser.username, identity ?? undefined),
        backendGetGroups(currentUser.username, identity ?? undefined),
      ]);
      const mapped: ConversationSummary[] = raw.map((c: any) => ({
        username: String(c.username),
        displayName: String(c.displayName),
        lastMessageContent: String(c.lastMessageContent ?? ""),
        lastMessageTimestamp:
          typeof c.lastMessageTimestamp === "bigint"
            ? Number(c.lastMessageTimestamp) / 1_000_000
            : Number(c.lastMessageTimestamp ?? 0),
        unreadCount: Number(c.unreadCount ?? 0),
      }));
      setConversations(mapped);
      setGroups(grps);

      // Load streaks in parallel for each conversation
      const streakEntries = await Promise.all(
        mapped.map(async (c) => {
          const streak = await backendGetStreak(
            currentUser.username,
            c.username,
          );
          return [c.username, streak] as [string, number];
        }),
      );
      setStreaks(Object.fromEntries(streakEntries));
    } catch {
      // keep existing list
    }
  }, [currentUser, identity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredConvs = conversations.filter(
    (c) =>
      !searchQuery.trim() ||
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredGroups = groups.filter(
    (g) =>
      !searchQuery.trim() ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleNewChatSelect = (user: User) => {
    setShowNewChat(false);
    onSelect(user.username, user.displayName);
  };

  const handleGroupCreated = (group: GroupInfo) => {
    setShowNewGroup(false);
    onSelectGroup(group);
  };

  const isEmpty = conversations.length === 0 && groups.length === 0;

  return (
    <div className="flex flex-col h-full" style={{ background: "#1A1A2E" }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-3"
        style={{
          borderBottom: "1px solid",
          borderImage: "linear-gradient(90deg, #00CFFF33, #BD00FF33) 1",
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Chats</h1>
          <div className="flex gap-2">
            {/* New Group button */}
            <PressableButton
              onClick={() => setShowNewGroup(true)}
              className="flex items-center gap-1 px-2.5 py-2 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(189,0,255,0.12)",
                border: "1px solid rgba(189,0,255,0.3)",
                color: "#BD00FF",
              }}
              data-ocid="chats.secondary_button"
            >
              <Users size={14} />
              <span>Group</span>
            </PressableButton>
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
      </div>

      {/* Stories Row */}
      <StoriesRow
        currentUsername={currentUser?.username ?? ""}
        onAddStory={() => setShowAddStory(true)}
      />

      {/* Search bar */}
      <div className="px-5 py-3">
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

      {isEmpty ? (
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
      ) : filteredConvs.length === 0 && filteredGroups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <Search size={32} color="#2A3048" />
          <p className="text-[#B0B0CC] text-sm">
            No chats matching &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Group chats */}
          {filteredGroups.map((group, i) => (
            <motion.div
              key={`group-${group.id}`}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
              onClick={() => onSelectGroup(group)}
              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer active:bg-[#1A1F33] transition-colors"
              style={{ borderBottom: "1px solid rgba(42,48,72,0.5)" }}
              data-ocid={`chats.item.${i + 1}`}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #00CFFF33, #BD00FF33)",
                  border: "1px solid rgba(0,207,255,0.3)",
                }}
              >
                <Users size={20} color="#00CFFF" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-[15px]">
                    {group.name}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(0,207,255,0.15)",
                      color: "#00CFFF",
                    }}
                  >
                    Group
                  </span>
                </div>
                <p className="text-[#B0B0CC] text-xs mt-0.5">
                  {group.members.length} members
                </p>
              </div>
            </motion.div>
          ))}

          {/* DM conversations */}
          {filteredConvs.map((conv, i) => {
            const streak = streaks[conv.username] ?? 0;
            return (
              <motion.div
                key={conv.username}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
                onClick={() => onSelect(conv.username, conv.displayName)}
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer active:bg-[#1A1F33] transition-colors"
                style={{ borderBottom: "1px solid rgba(42,48,72,0.5)" }}
                data-ocid={`chats.item.${filteredGroups.length + i + 1}`}
              >
                <UserAvatar name={conv.displayName} size={50} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-semibold text-[15px]">
                        {conv.displayName}
                      </span>
                      {streak > 0 && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            background: "rgba(255,120,0,0.15)",
                            color: "#FF7800",
                          }}
                        >
                          🔥 {streak}
                        </span>
                      )}
                    </div>
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

      {/* Sheets */}
      <AnimatePresence>
        {showNewChat && (
          <NewChatSheet
            onSelect={handleNewChatSelect}
            onClose={() => setShowNewChat(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showNewGroup && (
          <NewGroupSheet
            onCreated={handleGroupCreated}
            onClose={() => setShowNewGroup(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddStory && currentUser && (
          <AddStorySheet
            currentUsername={currentUser.username}
            onClose={() => setShowAddStory(false)}
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
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(
    null,
  );
  const [streak, setStreak] = useState(0);
  const [disappearTimer, setDisappearTimer] = useState<number>(0); // 0 = off, else seconds
  const [showTimerSheet, setShowTimerSheet] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Load reactions for all messages
      const reactionResults = await Promise.all(
        mapped.map(async (msg) => {
          const r = await backendGetReactions(msg.id);
          return [msg.id, r] as [string, Reaction[]];
        }),
      );
      setReactions(
        Object.fromEntries(reactionResults.filter(([, r]) => r.length > 0)),
      );
    } catch {
      // keep existing messages
    }
  }, [currentUser, username, identity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Load streak
  useEffect(() => {
    if (!currentUser) return;
    backendGetStreak(currentUser.username, username)
      .then(setStreak)
      .catch(() => {});
  }, [currentUser, username]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll on message count change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || sending) return;
    const text = inputText.trim();
    setSending(true);
    setInputText("");

    // Embed disappear tag into content if timer is set
    const encodedContent =
      disappearTimer > 0 ? `[DISAPPEAR:${disappearTimer}]${text}` : text;

    const optimisticMsg: Message & { snapBlobId?: string } = {
      id: `optimistic-${Date.now()}`,
      senderId: currentUser.username,
      receiverId: username,
      content: encodedContent,
      timestamp: Date.now(),
      isRead: false,
      isSnap: false,
      isEphemeral: false,
      snapViewed: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    await backendSendMessage(
      currentUser.username,
      username,
      encodedContent,
      identity ?? undefined,
    );
    await refresh();
    setSending(false);
  };

  // Filter out expired disappearing messages client-side using embedded tag
  const visibleMessages = messages.filter((msg) => {
    const { seconds } = parseDisappearTag(msg.content);
    if (seconds === 0) return true;
    const elapsedSecs = (Date.now() - msg.timestamp) / 1000;
    return elapsedSecs < seconds;
  });

  const handleOpenSnap = useCallback(
    async (msg: Message & { snapBlobId?: string }) => {
      setViewingSnap(msg);
      if (msg.snapBlobId && !snapMediaUrls[msg.id]) {
        const { hash } = decodeBlobId(msg.snapBlobId);
        const url = await backendGetSnapUrl(hash);
        if (url) {
          setSnapMediaUrls((prev) => ({ ...prev, [msg.id]: url }));
        }
      }
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

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    setReactionPickerMsgId(null);
    await backendAddReaction(
      currentUser.username,
      messageId,
      emoji,
      identity ?? undefined,
    );
    const updated = await backendGetReactions(messageId);
    setReactions((prev) => ({ ...prev, [messageId]: updated }));
  };

  const handleLongPress = (msgId: string) => {
    pressTimerRef.current = setTimeout(() => {
      setReactionPickerMsgId(msgId);
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

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
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-[15px]">
              {displayName}
            </p>
            {streak > 0 && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(255,120,0,0.15)", color: "#FF7800" }}
              >
                🔥 {streak} day{streak !== 1 ? "s" : ""}
              </span>
            )}
          </div>
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
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: dismissing picker on background click */}
      <div
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 flex flex-col gap-2"
        onClick={() => setReactionPickerMsgId(null)}
      >
        {visibleMessages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#B0B0CC] text-sm">
              Say hi to {displayName}! 👋
            </p>
          </div>
        )}
        {visibleMessages.map((msg, i) => {
          const isSent = msg.senderId === currentUser?.username;
          const msgReactions = reactions[msg.id] ?? [];
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
              className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              data-ocid={`chats.item.${i + 1}`}
            >
              <div style={{ maxWidth: "75%", position: "relative" }}>
                {/* Long-press target */}
                <div
                  onPointerDown={() => handleLongPress(msg.id)}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressEnd}
                >
                  {msg.isSnap ? (
                    <SnapBubble
                      msg={msg}
                      isSent={isSent}
                      snapMediaUrl={snapMediaUrls[msg.id]}
                      onOpenSnap={handleOpenSnap}
                    />
                  ) : (
                    <div
                      className={`px-4 py-2.5 ${isSent ? "message-bubble-sent" : "message-bubble-received"}`}
                    >
                      <p
                        className="text-sm"
                        style={{ color: isSent ? "white" : "#FFFFFF" }}
                      >
                        {parseDisappearTag(msg.content).cleanContent}
                      </p>
                    </div>
                  )}
                </div>

                {/* Reaction picker */}
                <AnimatePresence>
                  {reactionPickerMsgId === msg.id && (
                    <ReactionPicker
                      onSelect={(emoji) => handleReaction(msg.id, emoji)}
                      onClose={() => setReactionPickerMsgId(null)}
                    />
                  )}
                </AnimatePresence>

                {/* Reaction pills */}
                <ReactionPills reactions={msgReactions} />

                <div
                  className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}
                >
                  <span className="text-[10px]" style={{ color: "#B0B0CC" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                  {(() => {
                    const { seconds } = parseDisappearTag(msg.content);
                    if (seconds === 0) return null;
                    return (
                      <span
                        className="text-[10px] flex items-center gap-0.5"
                        style={{ color: "#FF8800" }}
                        title={`Disappears in ${formatDisappearLabel(seconds, msg.timestamp)}`}
                      >
                        <Timer size={9} />
                        {formatDisappearLabel(seconds, msg.timestamp)}
                      </span>
                    );
                  })()}
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
        className="flex flex-col"
        style={{ borderTop: "1px solid #2A3048", background: "#1A1F33" }}
      >
        {/* Timer sheet */}
        {showTimerSheet && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-4 py-3 border-b flex items-center gap-2"
            style={{
              borderColor: "#2A3048",
              background: "rgba(20,24,40,0.98)",
            }}
          >
            <span className="text-[#B0B0CC] text-xs font-semibold mr-1">
              Disappear:
            </span>
            {(
              [
                { label: "Off", value: 0 },
                { label: "1m", value: 60 },
                { label: "1h", value: 3600 },
                { label: "24h", value: 86400 },
              ] as { label: string; value: number }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setDisappearTimer(opt.value);
                  setShowTimerSheet(false);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background:
                    disappearTimer === opt.value
                      ? "rgba(255,136,0,0.2)"
                      : "rgba(255,255,255,0.06)",
                  color: disappearTimer === opt.value ? "#FF8800" : "#B0B0CC",
                  border:
                    disappearTimer === opt.value
                      ? "1px solid rgba(255,136,0,0.4)"
                      : "1px solid transparent",
                }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
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
          {/* Disappear timer button */}
          <button
            type="button"
            onClick={() => setShowTimerSheet((s) => !s)}
            className="relative p-2 rounded-full transition-all"
            style={{
              background:
                disappearTimer > 0 ? "rgba(255,136,0,0.15)" : "transparent",
            }}
            aria-label="Set disappearing message timer"
            data-ocid="chats.toggle"
          >
            <Timer
              size={20}
              color={disappearTimer > 0 ? "#FF8800" : "#B0B0CC"}
            />
            {disappearTimer > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ background: "#FF8800" }}
              />
            )}
          </button>
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
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);

  const openConversation = useCallback(
    (username: string, displayName: string) => {
      setConvDetails({ username, displayName });
      setSelectedConversation(username);
      setSelectedGroup(null);
    },
    [setSelectedConversation],
  );

  const openGroup = useCallback(
    (group: GroupInfo) => {
      setSelectedGroup(group);
      setConvDetails(null);
      setSelectedConversation(null);
    },
    [setSelectedConversation],
  );

  useEffect(() => {
    if (selectedConversation && currentUser) {
      if (!convDetails || convDetails.username !== selectedConversation) {
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
    } else if (!selectedGroup) {
      setConvDetails(null);
    }
  }, [selectedConversation, currentUser, identity, convDetails, selectedGroup]);

  const handleCameraFromChat = () => {
    setActiveTab("camera");
  };

  const isInGroupChat = selectedGroup !== null;
  const isInDMChat = selectedConversation !== null && convDetails !== null;

  return (
    <AnimatePresence mode="wait">
      {isInGroupChat ? (
        <motion.div
          key="group-chat"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
          className="absolute inset-0"
        >
          <GroupChatView
            group={selectedGroup}
            onBack={() => {
              setSelectedGroup(null);
            }}
          />
        </motion.div>
      ) : isInDMChat ? (
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
          <ConversationList
            onSelect={openConversation}
            onSelectGroup={openGroup}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
