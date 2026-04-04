import {
  ChevronDown,
  Clock,
  Send,
  Sparkles,
  SwitchCamera,
  Upload,
  Video,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCamera } from "../camera/useCamera";
import { useApp } from "../context/AppContext";
import { getFriends, sendSnap } from "../store";
import type { User } from "../types";
import { AiSnapAssistant } from "./AiSnapAssistant";
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

function RecordingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: "#FF3B3B",
          animation: "pulse-rec 1s ease-in-out infinite",
        }}
      />
      <span className="text-white text-sm font-bold tabular-nums">{label}</span>
    </div>
  );
}

// Rendered via portal so it always appears above everything
function SendToSheet({
  friends,
  selectedFriends,
  onToggle,
  onSend,
  onClose,
  sending,
  sent,
}: {
  friends: User[];
  selectedFriends: string[];
  onToggle: (username: string) => void;
  onSend: () => void;
  onClose: () => void;
  sending: boolean;
  sent: boolean;
}) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        background: "rgba(0,0,0,0.65)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.38 }}
        style={{
          width: "100%",
          background: "#1A1F33",
          borderRadius: "24px 24px 0 0",
          border: "1px solid #2A3048",
          borderBottom: "none",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-white font-bold text-lg">Send To</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X size={18} color="#B0B0CC" />
          </button>
        </div>

        {/* Friend list */}
        <div
          className="flex-1 overflow-y-auto px-4 pb-2"
          style={{ minHeight: 0 }}
        >
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-[#B0B0CC] text-sm text-center">
                No friends yet. Add friends first to send snaps!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {friends.map((friend) => {
                const selected = selectedFriends.includes(friend.username);
                return (
                  <motion.button
                    type="button"
                    key={friend.username}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onToggle(friend.username)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
                    style={{
                      background: selected
                        ? "rgba(0,207,255,0.08)"
                        : "transparent",
                      border: selected
                        ? "1px solid rgba(0,207,255,0.25)"
                        : "1px solid transparent",
                    }}
                  >
                    <UserAvatar
                      name={friend.displayName}
                      size={48}
                      avatarUrl={friend.avatarUrl}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {friend.displayName}
                      </p>
                      <p className="text-[#B0B0CC] text-xs">
                        @{friend.username}
                      </p>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        background: selected
                          ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                          : "rgba(255,255,255,0.08)",
                        border: selected
                          ? "none"
                          : "1.5px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {selected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2.5 6l2.5 2.5L9.5 3"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Send button */}
        <div className="px-4 py-4" style={{ borderTop: "1px solid #2A3048" }}>
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
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
                onClick={onSend}
                disabled={selectedFriends.length === 0 || sending}
                className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
                style={{
                  background:
                    selectedFriends.length > 0
                      ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                      : "#2A3048",
                  boxShadow:
                    selectedFriends.length > 0
                      ? "0 0 25px rgba(0,207,255,0.3)"
                      : "none",
                  opacity: selectedFriends.length === 0 ? 0.5 : 1,
                }}
              >
                <Send size={18} />
                {sending
                  ? "Sending..."
                  : selectedFriends.length === 0
                    ? "Select friends to send"
                    : `Send to ${selectedFriends.length} friend${
                        selectedFriends.length > 1 ? "s" : ""
                      }`}
              </PressableButton>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function CameraTab() {
  const { currentUser, setActiveTab, setSelectedConversation } = useApp();
  const [cameraState, setCameraState] = useState<CameraState>("viewfinder");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(true);
  const [timerDuration, setTimerDuration] = useState(5);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [snapCaption, setSnapCaption] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pressStartTimeRef = useRef<number>(0);

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

  // Load friends whenever user changes or send sheet opens
  useEffect(() => {
    if (currentUser) {
      setFriends(getFriends(currentUser.username));
    }
  }, [currentUser]);

  useEffect(() => {
    if (showSendSheet && currentUser) {
      setFriends(getFriends(currentUser.username));
    }
  }, [showSendSheet, currentUser]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (capturedVideo) URL.revokeObjectURL(capturedVideo);
    };
  }, []);

  const handleCapture = useCallback(async () => {
    const file = await capturePhoto();
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
      setCapturedVideo(null);
      setCameraState("preview");
      stopCamera();
    };
    reader.readAsDataURL(file);
  }, [capturePhoto, stopCamera]);

  const startRecording = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream || !isActive) return;

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setCapturedVideo(url);
        setCapturedImage(null);
        setCameraState("preview");
        stopCamera();
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingStartTime(Date.now());
    } catch (e) {
      console.warn("MediaRecorder failed:", e);
    }
  }, [isActive, videoRef, stopCamera]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingStartTime(null);
  }, []);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleButtonPointerDown = useCallback(() => {
    pressStartTimeRef.current = Date.now();
    holdTimerRef.current = setTimeout(() => {
      startRecording();
    }, 200);
  }, [startRecording]);

  const handleButtonPointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const pressDuration = Date.now() - pressStartTimeRef.current;
    if (isRecording) {
      stopRecording();
    } else if (pressDuration < 200) {
      handleCapture();
    } else {
      handleCapture();
    }
  }, [isRecording, stopRecording, handleCapture]);

  const handleButtonPointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isRecording) stopRecording();
  }, [isRecording, stopRecording]);

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setCapturedVideo(url);
      setCapturedImage(null);
      setCameraState("preview");
      stopCamera();
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setCapturedVideo(null);
        setCameraState("preview");
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleFriend = (username: string) => {
    setSelectedFriends((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  };

  const handleSendSnap = async () => {
    if (!currentUser || selectedFriends.length === 0) return;
    const snapData = capturedVideo || capturedImage;
    if (!snapData) return;
    setSending(true);
    const isVideo = !!capturedVideo;
    try {
      for (const friend of selectedFriends) {
        sendSnap(
          currentUser,
          friend,
          snapData,
          isEphemeral,
          !isEphemeral,
          snapCaption || undefined,
          isVideo,
        );
      }
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSending(false);
        setShowSendSheet(false);
        if (capturedVideo) URL.revokeObjectURL(capturedVideo);
        setCapturedImage(null);
        setCapturedVideo(null);
        setCameraState("viewfinder");
        setSelectedFriends([]);
        setSnapCaption("");
        startCamera();
        if (selectedFriends.length === 1) {
          setSelectedConversation(selectedFriends[0]);
          setActiveTab("chats");
        } else {
          setActiveTab("chats");
        }
      }, 1200);
    } catch {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    if (capturedVideo) URL.revokeObjectURL(capturedVideo);
    setCapturedImage(null);
    setCapturedVideo(null);
    setCameraState("viewfinder");
    setSelectedFriends([]);
    setShowSendSheet(false);
    setSnapCaption("");
    startCamera();
  };

  const isVideoSnap = !!capturedVideo;

  return (
    <div
      className="relative flex flex-col h-full"
      style={{ background: "#000000" }}
    >
      <style>{`
        @keyframes pulse-rec {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes recording-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,59,0.7), 0 0 0 6px rgba(255,59,59,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(255,59,59,0.0), 0 0 0 14px rgba(255,59,59,0.1); }
        }
      `}</style>

      <AnimatePresence mode="wait">
        {cameraState === "viewfinder" ? (
          /* ─── VIEWFINDER ─── */
          <motion.div
            key="viewfinder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col"
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
                        stroke="#FF4444"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="text-center px-6">
                    <p className="text-white font-semibold mb-1">
                      Camera unavailable
                    </p>
                    <p className="text-[#B0B0CC] text-sm">{error?.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-6 py-3 rounded-2xl font-semibold text-sm text-white"
                    style={{
                      background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ display: isActive ? "block" : "none" }}
                  />
                  {!isActive && !isLoading && (
                    <div
                      className="w-full h-full"
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

              {/* Recording border */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none"
                    style={{ border: "3px solid #FF3B3B" }}
                  />
                )}
              </AnimatePresence>

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
                >
                  {flashOn ? (
                    <Zap size={20} color="#FFDD00" />
                  ) : (
                    <ZapOff size={20} color="white" />
                  )}
                </PressableButton>

                {isRecording && recordingStartTime ? (
                  <RecordingTimer startTime={recordingStartTime} />
                ) : (
                  <div className="relative">
                    <PressableButton
                      onClick={() => setShowTimerPicker((s) => !s)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(8px)",
                      }}
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
                )}
              </div>

              {/* Hold hint */}
              <AnimatePresence>
                {!isRecording && isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 1 }}
                    className="absolute bottom-36 left-0 right-0 flex justify-center pointer-events-none"
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <Video size={13} color="#B0B0CC" />
                      <span className="text-[#B0B0CC] text-xs">
                        Hold for video · Tap for photo
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Upload size={20} color="white" />
                </PressableButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleGalleryUpload}
                />

                {/* Capture button */}
                <button
                  type="button"
                  onPointerDown={handleButtonPointerDown}
                  onPointerUp={handleButtonPointerUp}
                  onPointerLeave={handleButtonPointerLeave}
                  disabled={!isActive}
                  className="w-20 h-20 rounded-full flex items-center justify-center select-none"
                  style={{
                    background: "transparent",
                    border: `3px solid ${isRecording ? "rgba(255,59,59,0.9)" : "rgba(255,255,255,0.9)"}`,
                    boxShadow: isRecording
                      ? "0 0 25px rgba(255,59,59,0.5), 0 0 60px rgba(255,59,59,0.2)"
                      : "0 0 25px rgba(0, 207, 255, 0.4), 0 0 60px rgba(0, 207, 255, 0.15)",
                    animation: isRecording
                      ? "recording-ring 1s ease-in-out infinite"
                      : "none",
                    cursor: isActive ? "pointer" : "default",
                    touchAction: "none",
                    userSelect: "none",
                  }}
                >
                  <motion.div
                    animate={{
                      borderRadius: isRecording ? "8px" : "50%",
                      scale: isRecording ? 0.55 : 0.82,
                    }}
                    transition={{ duration: 0.2 }}
                    className="w-14 h-14"
                    style={{
                      background: isRecording
                        ? "#FF3B3B"
                        : "linear-gradient(135deg, #00CFFF, #BD00FF)",
                    }}
                  />
                </button>

                <PressableButton
                  onClick={() => switchCamera()}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <SwitchCamera size={20} color="white" />
                </PressableButton>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ─── PREVIEW ─── */
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col"
            style={{ background: "#000" }}
          >
            {/* Media preview -- fills everything except the bottom panel */}
            <div
              className="relative flex-1 overflow-hidden"
              style={{ minHeight: 0 }}
            >
              {isVideoSnap && capturedVideo ? (
                <video
                  src={capturedVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Snap preview"
                  className="w-full h-full object-cover"
                />
              ) : null}

              {/* Top bar */}
              <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-14 pb-4"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
                }}
              >
                <PressableButton
                  onClick={handleDiscard}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <X size={20} color="white" />
                </PressableButton>

                {isVideoSnap ? (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Video size={14} color="#FF3B3B" />
                    <span className="text-white text-xs font-semibold">
                      Video
                    </span>
                  </div>
                ) : isEphemeral ? (
                  <SnapTimer duration={timerDuration} onExpire={() => {}} />
                ) : null}
              </div>

              {/* Caption overlay */}
              <AnimatePresence>
                {snapCaption && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-4 left-4 right-4"
                  >
                    <div
                      className="text-center px-4 py-2 rounded-xl"
                      style={{ background: "rgba(0,0,0,0.7)" }}
                    >
                      <p className="text-white font-semibold text-sm">
                        {snapCaption}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Bottom action panel ── always fixed height, never scrolls away */}
            <div
              className="flex-shrink-0 flex flex-col gap-3 px-5 pt-4 pb-6"
              style={{
                background: "#1A1A2E",
                borderTop: "1px solid #2A3048",
              }}
            >
              {/* Caption input */}
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <input
                  type="text"
                  placeholder="Add a caption..."
                  value={snapCaption}
                  onChange={(e) => setSnapCaption(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-[#B0B0CC]"
                  maxLength={150}
                />
                {snapCaption && (
                  <button
                    type="button"
                    onClick={() => setSnapCaption("")}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                    aria-label="Clear caption"
                  >
                    <X size={11} color="white" />
                  </button>
                )}
              </div>

              {/* Row: AI Assistant + Ephemeral toggle */}
              <div className="flex items-center gap-3">
                <PressableButton
                  onClick={() => setShowAiAssistant(true)}
                  className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
                  style={{
                    border: "1px solid rgba(0,207,255,0.4)",
                    background: "rgba(0,207,255,0.08)",
                    color: "#00CFFF",
                  }}
                >
                  <Sparkles size={16} />
                  AI Assistant
                </PressableButton>

                {!isVideoSnap && (
                  <button
                    type="button"
                    onClick={() => setIsEphemeral((e) => !e)}
                    className="w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0"
                    style={{
                      background: isEphemeral
                        ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                        : "#2A3048",
                    }}
                    aria-label={`Ephemeral ${isEphemeral ? "on" : "off"}`}
                  >
                    <div
                      className="absolute w-5 h-5 rounded-full top-0.5 transition-all duration-300"
                      style={{
                        left: isEphemeral ? "calc(100% - 22px)" : "2px",
                        background: "white",
                      }}
                    />
                  </button>
                )}
              </div>

              {/* Send To button -- always the last thing, always fully visible */}
              <button
                type="button"
                onClick={() => {
                  if (currentUser) setFriends(getFriends(currentUser.username));
                  setShowSendSheet(true);
                }}
                className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                  boxShadow: "0 0 30px rgba(0,207,255,0.35)",
                }}
              >
                <Send size={20} />
                {selectedFriends.length > 0
                  ? `Send To... (${selectedFriends.length} selected)`
                  : "Send To..."}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send To sheet -- rendered via portal to escape overflow clipping */}
      <AnimatePresence>
        {showSendSheet && (
          <SendToSheet
            friends={friends}
            selectedFriends={selectedFriends}
            onToggle={handleToggleFriend}
            onSend={handleSendSnap}
            onClose={() => setShowSendSheet(false)}
            sending={sending}
            sent={sent}
          />
        )}
      </AnimatePresence>

      {/* AI Snap Assistant -- also via portal */}
      <AnimatePresence>
        {showAiAssistant && (
          <AiSnapAssistant
            friends={friends}
            onSelectCaption={(caption) => {
              setSnapCaption(caption);
              setShowAiAssistant(false);
            }}
            onClose={() => setShowAiAssistant(false)}
          />
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
