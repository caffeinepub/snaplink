import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Camera,
  Check,
  Edit3,
  Eye,
  EyeOff,
  Ghost,
  LogOut,
  MessageCircle,
  Star,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  backendClearAllData,
  backendGetConversations,
  backendGetFriends,
  backendGetReadReceiptsEnabled,
  backendGetSnapScore,
  backendIsGhostMode,
  backendRecordDailyLogin,
  backendSetGhostMode,
  backendSetReadReceiptsEnabled,
} from "../backendStore";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  getUserProfileCache,
  setCurrentUser as persistUser,
  setUserProfileCache,
} from "../store";
import type { User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

const MOODS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😎", label: "Chill" },
  { emoji: "🔥", label: "Busy" },
  { emoji: "😴", label: "Tired" },
  { emoji: "🎉", label: "Excited" },
  { emoji: "💪", label: "Focused" },
];

export function ProfileTab() {
  const { currentUser, logout, refreshUser } = useApp();
  const { identity, clear: iiClear } = useInternetIdentity();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [friends, setFriends] = useState<User[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [snapScore, setSnapScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [bestFriends, setBestFriends] = useState<User[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Privacy settings
  const [ghostMode, setGhostMode] = useState(false);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const [ghostLoading, setGhostLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Clear all data state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setBio(currentUser.bio);
      setAvatarUrl(currentUser.avatarUrl);
      // Load mood from localStorage
      const savedMood = localStorage.getItem(
        `moodStatus_${currentUser.username}`,
      );
      if (savedMood) setSelectedMood(savedMood);
    }
  }, [currentUser]);

  // Load friends, conversations, snap score, and privacy settings from backend
  useEffect(() => {
    if (!currentUser) return;
    const refresh = async () => {
      const [f, convs, score] = await Promise.all([
        backendGetFriends(currentUser.username, identity ?? undefined).catch(
          () => [] as User[],
        ),
        backendGetConversations(
          currentUser.username,
          identity ?? undefined,
        ).catch(() => []),
        backendGetSnapScore(currentUser.username, identity ?? undefined).catch(
          () => 0,
        ),
      ]);
      setFriends(f);
      setConversationCount(convs.length);
      setSnapScore(score);

      const friendUsernames = new Set(f.map((fr: User) => fr.username));
      const friendConvs = convs
        .filter((c: any) => friendUsernames.has(String(c.username)))
        .sort((a: any, b: any) => {
          const ta =
            typeof a.lastMessageTimestamp === "bigint"
              ? Number(a.lastMessageTimestamp) / 1_000_000
              : Number(a.lastMessageTimestamp ?? 0);
          const tb =
            typeof b.lastMessageTimestamp === "bigint"
              ? Number(b.lastMessageTimestamp) / 1_000_000
              : Number(b.lastMessageTimestamp ?? 0);
          return tb - ta;
        })
        .slice(0, 3);
      const top3 = friendConvs
        .map((c: any) =>
          f.find((fr: User) => fr.username === String(c.username)),
        )
        .filter(Boolean) as User[];
      setBestFriends(top3);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [currentUser, identity]);

  // Load privacy settings once on mount
  useEffect(() => {
    if (!currentUser) return;
    const loadPrivacy = async () => {
      const [ghost, receipts] = await Promise.all([
        backendIsGhostMode(currentUser.username).catch(() => false),
        backendGetReadReceiptsEnabled(currentUser.username).catch(() => true),
      ]);
      setGhostMode(ghost);
      setReadReceiptsEnabled(receipts);
    };
    loadPrivacy();
  }, [currentUser]);

  // Record daily login bonus once on mount
  useEffect(() => {
    if (!currentUser) return;
    backendRecordDailyLogin(currentUser.username, identity ?? undefined)
      .then((pts) => {
        if (pts > 0) {
          toast.success(`🎯 +${pts} daily login bonus!`);
        }
      })
      .catch(() => {});
  }, [currentUser, identity]);

  const handleToggleGhostMode = async (val: boolean) => {
    if (!currentUser || ghostLoading) return;
    setGhostLoading(true);
    setGhostMode(val);
    await backendSetGhostMode(
      currentUser.username,
      val,
      identity ?? undefined,
    ).catch(() => {});
    setGhostLoading(false);
  };

  const handleToggleReadReceipts = async (val: boolean) => {
    if (!currentUser || receiptLoading) return;
    setReceiptLoading(true);
    setReadReceiptsEnabled(val);
    await backendSetReadReceiptsEnabled(
      currentUser.username,
      val,
      identity ?? undefined,
    ).catch(() => {});
    setReceiptLoading(false);
  };

  const handleMoodSelect = (emoji: string) => {
    if (!currentUser) return;
    const newMood = selectedMood === emoji ? null : emoji;
    setSelectedMood(newMood);
    if (newMood) {
      localStorage.setItem(`moodStatus_${currentUser.username}`, newMood);
    } else {
      localStorage.removeItem(`moodStatus_${currentUser.username}`);
    }
  };

  const handleSave = () => {
    if (!currentUser) return;
    setSaving(true);
    const cacheData: Partial<User> = { displayName, bio };
    if (avatarUrl !== undefined) cacheData.avatarUrl = avatarUrl;
    setUserProfileCache(currentUser.username, cacheData);
    const updated: User = {
      ...currentUser,
      displayName,
      bio,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    };
    persistUser(updated);
    refreshUser();
    setSaving(false);
    setEditing(false);
  };

  const handleLogout = () => {
    iiClear();
    logout();
  };

  const handleClearAllData = async () => {
    setClearing(true);
    setClearError(null);
    const result = await backendClearAllData();
    setClearing(false);
    if ("ok" in result) {
      iiClear();
      logout();
    } else {
      setClearError(result.err);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      setUserProfileCache(currentUser.username, { avatarUrl: dataUrl });
      const updated: User = { ...currentUser, avatarUrl: dataUrl };
      persistUser(updated);
      refreshUser();
    };
    reader.readAsDataURL(file);
  };

  if (!currentUser) return null;

  const nameId = "profile-display-name";
  const bioId = "profile-bio";

  const cache = getUserProfileCache();
  const cachedAvatar = cache[currentUser.username]?.avatarUrl ?? avatarUrl;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto scrollbar-hide"
      style={{ background: "#1A1A2E" }}
    >
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <PressableButton
          onClick={editing ? handleSave : () => setEditing(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
          style={{
            background: editing
              ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
              : "#1A1F33",
            border: editing ? "none" : "1px solid #2A3048",
            color: "white",
          }}
          data-ocid="profile.edit_button"
        >
          {editing ? (
            <>
              {saving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save</span>
                </>
              )}
            </>
          ) : (
            <>
              <Edit3 size={14} />
              <span>Edit</span>
            </>
          )}
        </PressableButton>
      </div>

      {/* Avatar & info */}
      <div className="flex flex-col items-center pt-4 pb-6 px-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-4 relative"
        >
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
            data-ocid="profile.upload_button"
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative block rounded-full focus:outline-none"
            aria-label="Change profile picture"
            style={{ padding: 0, background: "transparent", border: "none" }}
          >
            <div
              className="rounded-full p-0.5"
              style={{
                background: ghostMode
                  ? "linear-gradient(135deg, #555, #999)"
                  : "linear-gradient(135deg, #00CFFF, #BD00FF)",
                boxShadow: ghostMode
                  ? "0 0 28px rgba(150,150,150,0.35)"
                  : "0 0 28px rgba(0,207,255,0.45), 0 0 8px rgba(189,0,255,0.2)",
              }}
            >
              <div
                className="rounded-full overflow-hidden"
                style={{ width: 90, height: 90, background: "#1A1F33" }}
              >
                <UserAvatar
                  name={currentUser.displayName}
                  size={90}
                  avatarUrl={cachedAvatar}
                  moodEmoji={selectedMood ?? undefined}
                />
              </div>
            </div>
            <div
              className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "#1A1F33",
                border: "2px solid #1A1A2E",
                boxShadow: "0 0 8px rgba(0,207,255,0.4)",
              }}
            >
              <Camera size={14} color="#00CFFF" />
            </div>
          </button>
          {ghostMode && (
            <div
              className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(40,40,60,0.95)",
                border: "2px solid #1A1A2E",
              }}
            >
              <Ghost size={13} color="#B0B0CC" />
            </div>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full flex flex-col gap-3"
            >
              <div>
                <label
                  htmlFor={nameId}
                  className="text-[#B0B0CC] text-xs font-medium mb-1.5 block ml-1"
                >
                  Display Name
                </label>
                <input
                  id={nameId}
                  className="input-field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-ocid="profile.input"
                />
              </div>
              <div>
                <label
                  htmlFor={bioId}
                  className="text-[#B0B0CC] text-xs font-medium mb-1.5 block ml-1"
                >
                  Bio
                </label>
                <textarea
                  id={bioId}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Tell people about yourself..."
                  value={bio}
                  maxLength={150}
                  onChange={(e) => setBio(e.target.value)}
                  data-ocid="profile.textarea"
                />
                <p
                  className="text-xs mt-1 ml-1 text-right"
                  style={{ color: bio.length >= 130 ? "#FF6B6B" : "#B0B0CC" }}
                >
                  {bio.length}/150
                </p>
              </div>
              <PressableButton
                onClick={() => {
                  setEditing(false);
                  setDisplayName(currentUser.displayName);
                  setBio(currentUser.bio);
                  setAvatarUrl(currentUser.avatarUrl);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm"
                style={{
                  background: "rgba(189,0,255,0.12)",
                  border: "1px solid rgba(189,0,255,0.3)",
                  color: "#BD00FF",
                }}
                data-ocid="profile.cancel_button"
              >
                <X size={14} />
                Cancel
              </PressableButton>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold text-white">
                {currentUser.displayName}
                {selectedMood && (
                  <span className="ml-2 text-2xl">{selectedMood}</span>
                )}
              </h2>
              <p className="text-[#B0B0CC] text-sm mt-0.5">
                @{currentUser.username}
              </p>
              {currentUser.bio ? (
                <p className="text-[#B0B0CC] text-sm mt-3 max-w-xs">
                  {currentUser.bio}
                </p>
              ) : (
                <p className="text-[#B0B0CC]/50 text-sm mt-3 italic">
                  No bio yet
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats - gradient tint cards */}
      <div className="mx-5 grid grid-cols-3 gap-3 mb-2">
        <div
          className="card-surface p-4 flex flex-col items-center gap-1"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,207,255,0.08), rgba(0,207,255,0.03))",
            border: "1px solid rgba(0,207,255,0.15)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <Users size={18} color="#00CFFF" />
            <motion.span
              key={friends.length}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-white"
            >
              {friends.length}
            </motion.span>
          </div>
          <p className="text-[#B0B0CC] text-xs">Friends</p>
        </div>
        <div
          className="card-surface p-4 flex flex-col items-center gap-1"
          style={{
            background:
              "linear-gradient(135deg, rgba(189,0,255,0.08), rgba(189,0,255,0.03))",
            border: "1px solid rgba(189,0,255,0.15)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <MessageCircle size={18} color="#BD00FF" />
            <motion.span
              key={conversationCount}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-white"
            >
              {conversationCount}
            </motion.span>
          </div>
          <p className="text-[#B0B0CC] text-xs">Chats</p>
        </div>
        <div
          className="card-surface p-4 flex flex-col items-center gap-1"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,170,0,0.08), rgba(255,170,0,0.03))",
            border: "1px solid rgba(255,170,0,0.15)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <Star size={18} color="#FFAA00" />
            <motion.span
              key={snapScore}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-white"
            >
              {snapScore}
            </motion.span>
          </div>
          <p className="text-[#B0B0CC] text-xs">Score</p>
        </div>
      </div>

      {/* Snap Score breakdown */}
      <div className="mx-5 mb-5">
        <p className="text-[#B0B0CC] text-[10px] text-center mt-1.5">
          🏅 +10 per snap • 🔥 +5 streak • 📅 +2 daily login
        </p>
      </div>

      {/* Mood Status */}
      <div className="mx-5 mb-5">
        <p className="text-[#B0B0CC] text-xs font-medium uppercase tracking-widest mb-3">
          Mood Status
        </p>
        <div className="grid grid-cols-3 gap-2">
          {MOODS.map((mood) => {
            const isSelected = selectedMood === mood.emoji;
            return (
              <motion.button
                key={mood.emoji}
                type="button"
                onClick={() => handleMoodSelect(mood.emoji)}
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-1 py-3 rounded-2xl text-center"
                style={{
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(0,207,255,0.15), rgba(189,0,255,0.1))"
                    : "rgba(26,31,51,0.6)",
                  border: isSelected
                    ? "1.5px solid rgba(0,207,255,0.5)"
                    : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isSelected
                    ? "0 0 12px rgba(0,207,255,0.2)"
                    : "none",
                }}
                data-ocid="profile.toggle"
              >
                <span className="text-xl">{mood.emoji}</span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isSelected ? "#00CFFF" : "#B0B0CC" }}
                >
                  {mood.label}
                </span>
              </motion.button>
            );
          })}
        </div>
        {selectedMood && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs mt-2"
            style={{ color: "#00CFFF" }}
          >
            {selectedMood} Mood active — visible to your friends
          </motion.p>
        )}
      </div>

      {/* Best Friends */}
      {bestFriends.length > 0 && (
        <div className="mx-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} color="#FFAA00" />
            <p className="text-white font-bold text-base">Best Friends ⭐</p>
          </div>
          <div className="flex flex-col gap-2">
            {bestFriends.map((friend, i) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card-surface p-3.5 flex items-center gap-3"
                style={{
                  background: "rgba(255,170,0,0.06)",
                  border: "1px solid rgba(255,170,0,0.2)",
                }}
                data-ocid={`profile.item.${i + 1}`}
              >
                <div className="relative">
                  <UserAvatar
                    name={friend.displayName}
                    size={40}
                    avatarUrl={friend.avatarUrl}
                  />
                  <span
                    className="absolute -top-1 -right-1 text-xs"
                    aria-label="Best friend"
                  >
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">
                    {friend.displayName}
                  </p>
                  <p className="text-[#B0B0CC] text-xs">@{friend.username}</p>
                </div>
                <Star size={14} color="#FFAA00" fill="#FFAA00" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Settings */}
      <div className="mx-5 mb-5">
        <p className="text-[#B0B0CC] text-xs font-medium uppercase tracking-widest mb-3">
          Privacy Settings
        </p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#1A1F33", border: "1px solid #2A3048" }}
        >
          {/* Ghost Mode */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: ghostMode
                    ? "rgba(150,150,200,0.15)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <Ghost size={18} color={ghostMode ? "#B0B0FF" : "#B0B0CC"} />
              </div>
              <div>
                <Label
                  htmlFor="ghost-mode-switch"
                  className="text-white text-sm font-semibold cursor-pointer"
                >
                  Ghost Mode
                </Label>
                <p className="text-[#B0B0CC] text-xs mt-0.5">
                  Hide your online status from friends
                </p>
              </div>
            </div>
            <Switch
              id="ghost-mode-switch"
              checked={ghostMode}
              onCheckedChange={handleToggleGhostMode}
              disabled={ghostLoading}
              data-ocid="profile.switch"
            />
          </div>

          <div
            style={{
              height: 1,
              background: "rgba(42,48,72,0.7)",
              margin: "0 16px",
            }}
          />

          {/* Read Receipts */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: readReceiptsEnabled
                    ? "rgba(0,207,255,0.1)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                {readReceiptsEnabled ? (
                  <Eye size={18} color="#00CFFF" />
                ) : (
                  <EyeOff size={18} color="#B0B0CC" />
                )}
              </div>
              <div>
                <Label
                  htmlFor="read-receipts-switch"
                  className="text-white text-sm font-semibold cursor-pointer"
                >
                  Read Receipts
                </Label>
                <p className="text-[#B0B0CC] text-xs mt-0.5">
                  Let friends know when you've read their messages
                </p>
              </div>
            </div>
            <Switch
              id="read-receipts-switch"
              checked={readReceiptsEnabled}
              onCheckedChange={handleToggleReadReceipts}
              disabled={receiptLoading}
              data-ocid="profile.switch"
            />
          </div>
        </div>
      </div>

      {/* Auth info */}
      <div className="mx-5 card-surface p-4 mb-4">
        <p className="text-[#B0B0CC] text-xs font-medium uppercase tracking-widest mb-3">
          Account
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[#B0B0CC] text-sm">Authentication</span>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: currentUser.useII
                ? "rgba(0,207,255,0.15)"
                : "rgba(189,0,255,0.15)",
              color: currentUser.useII ? "#00CFFF" : "#BD00FF",
            }}
          >
            {currentUser.useII ? "Internet Identity" : "Username/Password"}
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[#B0B0CC] text-sm">Member since</span>
          <span className="text-[#B0B0CC] text-sm">
            {new Date(currentUser.createdAt).toLocaleDateString([], {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Logout */}
      <div className="mx-5 mb-3">
        <PressableButton
          onClick={handleLogout}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1.5px solid rgba(239,68,68,0.35)",
            color: "#FF6B6B",
          }}
          data-ocid="profile.delete_button"
        >
          <LogOut size={16} />
          Sign Out
        </PressableButton>
      </div>

      {/* Clear All Data */}
      <div className="mx-5 mb-4">
        <PressableButton
          onClick={() => {
            setShowClearConfirm((prev) => !prev);
            setClearError(null);
          }}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{
            background: showClearConfirm
              ? "rgba(255,59,48,0.18)"
              : "rgba(255,59,48,0.08)",
            border: "1.5px solid rgba(255,59,48,0.4)",
            color: "#FF3B30",
          }}
          data-ocid="profile.open_modal_button"
        >
          <Trash2 size={16} />
          Clear All Data
        </PressableButton>

        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
              data-ocid="profile.dialog"
            >
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,59,48,0.07)",
                  border: "1.5px solid rgba(255,59,48,0.3)",
                }}
              >
                <div className="flex items-start gap-2.5 mb-3">
                  <Trash2
                    size={15}
                    style={{ color: "#FF3B30", flexShrink: 0, marginTop: 1 }}
                  />
                  <p
                    className="text-sm leading-snug"
                    style={{ color: "#FFB3B0" }}
                  >
                    This will delete{" "}
                    <span className="font-bold text-white">
                      ALL users, messages, and connections.
                    </span>{" "}
                    This cannot be undone.
                  </p>
                </div>

                {clearError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs mb-3 px-1"
                    style={{ color: "#FF6B6B" }}
                    data-ocid="profile.error_state"
                  >
                    {clearError}
                  </motion.p>
                )}

                <div className="flex gap-2">
                  <PressableButton
                    onClick={() => {
                      setShowClearConfirm(false);
                      setClearError(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#B0B0CC",
                    }}
                    data-ocid="profile.cancel_button"
                  >
                    Cancel
                  </PressableButton>
                  <PressableButton
                    onClick={handleClearAllData}
                    disabled={clearing}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
                    style={{
                      background: clearing
                        ? "rgba(255,59,48,0.3)"
                        : "rgba(255,59,48,0.85)",
                      border: "none",
                      color: "white",
                      opacity: clearing ? 0.7 : 1,
                    }}
                    data-ocid="profile.confirm_button"
                  >
                    {clearing ? (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{
                          duration: 1,
                          repeat: Number.POSITIVE_INFINITY,
                        }}
                      >
                        Clearing...
                      </motion.span>
                    ) : (
                      <>Yes, Delete Everything</>
                    )}
                  </PressableButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* All Friends list */}
      {friends.length > 0 && (
        <div className="mx-5 mb-5">
          <p className="text-white font-bold text-base mb-3">
            Friends ({friends.length})
          </p>
          <div className="flex flex-col gap-2">
            {friends.map((friend, i) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-surface p-3.5 flex items-center gap-3"
                data-ocid={`profile.item.${i + 1}`}
              >
                <UserAvatar
                  name={friend.displayName}
                  size={40}
                  avatarUrl={friend.avatarUrl}
                />
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">
                    {friend.displayName}
                  </p>
                  <p className="text-[#B0B0CC] text-xs">@{friend.username}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Footer branding */}
      <div className="mt-auto pb-8 pt-2 flex flex-col items-center gap-1">
        <p
          className="text-gradient text-xs font-semibold"
          style={{ letterSpacing: "0.05em", fontSize: "13px" }}
        >
          Made by Deepak Chahal
        </p>
        <p className="text-xs" style={{ color: "#B0B0CC", opacity: 0.3 }}>
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#B0B0CC" }}
          >
            Built with caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
