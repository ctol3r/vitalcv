"use client";

import { colors } from "@/design/tokens";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export function CursorPhysics() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring physics for the cursor
  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show cursor after first mouse movement
    const handleFirstMove = () => {
      setIsVisible(true);
      window.removeEventListener("mousemove", handleFirstMove);
    };
    window.addEventListener("mousemove", handleFirstMove);

    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX - 16); // Center offset for 32px width/height
      mouseY.set(e.clientY - 16);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-magnetic]")) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("mousemove", handleFirstMove);
    };
  }, [mouseX, mouseY]);

  if (!isVisible) return null;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[100] h-8 w-8 rounded-full border border-blue-500/30 bg-blue-500/10 mix-blend-screen backdrop-blur-sm hidden md:block"
      style={{
        x: cursorX,
        y: cursorY,
        scale: isHovering ? 1.5 : 1,
        opacity: 1,
      }}
      transition={{ scale: { duration: 0.2 } }}
    >
      <div
        className="absolute inset-0 rounded-full blur-md"
        style={{ backgroundColor: `${colors.waveBlue}33` }}
      />
    </motion.div>
  );
}
