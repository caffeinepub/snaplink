import {
  CheckCircle,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { backendSearchUsers, moProfileToUser } from "../backendStore";
import type { UserWithStatus as BackendUserWithStatus } from "../backendStore";
import { useApp } from "../context/AppContext";
import {
  getPendingRequests,
  getRequests,
  respondToRequest,
  searchUsersWithStatus,
  sendConnectionRequest,
} from "../store";
import type { UserWithStatus } from "../store";
import type { ConnectionRequest, User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

function RequestCard({
  request,
  onRespond,
}: {
  request: ConnectionRequest;
  onRespond: (id: string, accept: boolean) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  const handleAccept = () => {
    setAccepted(true);
    onRespond(request.id, true);
  };

  const handleDecline = () => {
    setDeclined(true);
    onRespond(request.id, false);
  };

  if (declined) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      className="card-surface p-4 flex items-center gap-4"
    >
      <UserAvatar
        name={request.fromDisplayName}
        size={52}
        avatarUrl={request.fromAvatarUrl}
      />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-[15px] truncate">
          {request.fromDisplayName}
        </p>
        <p className="text-[#B0B0CC] text-sm">@{request.fromUser}</p>
      </div>

      <AnimatePresence mode="wait">
        {accepted ? (
          <motion.div
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00CFFF, #00AA88)" }}
          >
            <CheckCircle size={20} color="white" />
          </motion.div>
        ) : (
          <motion.div key="buttons" className="flex gap-2">
            <PressableButton
              onClick={handleDecline}
              className="px-4 py-2 rounded-full text-sm font-semibold btn-decline"
              data-ocid="requests.secondary_button"
            >
              Decline
            </PressableButton>
            <PressableButton
              onClick={handleAccept}
              className="px-4 py-2 rounded-full text-sm font-bold btn-glow-blue text-white"
              data-ocid="requests.primary_button"
            >
              Accept
            </PressableButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function UserStatusBadge({
  user,
  onAction,
}: {
  user: UserWithStatus | BackendUserWithStatus;
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

function FindPeopleSection({
  onRefreshPending,
}: { onRefreshPending: () => void }) {
  const { currentUser } = useApp();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<
    (UserWithStatus | BackendUserWithStatus)[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const hasQuery = query.trim().length > 0;

  const doSearch = useCallback(
    async (q: string) => {
      if (!currentUser || !q.trim()) return;
      abortRef.current = false;
      setIsSearching(true);
      try {
        // First try the canister search (shows users from all devices)
        const profiles = await backendSearchUsers(q.trim());
        if (abortRef.current) return;

        if (profiles.length > 0) {
          const requests = getRequests();
          const mapped: BackendUserWithStatus[] = profiles
            .filter((p) => p.username !== currentUser.username)
            .map((p) => {
              const u = moProfileToUser(p);
              const friendReq = requests.find(
                (r) =>
                  ((r.fromUser === currentUser.username &&
                    r.toUser === u.username) ||
                    (r.fromUser === u.username &&
                      r.toUser === currentUser.username)) &&
                  r.status === "accepted",
              );
              if (friendReq)
                return {
                  ...u,
                  connectionStatus: "friends" as const,
                  requestId: friendReq.id,
                };

              const sentReq = requests.find(
                (r) =>
                  r.fromUser === currentUser.username &&
                  r.toUser === u.username &&
                  r.status === "pending",
              );
              if (sentReq)
                return {
                  ...u,
                  connectionStatus: "pending_sent" as const,
                  requestId: sentReq.id,
                };

              const receivedReq = requests.find(
                (r) =>
                  r.fromUser === u.username &&
                  r.toUser === currentUser.username &&
                  r.status === "pending",
              );
              if (receivedReq)
                return {
                  ...u,
                  connectionStatus: "pending_received" as const,
                  requestId: receivedReq.id,
                };

              return { ...u, connectionStatus: "none" as const };
            });
          setUsers(mapped);
        } else {
          // Fallback to localStorage search
          const localResults = searchUsersWithStatus(q, currentUser);
          setUsers(localResults);
        }
      } catch {
        // Fallback to localStorage on error
        const localResults = searchUsersWithStatus(q, currentUser);
        setUsers(localResults);
      } finally {
        setIsSearching(false);
      }
    },
    [currentUser],
  );

  // Run search when query changes (debounced)
  useEffect(() => {
    if (!hasQuery) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(() => {
      doSearch(query);
    }, 300);
    return () => {
      clearTimeout(timer);
      abortRef.current = true;
    };
  }, [query, hasQuery, doSearch]);

  // Poll every 4 seconds while search query is active
  useEffect(() => {
    if (!hasQuery) return;
    const interval = setInterval(() => doSearch(query), 4000);
    return () => clearInterval(interval);
  }, [hasQuery, query, doSearch]);

  const handleAction = useCallback(
    (user: User, action: "add" | "accept" | "decline", requestId?: string) => {
      if (!currentUser) return;

      if (action === "add") {
        sendConnectionRequest(currentUser, user.username);
      } else if (action === "accept" && requestId) {
        respondToRequest(requestId, true);
        onRefreshPending();
      } else if (action === "decline" && requestId) {
        respondToRequest(requestId, false);
        onRefreshPending();
      }
      // Refresh the list shortly after
      setTimeout(() => doSearch(query), 100);
    },
    [currentUser, doSearch, query, onRefreshPending],
  );

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} color="#00CFFF" />
        <p className="text-white font-bold text-lg">Find People</p>
      </div>

      {/* Search input */}
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
          placeholder="Search by name or @username..."
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

      {/* Result count label */}
      {hasQuery && users.length > 0 && (
        <p className="text-[#B0B0CC] text-xs font-semibold uppercase tracking-wider mb-3 px-1">
          {users.length} result{users.length !== 1 ? "s" : ""} for &quot;{query}
          &quot;
        </p>
      )}

      {/* Content area */}
      <AnimatePresence mode="popLayout">
        {/* Empty state — no query typed yet */}
        {!hasQuery && (
          <motion.div
            key="search-prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center justify-center py-10 gap-4"
            data-ocid="requests.empty_state"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,207,255,0.12), rgba(189,0,255,0.12))",
                border: "1px solid rgba(0,207,255,0.18)",
              }}
            >
              <Search size={26} color="#00CFFF" />
            </div>
            <div className="text-center px-4">
              <p className="text-white font-semibold text-sm mb-1">
                Find your people
              </p>
              <p className="text-[#B0B0CC] text-xs leading-relaxed">
                Search by name or @username to find people and send friend
                requests
              </p>
            </div>
          </motion.div>
        )}

        {/* Searching indicator */}
        {hasQuery && isSearching && users.length === 0 && (
          <motion.div
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-2"
          >
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#00CFFF", borderTopColor: "transparent" }}
            />
            <p className="text-[#B0B0CC] text-sm">Searching...</p>
          </motion.div>
        )}

        {/* No results for active query */}
        {hasQuery && !isSearching && users.length === 0 && (
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

        {/* Search results */}
        {hasQuery && users.length > 0 && (
          <div className="flex flex-col gap-2">
            {users.map((user, i) => (
              <motion.div
                key={user.username}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
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
  const { currentUser } = useApp();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);

  const refresh = useCallback(() => {
    if (currentUser) {
      setRequests(getPendingRequests(currentUser.username));
    }
  }, [currentUser]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRespond = (id: string, accept: boolean) => {
    respondToRequest(id, accept);
    setTimeout(refresh, 800);
  };

  return (
    <div
      className="flex flex-col h-full overflow-y-auto scrollbar-hide"
      style={{ background: "#1A1A2E" }}
    >
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Requests</h1>
          {requests.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
              }}
            >
              {requests.length}
            </motion.div>
          )}
        </div>
        <p className="text-[#B0B0CC] text-sm mt-1">
          {requests.length > 0
            ? `${requests.length} pending request${requests.length > 1 ? "s" : ""}`
            : "No pending requests"}
        </p>
      </div>

      <div className="px-5 flex flex-col gap-3">
        {requests.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-6"
            data-ocid="requests.empty_state"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "#1A1F33", border: "1px solid #2A3048" }}
            >
              <Users size={24} color="#B0B0CC" />
            </div>
            <p className="text-[#B0B0CC] text-sm">No pending requests</p>
          </div>
        ) : (
          <AnimatePresence>
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onRespond={handleRespond}
              />
            ))}
          </AnimatePresence>
        )}

        <FindPeopleSection onRefreshPending={refresh} />
      </div>

      <div className="h-8" />
    </div>
  );
}
