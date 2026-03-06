"use client";

import { colors } from "@/design/tokens";
import { motion } from "framer-motion";

export function BackgroundField() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-black/90">
      <div className="absolute inset-0 opacity-30 mix-blend-screen">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute left-1/4 top-1/4 h-[40vw] w-[40vw] rounded-full blur-[100px]"
          style={{ backgroundColor: colors.waveBlue }}
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, -40, 0],
            y: [0, 60, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
            delay: 1,
          }}
          className="absolute right-1/4 top-1/3 h-[35vw] w-[35vw] rounded-full blur-[120px]"
          style={{ backgroundColor: colors.wavePurple }}
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 30, 0],
            y: [0, -40, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "linear",
            delay: 2,
          }}
          className="absolute bottom-1/4 left-1/3 h-[45vw] w-[45vw] rounded-full blur-[140px]"
          style={{ backgroundColor: colors.waveTeal }}
        />
      </div>
    </div>
  );
}
