import { Search, UserCheck, UserPlus, Users, X } from "lucide-react";
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
// Loads all users + friend/sent-request status purely from the backend

async function loadUsersWithStatus(
  currentUsername: string,
  identity: any,
): Promise<UserWithStatus[]> {
  const [profiles, friends, sentRequests] = await Promise.all([
    backendGetAllUsers(),
    backendGetFriends(identity),
    backendGetSentRequests(identity),
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

// ---- All People Section ─────────────────────────────────────────────────────

function AllPeopleSection() {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    try {
      const mapped = await loadUsersWithStatus(currentUser.username, identity);
      setUsers(mapped);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, identity]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
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
      await backendSendConnectionRequest(user.username, identity);
      // Refresh after a moment to sync real state
      setTimeout(loadAll, 500);
    },
    [currentUser, identity, loadAll],
  );

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} color="#BD00FF" />
        <p className="text-white font-bold text-lg">All People</p>
        {!loading && users.length > 0 && (
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

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-3">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: "#BD00FF", borderTopColor: "transparent" }}
          />
          <p className="text-[#B0B0CC] text-sm">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Users size={28} color="#2A3048" />
          <p className="text-[#B0B0CC] text-sm">No other users yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user, i) => (
            <motion.div
              key={user.username}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
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
    </div>
  );
}

// ---- Find People Section ─────────────────────────────────────────────────────

function FindPeopleSection() {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredUsers =
    query.trim().length > 0
      ? allUsers.filter(
          (u) =>
            u.displayName.toLowerCase().includes(query.toLowerCase()) ||
            u.username.toLowerCase().includes(query.toLowerCase()),
        )
      : allUsers;

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    try {
      const mapped = await loadUsersWithStatus(currentUser.username, identity);
      setAllUsers(mapped);
    } catch {
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, identity]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleAction = useCallback(
    async (user: User, action: "add") => {
      if (!currentUser || action !== "add") return;
      // Optimistically update UI
      setAllUsers((prev) =>
        prev.map((u) =>
          u.username === user.username
            ? { ...u, connectionStatus: "pending_sent" as const }
            : u,
        ),
      );
      await backendSendConnectionRequest(user.username, identity);
      setTimeout(loadAll, 500);
    },
    [currentUser, identity, loadAll],
  );

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} color="#00CFFF" />
        <p className="text-white font-bold text-lg">Find People</p>
        {!loading && filteredUsers.length > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(0,207,255,0.10)",
              border: "1px solid rgba(0,207,255,0.25)",
              color: "#00CFFF",
            }}
          >
            {filteredUsers.length}
          </span>
        )}
      </div>

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

      {query.trim().length > 0 && (
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
          >
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "#00CFFF", borderTopColor: "transparent" }}
            />
            <p className="text-[#B0B0CC] text-sm">Loading people...</p>
          </motion.div>
        )}

        {!loading && filteredUsers.length === 0 && query.trim().length > 0 && (
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

        {!loading && allUsers.length === 0 && query.trim().length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-2"
          >
            <Users size={28} color="#2A3048" />
            <p className="text-[#B0B0CC] text-sm">No other users yet</p>
          </motion.div>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredUsers.map((user, i) => (
              <motion.div
                key={user.username}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ delay: i * 0.02 }}
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

      <div className="px-5 flex flex-col gap-3">
        <AllPeopleSection />
        <FindPeopleSection />
      </div>

      <div className="h-8" />
    </div>
  );
}
