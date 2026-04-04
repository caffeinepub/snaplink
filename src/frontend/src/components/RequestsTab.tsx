import { Search, UserCheck, UserPlus, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  backendGetAllUsers,
  backendGetPendingRequests,
  backendSendConnectionRequest,
  moProfileToUser,
} from "../backendStore";
import type { UserWithStatus as BackendUserWithStatus } from "../backendStore";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { getRequests, respondToRequest, saveRequests } from "../store";
import type { User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

function UserStatusBadge({
  user,
  onAction,
}: {
  user: BackendUserWithStatus;
  onAction: (
    user: User,
    action: "add" | "accept" | "decline",
    requestId?: string,
  ) => void;
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
        <span className="text-[#00CFFF] text-xs font-semibold">
          Request Sent
        </span>
      </div>
    );
  }

  if (user.connectionStatus === "pending_received") {
    return (
      <div className="flex items-center gap-1.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => onAction(user, "decline", user.requestId)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          aria-label="Decline request"
          data-ocid="requests.secondary_button"
        >
          <X size={14} color="#B0B0CC" />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => onAction(user, "accept", user.requestId)}
          className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
          style={{
            background: "rgba(0,207,255,0.15)",
            border: "1px solid rgba(0,207,255,0.5)",
            animation: "pulse-accept 2s ease-in-out infinite",
          }}
          data-ocid="requests.primary_button"
        >
          Accept
        </motion.button>
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

// ---- All People Section (auto-loads all registered users) ------------------

function AllPeopleSection({
  onRefreshPending,
}: { onRefreshPending: () => void }) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [users, setUsers] = useState<BackendUserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [profiles, pendingRequests] = await Promise.all([
        backendGetAllUsers(),
        backendGetPendingRequests(identity),
      ]);
      const localRequests = getRequests();

      const mapped: BackendUserWithStatus[] = profiles
        .filter((p) => p.username !== currentUser.username)
        .map((p) => {
          const u = moProfileToUser(p);

          // Incoming pending from backend
          const incomingPending = pendingRequests.find(
            (r) =>
              r.fromUser === u.username && r.toUser === currentUser.username,
          );
          if (incomingPending) {
            return {
              ...u,
              connectionStatus: "pending_received" as const,
              requestId: incomingPending.id,
            };
          }

          // Friends (accepted in local store)
          const friendReq = localRequests.find(
            (r) =>
              ((r.fromUser === currentUser.username &&
                r.toUser === u.username) ||
                (r.fromUser === u.username &&
                  r.toUser === currentUser.username)) &&
              r.status === "accepted",
          );
          if (friendReq) {
            return {
              ...u,
              connectionStatus: "friends" as const,
              requestId: friendReq.id,
            };
          }

          // Sent pending
          const sentReq = localRequests.find(
            (r) =>
              r.fromUser === currentUser.username &&
              r.toUser === u.username &&
              r.status === "pending",
          );
          if (sentReq) {
            return {
              ...u,
              connectionStatus: "pending_sent" as const,
              requestId: sentReq.id,
            };
          }

          return { ...u, connectionStatus: "none" as const };
        });

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
    async (
      user: User,
      action: "add" | "accept" | "decline",
      requestId?: string,
    ) => {
      if (!currentUser) return;

      if (action === "add") {
        await backendSendConnectionRequest(user.username, identity);
        // Optimistically update local store
        const localRequests = getRequests();
        const existing = localRequests.find(
          (r) =>
            r.fromUser === currentUser.username && r.toUser === user.username,
        );
        if (!existing) {
          localRequests.push({
            id: crypto.randomUUID(),
            fromUser: currentUser.username,
            fromDisplayName: currentUser.displayName,
            fromAvatarUrl: currentUser.avatarUrl,
            toUser: user.username,
            status: "pending",
            createdAt: Date.now(),
          });
          saveRequests(localRequests);
        }
      } else if (action === "accept" && requestId) {
        respondToRequest(requestId, true);
        onRefreshPending();
      } else if (action === "decline" && requestId) {
        respondToRequest(requestId, false);
        onRefreshPending();
      }
      setTimeout(loadAll, 200);
    },
    [currentUser, identity, loadAll, onRefreshPending],
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
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              data-ocid={`requests.all_people.item.${i + 1}`}
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
                  <p
                    className="text-[#B0B0CC] text-xs mt-0.5"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
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

// ---- Find People Section (shows all users, filters by query client-side) ---

function FindPeopleSection({
  onRefreshPending,
}: { onRefreshPending: () => void }) {
  const { currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<BackendUserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derive filtered list from allUsers + query (client-side, no extra calls)
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
      const [profiles, pendingRequests] = await Promise.all([
        backendGetAllUsers(),
        backendGetPendingRequests(identity),
      ]);
      const localRequests = getRequests();

      const mapped: BackendUserWithStatus[] = profiles
        .filter((p) => p.username !== currentUser.username)
        .map((p) => {
          const u = moProfileToUser(p);

          const incomingPending = pendingRequests.find(
            (r) =>
              r.fromUser === u.username && r.toUser === currentUser.username,
          );
          if (incomingPending) {
            return {
              ...u,
              connectionStatus: "pending_received" as const,
              requestId: incomingPending.id,
            };
          }

          const friendReq = localRequests.find(
            (r) =>
              ((r.fromUser === currentUser.username &&
                r.toUser === u.username) ||
                (r.fromUser === u.username &&
                  r.toUser === currentUser.username)) &&
              r.status === "accepted",
          );
          if (friendReq) {
            return {
              ...u,
              connectionStatus: "friends" as const,
              requestId: friendReq.id,
            };
          }

          const sentReq = localRequests.find(
            (r) =>
              r.fromUser === currentUser.username &&
              r.toUser === u.username &&
              r.status === "pending",
          );
          if (sentReq) {
            return {
              ...u,
              connectionStatus: "pending_sent" as const,
              requestId: sentReq.id,
            };
          }

          return { ...u, connectionStatus: "none" as const };
        });

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
    async (
      user: User,
      action: "add" | "accept" | "decline",
      requestId?: string,
    ) => {
      if (!currentUser) return;

      if (action === "add") {
        await backendSendConnectionRequest(user.username, identity);
        const localRequests = getRequests();
        const existing = localRequests.find(
          (r) =>
            r.fromUser === currentUser.username && r.toUser === user.username,
        );
        if (!existing) {
          localRequests.push({
            id: crypto.randomUUID(),
            fromUser: currentUser.username,
            fromDisplayName: currentUser.displayName,
            fromAvatarUrl: currentUser.avatarUrl,
            toUser: user.username,
            status: "pending",
            createdAt: Date.now(),
          });
          saveRequests(localRequests);
        }
      } else if (action === "accept" && requestId) {
        respondToRequest(requestId, true);
        onRefreshPending();
      } else if (action === "decline" && requestId) {
        respondToRequest(requestId, false);
        onRefreshPending();
      }
      setTimeout(loadAll, 200);
    },
    [currentUser, identity, loadAll, onRefreshPending],
  );

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} color="#00CFFF" />
        <p className="text-white font-bold text-lg">Find People</p>
        {!loading && allUsers.length > 0 && (
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

      {/* Search input — acts as live filter */}
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

      {/* Filter results count when searching */}
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
            data-ocid="requests.find_people.loading_state"
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
            data-ocid="requests.find_people.empty_state"
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
            data-ocid="requests.find_people.empty_state"
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
                transition={{ delay: i * 0.03 }}
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
                    <p
                      className="text-[#B0B0CC] text-xs mt-0.5 leading-relaxed"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        maxWidth: "100%",
                      }}
                    >
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

      <style>{`
        @keyframes pulse-accept {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,207,255,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(0,207,255,0.0); }
        }
      `}</style>
    </div>
  );
}

export function RequestsTab() {
  const refresh = useCallback(() => {}, []);

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
        <AllPeopleSection onRefreshPending={refresh} />
        <FindPeopleSection onRefreshPending={refresh} />
      </div>

      <div className="h-8" />
    </div>
  );
}
