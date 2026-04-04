import { motion } from "motion/react";

interface GradientLogoProps {
  size?: number;
  className?: string;
}

export function GradientLogo({ size = 80, className = "" }: GradientLogoProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SnapLink logo"
      >
        <title>SnapLink logo</title>
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00CFFF" />
            <stop offset="100%" stopColor="#BD00FF" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M8 12C8 7.58 11.58 4 16 4H64C68.42 4 72 7.58 72 12V50C72 54.42 68.42 58 64 58H44L32 72L20 58H16C11.58 58 8 54.42 8 50V12Z"
          fill="url(#logoGrad)"
          filter="url(#glow)"
          opacity="0.95"
        />
        <circle
          cx="40"
          cy="31"
          r="15"
          fill="rgba(255,255,255,0.15)"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="2.5"
        />
        <circle
          cx="40"
          cy="31"
          r="9"
          fill="rgba(255,255,255,0.2)"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
        />
        <circle cx="40" cy="31" r="4" fill="white" opacity="0.95" />
        <circle cx="40" cy="22" r="2" fill="white" opacity="0.6" />
      </svg>
    </div>
  );
}

export function AnimatedLogo({ size = 80 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
    >
      <GradientLogo size={size} />
    </motion.div>
  );
}
