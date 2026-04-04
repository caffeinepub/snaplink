import { CheckCircle, Search, UserPlus, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  getPendingRequests,
  respondToRequest,
  searchUsers,
  sendConnectionRequest,
} from "../store";
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
      <UserAvatar name={request.fromDisplayName} size={52} />
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

function FindPeopleSection() {
  const { currentUser } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (query.trim() && currentUser) {
      setResults(searchUsers(query, currentUser.id));
    } else {
      setResults([]);
    }
  }, [query, currentUser]);

  const handleSendRequest = (toUsername: string) => {
    if (!currentUser) return;
    const result = sendConnectionRequest(currentUser, toUsername);
    if ("ok" in result) {
      setSentMap((prev) => ({ ...prev, [toUsername]: true }));
    } else {
      setErrorMap((prev) => ({ ...prev, [toUsername]: result.err }));
    }
  };

  return (
    <div className="mt-6">
      <p className="text-white font-bold text-lg mb-3">Find People</p>
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2"
          color="#B0B0CC"
        />
        <input
          className="input-field pl-10"
          placeholder="Search by username or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-ocid="requests.search_input"
        />
      </div>

      <AnimatePresence>
        {results.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: i * 0.04 }}
            className="card-surface p-3.5 mt-3 flex items-center gap-3"
            data-ocid={`requests.item.${i + 1}`}
          >
            <UserAvatar name={user.displayName} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {user.displayName}
              </p>
              <p className="text-[#B0B0CC] text-xs">@{user.username}</p>
            </div>
            {sentMap[user.username] ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle size={16} color="#00CFFF" />
                <span className="text-[#00CFFF] text-xs font-medium">Sent</span>
              </div>
            ) : errorMap[user.username] ? (
              <span className="text-[#B0B0CC] text-xs">
                {errorMap[user.username]}
              </span>
            ) : (
              <PressableButton
                onClick={() => handleSendRequest(user.username)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                }}
                data-ocid="requests.primary_button"
              >
                <UserPlus size={14} />
                <span>Connect</span>
              </PressableButton>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
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
            className="flex flex-col items-center justify-center gap-3 py-10"
            data-ocid="requests.empty_state"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#1A1F33", border: "1px solid #2A3048" }}
            >
              <Users size={28} color="#B0B0CC" />
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

        <FindPeopleSection />
      </div>

      <div className="h-8" />
    </div>
  );
}
