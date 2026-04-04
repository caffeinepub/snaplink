import {
  Camera,
  Check,
  Edit3,
  LogOut,
  MessageCircle,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  getFriends,
  getUserProfileCache,
  mergeWithCache,
  setCurrentUser as persistUser,
  setUserProfileCache,
} from "../store";
import type { User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

export function ProfileTab() {
  const { currentUser, logout, refreshUser } = useApp();
  const { clear: iiClear } = useInternetIdentity();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [friends, setFriends] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setBio(currentUser.bio);
      setAvatarUrl(currentUser.avatarUrl);
      setFriends(getFriends(currentUser.username));
    }
  }, [currentUser]);

  const handleSave = () => {
    if (!currentUser) return;
    setSaving(true);
    // Update profile cache
    const cacheData: Partial<User> = { displayName, bio };
    if (avatarUrl !== undefined) cacheData.avatarUrl = avatarUrl;
    setUserProfileCache(currentUser.username, cacheData);
    // Update session with new values
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
    // Clear Internet Identity session so the II identity doesn't auto-re-login
    iiClear();
    logout();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      // Immediately persist so it shows everywhere
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

  // Merge profile cache for display
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
          {/* Hidden file input */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
            data-ocid="profile.upload_button"
          />
          {/* Tappable avatar */}
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative block rounded-full focus:outline-none"
            aria-label="Change profile picture"
            style={{
              padding: 0,
              background: "transparent",
              border: "none",
            }}
          >
            {/* Gradient ring */}
            <div
              className="rounded-full p-0.5"
              style={{
                background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                boxShadow: "0 0 20px rgba(0,207,255,0.3)",
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
                />
              </div>
            </div>
            {/* Camera overlay badge */}
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

      {/* Stats */}
      <div className="mx-5 grid grid-cols-2 gap-3 mb-5">
        <div className="card-surface p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Users size={18} color="#00CFFF" />
            <span className="text-2xl font-bold text-white">
              {friends.length}
            </span>
          </div>
          <p className="text-[#B0B0CC] text-xs">Friends</p>
        </div>
        <div className="card-surface p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <MessageCircle size={18} color="#BD00FF" />
            <span className="text-2xl font-bold text-white">
              {friends.length}
            </span>
          </div>
          <p className="text-[#B0B0CC] text-xs">Conversations</p>
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
      <div className="mx-5 mb-4">
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

      {/* Friends list */}
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
          className="text-xs"
          style={{
            color: "#B0B0CC",
            opacity: 0.45,
            fontStyle: "italic",
            letterSpacing: "0.05em",
          }}
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
