import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Image,
  MessageCircle,
  Send,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  getConversationMessages,
  getConversations,
  markMessagesRead,
  sendMessage,
} from "../store";
import type { ConversationSummary, Message } from "../types";
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

function ConversationList({
  onSelect,
}: {
  onSelect: (username: string) => void;
}) {
  const { currentUser } = useApp();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const refresh = useCallback(() => {
    if (currentUser) {
      setConversations(getConversations(currentUser.username));
    }
  }, [currentUser]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#1A1A2E" }}>
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Chats</h1>
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
              Connect with friends to start chatting
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {conversations.map((conv, i) => (
            <motion.div
              key={conv.username}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelect(conv.username)}
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
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    if (currentUser) {
      const msgs = getConversationMessages(currentUser.username, username);
      setMessages(msgs);
      markMessagesRead(currentUser.username, username);
    }
  }, [currentUser, username]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Scroll to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional - scroll on message count change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!inputText.trim() || !currentUser || sending) return;
    setSending(true);
    sendMessage(currentUser, username, inputText.trim());
    setInputText("");
    refresh();
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
                  <div
                    className={`rounded-2xl overflow-hidden ${
                      isSent ? "" : "message-bubble-received"
                    }`}
                    style={
                      isSent
                        ? {
                            background:
                              "linear-gradient(135deg, #00CFFF, #0099CC)",
                          }
                        : {}
                    }
                  >
                    {msg.snapDataUrl && !msg.isEphemeral ? (
                      <img
                        src={msg.snapDataUrl}
                        alt="snap"
                        className="max-w-full rounded-2xl"
                        style={{ maxHeight: 200, objectFit: "cover" }}
                      />
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3">
                        <Camera
                          size={16}
                          color={isSent ? "white" : "#B0B0CC"}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: isSent ? "white" : "#B0B0CC" }}
                        >
                          {msg.content}
                        </span>
                      </div>
                    )}
                  </div>
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
                  className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}
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
    </div>
  );
}

export function ChatsTab() {
  const { selectedConversation, setSelectedConversation, setActiveTab } =
    useApp();
  const { currentUser } = useApp();
  const [convDetails, setConvDetails] = useState<{
    username: string;
    displayName: string;
  } | null>(null);

  useEffect(() => {
    if (selectedConversation && currentUser) {
      const convs = getConversations(currentUser.username);
      const found = convs.find((c) => c.username === selectedConversation);
      if (found) {
        setConvDetails({
          username: found.username,
          displayName: found.displayName,
        });
      } else {
        // friend but no messages yet — look up from friends
        setConvDetails({
          username: selectedConversation,
          displayName: selectedConversation,
        });
      }
    } else {
      setConvDetails(null);
    }
  }, [selectedConversation, currentUser]);

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
          <ConversationList onSelect={(u) => setSelectedConversation(u)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
