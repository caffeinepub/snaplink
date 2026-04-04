import {
  AlertCircle,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  backendGetAllUsers,
  backendGetFriends,
  backendGetSentRequests,
  backendSendConnectionRequest,
  moProfileToUser,
} from "../backendStore";
import type { UserWithStatus } from "../backendStore";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

function UserStatusBadge({
  user,
  onAction,
}: {
  user: UserWithStatus;
  onAction: (user: User, action: "add") => void;
}) {
  if (user.connectionStatus === "friends") {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          background: "rgba(0,200,130,0.12)",
          border: "1px solid rgba(0,200,130,0.3)",
        }}
      >
        <UserCheck size={13} color="#00C882" />
        <span className="text-[#00C882] text-xs font-semibold">Friends</span>
      </div>
    );
  }

  if (user.connectionStatus === "pending_sent") {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          background: "rgba(0,207,255,0.08)",
          border: "1px solid rgba(0,207,255,0.25)",
        }}
      >
        <span className="text-[#00CFFF] text-xs font-semibold">Sent</span>
      </div>
    );
  }

  // none — show Add Friend
  return (
    <PressableButton
      onClick={() => onAction(user, "add")}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
      style={{
        background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
        boxShadow: "0 0 12px rgba(0,207,255,0.25)",
      }}
      data-ocid="requests.primary_button"
    >
      <UserPlus size={13} />
      <span>Add</span>
    </PressableButton>
  );
}

// ─── Shared data loader ───────────────────────────────────────────────────────
// Loads all users + friend/sent-request status purely from the backend.
// backendGetAllUsers now throws on failure so we can surface the error.

async function loadUsersWithStatus(
  currentUsername: string,
  identity: any,
): Promise<UserWithStatus[]> {
  // getAllUsers throws on failure — let the caller catch it
  const profiles = await backendGetAllUsers();

  // These two are best-effort; return [] on failure (don't block the list)
  const [friends, sentRequests] = await Promise.all([
    backendGetFriends(currentUsername, identity),
    backendGetSentRequests(currentUsername, identity),
  ]);

  const friendUsernames = new Set(friends.map((f) => f.username));
  const sentToUsernames = new Set(sentRequests.map((r) => r.toUser));

  return profiles
    .filter((p) => p.username !== currentUsername)
    .map((p) => {
      const u = moProfileToUser(p);
      if (friendUsernames.has(u.username)) {
        return { ...u, connectionStatus: "friends" as const };
      }
      if (sentToUsernames.has(u.username)) {
        return { ...u, connectionStatus: "pending_sent" as const };
      }
      return { ...u, connectionStatus: "none" as const };
    });
}

// ─── Unified People Section ─────────────────────────────────────────────────────

function PeopleSection() {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    try {
      const mapped = await loadUsersWithStatus(currentUser.username, identity);
      setUsers(mapped);
      setError(null);
    } catch (e) {
      const msg = String(e);
      // If it's an infrastructure error, show a clean message
      if (
        msg.includes("stopped") ||
        msg.includes("unavailable") ||
        msg.includes("cycles") ||
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("503")
      ) {
        setError(
          "Server is temporarily unavailable. Please try again in a moment.",
        );
      } else {
        setError("Could not load users. Tap retry to try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, identity]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    loadAll();
  }, [loadAll]);

  const handleAction = useCallback(
    async (user: User, action: "add") => {
      if (!currentUser || action !== "add") return;
      // Optimistically update UI
      setUsers((prev) =>
        prev.map((u) =>
          u.username === user.username
            ? { ...u, connectionStatus: "pending_sent" as const }
            : u,
        ),
      );
      await backendSendConnectionRequest(
        currentUser.username,
        user.username,
        identity,
      );
      // Refresh after a moment to sync real state
      setTimeout(loadAll, 500);
    },
    [currentUser, identity, loadAll],
  );

  const filteredUsers =
    query.trim().length > 0
      ? users.filter(
          (u) =>
            u.displayName.toLowerCase().includes(query.toLowerCase()) ||
            u.username.toLowerCase().includes(query.toLowerCase()),
        )
      : users;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} color="#BD00FF" />
        <p className="text-white font-bold text-lg">People</p>
        {!loading && !error && users.length > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(189,0,255,0.12)",
              border: "1px solid rgba(189,0,255,0.3)",
              color: "#BD00FF",
            }}
          >
            {users.length}
          </span>
        )}
      </div>

      {/* Search filter */}
      <div
        className="relative mb-4"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          color="#B0B0CC"
        />
        <input
          ref={searchInputRef}
          className="w-full bg-transparent text-white text-sm pl-10 pr-10 py-3 outline-none placeholder-[#B0B0CC]"
          placeholder="Filter by name or @username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-ocid="requests.search_input"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="Clear search"
          >
            <X size={12} color="#B0B0CC" />
          </button>
        )}
      </div>

      {query.trim().length > 0 && !error && (
        <p className="text-[#B0B0CC] text-xs font-semibold uppercase tracking-wider mb-3 px-1">
          {filteredUsers.length} result{filteredUsers.length !== 1 ? "s" : ""}{" "}
          for &quot;{query}&quot;
        </p>
      )}

      <AnimatePresence mode="popLayout">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-8 gap-3"
            data-ocid="requests.loading_state"
          >
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "#BD00FF", borderTopColor: "transparent" }}
            />
            <p className="text-[#B0B0CC] text-sm">Loading people...</p>
          </motion.div>
        )}

        {!loading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-3"
            data-ocid="requests.error_state"
          >
            <AlertCircle size={28} color="#FF4D6A" />
            <p className="text-[#B0B0CC] text-sm text-center px-4">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                boxShadow: "0 0 12px rgba(0,207,255,0.25)",
              }}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </motion.div>
        )}

        {!loading &&
          !error &&
          filteredUsers.length === 0 &&
          query.trim().length > 0 && (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-2"
            >
              <Search size={28} color="#2A3048" />
              <p className="text-[#B0B0CC] text-sm">
                No users found for &quot;{query}&quot;
              </p>
            </motion.div>
          )}

        {!loading &&
          !error &&
          users.length === 0 &&
          query.trim().length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-2"
              data-ocid="requests.empty_state"
            >
              <Users size={28} color="#2A3048" />
              <p className="text-[#B0B0CC] text-sm">No other users yet</p>
            </motion.div>
          )}

        {!loading && !error && filteredUsers.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredUsers.map((user, i) => (
              <motion.div
                key={user.username}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                data-ocid={`requests.item.${i + 1}`}
              >
                <UserAvatar
                  name={user.displayName}
                  size={46}
                  avatarUrl={user.avatarUrl}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {user.displayName}
                  </p>
                  <p className="text-[#B0B0CC] text-xs truncate">
                    @{user.username}
                  </p>
                  {user.bio && (
                    <p className="text-[#B0B0CC] text-xs mt-0.5 truncate">
                      {user.bio.slice(0, 60)}
                      {user.bio.length > 60 ? "..." : ""}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <UserStatusBadge user={user} onAction={handleAction} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RequestsTab() {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto scrollbar-hide"
      style={{ background: "#1A1A2E" }}
    >
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Requests</h1>
        <p className="text-[#B0B0CC] text-sm mt-1">Add people you know</p>
      </div>

      <div className="px-5 pb-8">
        <PeopleSection />
      </div>
    </div>
  );
}
