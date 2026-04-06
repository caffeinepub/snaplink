import { motion } from "motion/react";

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
  avatarUrl?: string;
  style?: React.CSSProperties;
  moodEmoji?: string;
  showOnlineDot?: boolean;
}

export function UserAvatar({
  name,
  size = 44,
  className = "",
  avatarUrl,
  style,
  moodEmoji,
  showOnlineDot,
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "linear-gradient(135deg, #00CFFF, #0077AA)",
    "linear-gradient(135deg, #BD00FF, #7700AA)",
    "linear-gradient(135deg, #00CFFF, #BD00FF)",
    "linear-gradient(135deg, #0077FF, #BD00FF)",
  ];
  const colorIndex =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className={`flex items-center justify-center rounded-full font-bold text-white overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          background: avatarUrl ? "transparent" : colors[colorIndex],
          fontSize: Math.max(size * 0.35, 10),
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          ...style,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="rounded-full object-cover w-full h-full"
            style={{ width: size, height: size }}
          />
        ) : (
          initials
        )}
      </div>
      {/* Mood emoji badge */}
      {moodEmoji && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center"
          style={{
            width: Math.max(size * 0.32, 14),
            height: Math.max(size * 0.32, 14),
            background: "rgba(26,26,46,0.95)",
            border: "1.5px solid rgba(0,207,255,0.3)",
            fontSize: Math.max(size * 0.18, 8),
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          {moodEmoji}
        </div>
      )}
      {/* Online pulse dot */}
      {showOnlineDot && !moodEmoji && (
        <div
          className="online-dot absolute bottom-0 right-0 w-3 h-3 rounded-full"
          style={{
            background: "#4ADE80",
            border: "2px solid #1A1A2E",
            zIndex: 2,
          }}
        />
      )}
    </div>
  );
}

export function PressableButton({
  children,
  onClick,
  className = "",
  disabled = false,
  style,
  "data-ocid": dataOcid,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  "data-ocid"?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={className}
      style={style}
      data-ocid={dataOcid}
    >
      {children}
    </motion.button>
  );
}
