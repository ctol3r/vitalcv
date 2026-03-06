"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RevealOnScrollProps extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children"> {
  children: React.ReactNode;
  delay?: number;
}

export function RevealOnScroll({ children, className, delay = 0, ...props }: RevealOnScrollProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
