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
      <img
        src="/assets/generated/snaplink-logo-transparent.dim_200x200.png"
        alt="SnapLink logo"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
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
