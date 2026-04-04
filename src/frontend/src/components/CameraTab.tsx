import {
  ChevronDown,
  Clock,
  Send,
  SwitchCamera,
  Upload,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "../camera/useCamera";
import { useApp } from "../context/AppContext";
import { getFriends, sendSnap } from "../store";
import type { User } from "../types";
import { PressableButton, UserAvatar } from "./Shared";

type CameraState = "viewfinder" | "preview";

function SnapTimer({
  duration,
  onExpire,
}: { duration: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [duration, onExpire]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / duration;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 48, height: 48 }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        aria-label={`${Math.ceil(remaining)} seconds remaining`}
      >
        <title>{Math.ceil(remaining)} seconds remaining</title>
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="rgba(0,0,0,0.5)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={
            progress > 0.5 ? "#00CFFF" : progress > 0.25 ? "#FFAA00" : "#FF4444"
          }
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 24 24)"
          style={{
            transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease",
          }}
        />
      </svg>
      <span
        className="absolute text-sm font-bold"
        style={{
          color:
            progress > 0.5
              ? "#00CFFF"
              : progress > 0.25
                ? "#FFAA00"
                : "#FF4444",
        }}
      >
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}

function FriendPicker({
  friends,
  selectedFriends,
  onToggle,
}: {
  friends: User[];
  selectedFriends: string[];
  onToggle: (username: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {friends.map((friend) => {
        const selected = selectedFriends.includes(friend.username);
        return (
          <motion.button
            type="button"
            key={friend.username}
            whileTap={{ scale: 0.92 }}
            onClick={() => onToggle(friend.username)}
            className="flex flex-col items-center gap-1"
            data-ocid="camera.toggle"
          >
            <div className="relative">
              <UserAvatar name={friend.displayName} size={52} />
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 5l2.5 2.5L8 2.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </motion.div>
              )}
            </div>
            <span
              className="text-xs"
              style={{
                color: selected ? "#00CFFF" : "#B0B0CC",
                maxWidth: 60,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {friend.displayName.split(" ")[0]}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function CameraTab() {
  const { currentUser, setActiveTab, setSelectedConversation } = useApp();
  const [cameraState, setCameraState] = useState<CameraState>("viewfinder");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(true);
  const [timerDuration, setTimerDuration] = useState(5);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isActive,
    isLoading,
    error,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    isSupported,
  } = useCamera({ facingMode: "environment", quality: 0.85 });

  useEffect(() => {
    if (currentUser) {
      setFriends(getFriends(currentUser.username));
    }
  }, [currentUser]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const handleCapture = async () => {
    const file = await capturePhoto();
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
      setCameraState("preview");
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
      setCameraState("preview");
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleToggleFriend = (username: string) => {
    setSelectedFriends((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  };

  const handleSendSnap = async () => {
    if (!currentUser || !capturedImage || selectedFriends.length === 0) return;
    setSending(true);
    try {
      for (const friend of selectedFriends) {
        sendSnap(currentUser, friend, capturedImage, isEphemeral, !isEphemeral);
      }
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setCapturedImage(null);
        setCameraState("viewfinder");
        setSelectedFriends([]);
        startCamera();
        if (selectedFriends.length === 1) {
          setSelectedConversation(selectedFriends[0]);
          setActiveTab("chats");
        } else {
          setActiveTab("chats");
        }
      }, 1000);
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    setCapturedImage(null);
    setCameraState("viewfinder");
    setSelectedFriends([]);
    startCamera();
  };

  const handleNoExpiry = () => {};

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden"
      style={{ background: "#000000" }}
    >
      <AnimatePresence mode="wait">
        {cameraState === "viewfinder" ? (
          <motion.div
            key="viewfinder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex-1 flex flex-col"
          >
            <div className="relative flex-1 overflow-hidden">
              {isSupported === false ? (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "#1A1A2E" }}
                >
                  <p className="text-[#B0B0CC] text-center px-8">
                    Camera not supported on this device
                  </p>
                </div>
              ) : error ? (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-4"
                  style={{ background: "#1A1A2E" }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "#1A1F33" }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-label="Camera error"
                    >
                      <title>Camera error</title>
                      <path
                        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                        stroke="#B0B0CC"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle
                        cx="12"
                        cy="13"
                        r="4"
                        stroke="#B0B0CC"
                        strokeWidth="2"
                        fill="none"
                      />
                      <line
                        x1="1"
                        y1="1"
                        x2="23"
                        y2="23"
                        stroke="#FF6B6B"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <p className="text-[#B0B0CC] text-sm text-center">
                    {error.message}
                  </p>
                  <PressableButton
                    onClick={() => startCamera()}
                    className="px-6 py-2.5 rounded-full text-sm font-semibold btn-glow-blue text-white"
                  >
                    Try Again
                  </PressableButton>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ display: isActive ? "block" : "none" }}
                  />
                  {!isActive && !isLoading && (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: "#0A0A1A" }}
                    />
                  )}
                  {isLoading && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <div
                        className="w-10 h-10 rounded-full border-2 animate-spin"
                        style={{
                          borderColor: "rgba(255,255,255,0.2)",
                          borderTopColor: "#00CFFF",
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Top controls */}
              <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-14 pb-4"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
                }}
              >
                <PressableButton
                  onClick={() => setFlashOn((f) => !f)}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                  data-ocid="camera.toggle"
                >
                  {flashOn ? (
                    <Zap size={20} color="#FFDD00" />
                  ) : (
                    <ZapOff size={20} color="white" />
                  )}
                </PressableButton>

                <div className="relative">
                  <PressableButton
                    onClick={() => setShowTimerPicker((s) => !s)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(8px)",
                    }}
                    data-ocid="camera.toggle"
                  >
                    <Clock size={16} color="white" />
                    <span className="text-white text-sm font-semibold">
                      {timerDuration}s
                    </span>
                    <ChevronDown size={14} color="white" />
                  </PressableButton>
                  <AnimatePresence>
                    {showTimerPicker && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute top-full mt-2 right-0 rounded-2xl overflow-hidden z-10"
                        style={{
                          background: "rgba(26,31,51,0.95)",
                          border: "1px solid #2A3048",
                          backdropFilter: "blur(12px)",
                        }}
                        data-ocid="camera.popover"
                      >
                        {[3, 5, 10, 30].map((t) => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => {
                              setTimerDuration(t);
                              setShowTimerPicker(false);
                            }}
                            className="block w-full px-6 py-3 text-sm font-medium text-left transition-colors hover:bg-[#2A3048]"
                            style={{
                              color:
                                timerDuration === t ? "#00CFFF" : "#FFFFFF",
                            }}
                          >
                            {t}s
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Bottom controls */}
              <div
                className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 pb-8 pt-4"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                }}
              >
                <PressableButton
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                  data-ocid="camera.upload_button"
                >
                  <Upload size={20} color="white" />
                </PressableButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGalleryUpload}
                />

                {/* Capture button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={handleCapture}
                  disabled={!isActive}
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: "transparent",
                    border: "3px solid rgba(255,255,255,0.9)",
                    boxShadow:
                      "0 0 25px rgba(0, 207, 255, 0.4), 0 0 60px rgba(0, 207, 255, 0.15)",
                  }}
                  data-ocid="camera.primary_button"
                >
                  <div
                    className="w-14 h-14 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                    }}
                  />
                </motion.button>

                {/* Flip */}
                <PressableButton
                  onClick={() => switchCamera()}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                  data-ocid="camera.secondary_button"
                >
                  <SwitchCamera size={20} color="white" />
                </PressableButton>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
            className="flex-1 flex flex-col"
          >
            <div className="relative flex-1 overflow-hidden">
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Snap preview"
                  className="w-full h-full object-cover"
                />
              )}

              <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-14 pb-4"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
                }}
              >
                <PressableButton
                  onClick={handleDiscard}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                  }}
                  data-ocid="camera.close_button"
                >
                  <X size={20} color="white" />
                </PressableButton>

                {isEphemeral && (
                  <SnapTimer
                    duration={timerDuration}
                    onExpire={handleNoExpiry}
                  />
                )}
              </div>
            </div>

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{
                ease: [0.16, 1, 0.3, 1],
                delay: 0.1,
                duration: 0.35,
              }}
              className="px-5 pt-5 pb-8"
              style={{ background: "#1A1A2E", borderTop: "1px solid #2A3048" }}
            >
              {/* Ephemeral toggle */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-semibold text-sm">
                    Ephemeral snap
                  </p>
                  <p className="text-[#B0B0CC] text-xs mt-0.5">
                    Disappears after {timerDuration}s
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEphemeral((e) => !e)}
                  className="w-12 h-6 rounded-full transition-all duration-300 relative"
                  style={{
                    background: isEphemeral
                      ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                      : "#2A3048",
                  }}
                  aria-label={`Ephemeral mode ${isEphemeral ? "on" : "off"}`}
                  data-ocid="camera.switch"
                >
                  <div
                    className="absolute w-5 h-5 rounded-full top-0.5 transition-all duration-300"
                    style={{
                      left: isEphemeral ? "calc(100% - 22px)" : "2px",
                      background: "white",
                    }}
                  />
                </button>
              </div>

              <p className="text-white font-semibold text-sm mb-1">Send to</p>
              {friends.length === 0 ? (
                <p className="text-[#B0B0CC] text-sm mt-2">
                  No friends yet. Connect with people first!
                </p>
              ) : (
                <FriendPicker
                  friends={friends}
                  selectedFriends={selectedFriends}
                  onToggle={handleToggleFriend}
                />
              )}

              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="sent"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-5 w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #00CFFF, #00AA88)",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 10l4.5 4.5L16 6"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-white font-bold">Sent!</span>
                  </motion.div>
                ) : (
                  <PressableButton
                    key="send"
                    onClick={handleSendSnap}
                    disabled={selectedFriends.length === 0 || sending}
                    className="mt-5 w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
                    style={{
                      background:
                        selectedFriends.length > 0
                          ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                          : "#2A3048",
                      boxShadow:
                        selectedFriends.length > 0
                          ? "0 0 25px rgba(0,207,255,0.3)"
                          : "none",
                    }}
                    data-ocid="camera.submit_button"
                  >
                    <Send size={18} />
                    {sending
                      ? "Sending..."
                      : selectedFriends.length === 0
                        ? "Select friends to send"
                        : `Send to ${selectedFriends.length} friend${selectedFriends.length > 1 ? "s" : ""}`}
                  </PressableButton>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
