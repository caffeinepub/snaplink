import { Camera, MessageCircle, User, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  backendGetPendingRequestCount,
  backendGetPendingRequests,
} from "../backendStore";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { getUnreadCount } from "../store";
import type { Tab } from "../types";

interface NavItem {
  id: Tab;
  icon: React.ReactNode;
  label: string;
}

export function BottomNav() {
  const { activeTab, setActiveTab, currentUser } = useApp();
  const { identity } = useInternetIdentity();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const prevPendingCount = useRef<number>(-1);
  // Track request IDs we've already toasted to avoid duplicate notifications
  const seenRequestIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;

    const refresh = async () => {
      // Unread messages: still from local store (messages are local)
      setUnreadCount(getUnreadCount(currentUser.username));

      // Fetch both the count and the actual pending requests in parallel
      const [count, pendingRequests] = await Promise.all([
        backendGetPendingRequestCount(currentUser.username, identity),
        backendGetPendingRequests(currentUser.username, identity),
      ]);

      setPendingCount(count);

      // Find any new requests we haven't toasted yet
      if (prevPendingCount.current !== -1) {
        for (const req of pendingRequests) {
          if (!seenRequestIds.current.has(req.id)) {
            const name = req.fromDisplayName || req.fromUser;
            toast(`${name} wants to connect!`, {
              style: {
                background: "#1A1F33",
                border: "1px solid #00CFFF",
                color: "#FFFFFF",
              },
            });
          }
        }
      }

      // Mark all current requests as seen
      for (const req of pendingRequests) {
        seenRequestIds.current.add(req.id);
      }

      prevPendingCount.current = count;
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [currentUser, identity]);

  const navItems: NavItem[] = [
    { id: "chats", icon: <MessageCircle size={22} />, label: "Chats" },
    { id: "requests", icon: <Users size={22} />, label: "Requests" },
    { id: "camera", icon: <Camera size={22} />, label: "Camera" },
    { id: "profile", icon: <User size={22} />, label: "Profile" },
  ];

  const badges: Partial<Record<Tab, number>> = {
    chats: unreadCount,
    requests: pendingCount,
  };

  return (
    <nav
      className="flex items-center px-2 py-2 nav-glow"
      style={{ background: "#1A1F33", borderTop: "1px solid #2A3048" }}
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const badge = badges[item.id];
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 relative"
            aria-current={isActive ? "page" : undefined}
            data-ocid={`nav.${item.id}.link`}
          >
            <div className="relative">
              <motion.div
                animate={{
                  color: isActive ? "#00CFFF" : "#B0B0CC",
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                style={{ display: "flex" }}
              >
                {item.icon}
              </motion.div>
              {badge !== undefined && badge > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5"
                  style={{
                    background: "#FF3B3B",
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </motion.div>
              )}
            </div>
            <motion.span
              animate={{ color: isActive ? "#00CFFF" : "#B0B0CC" }}
              className="text-[10px] font-medium"
            >
              {item.label}
            </motion.span>
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -bottom-2 w-10 h-1 rounded-full"
                style={{
                  background: "linear-gradient(90deg, #00CFFF, #BD00FF)",
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
