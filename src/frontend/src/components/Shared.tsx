import { motion } from "motion/react";

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function UserAvatar({ name, size = 44, className = "" }: AvatarProps) {
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
      className={`flex items-center justify-center rounded-full flex-shrink-0 font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: colors[colorIndex],
        fontSize: Math.max(size * 0.35, 10),
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {initials}
    </div>
  );
}

export function PressableButton({
  children,
  onClick,
  className = "",
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {children}
    </motion.button>
  );
}
