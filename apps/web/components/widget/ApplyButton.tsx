"use client"

import { motion } from "framer-motion"

interface ApplyButtonProps {
  onClick: () => void
  className?: string
}

export function ApplyButton({ onClick, className }: ApplyButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, boxShadow: "0 0 0 4px rgba(20,184,166,0.25)" }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center gap-2.5 min-h-[52px] px-7 rounded-xl
                   bg-teal-600 hover:bg-teal-500 text-white text-lg font-semibold
                   transition-colors focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${className ?? ""}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 1.5L2.5 4.5V10C2.5 14.142 5.786 17.864 10 18.5C14.214 17.864 17.5 14.142 17.5 10V4.5L10 1.5Z"
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M7 10l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Apply with VitalCV
    </motion.button>
  )
}
