'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/animations/motionVariants';
import { ArrowRight } from 'lucide-react';

interface ActionInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onAction: () => void;
  isValid?: boolean;
}

export function ActionInput({
  label,
  value,
  onChange,
  onAction,
  isValid = false,
  className,
  ...props
}: ActionInputProps) {
  return (
    <motion.div 
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn("w-full max-w-3xl mx-auto flex flex-col items-center", className)}
    >
      <label className="text-2xl md:text-4xl text-white/50 mb-8 font-medium text-center">
        {label}
      </label>
      
      <div className="relative w-full">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-b-2 border-white/20 pb-4 text-center text-5xl md:text-7xl lg:text-8xl font-heading font-extrabold text-white focus:outline-none focus:border-emerald-400 placeholder:text-white/10 transition-colors"
          {...props}
        />
        
        {isValid && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onAction}
            className="absolute right-4 bottom-6 h-12 w-12 md:h-16 md:w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 transition-colors shadow-[0_0_30px_rgba(52,211,153,0.3)]"
          >
            <ArrowRight className="h-6 w-6 md:h-8 md:w-8" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
