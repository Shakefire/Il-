"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface StepMotionProps {
  children: React.ReactNode;
  className?: string;
}

export default function StepMotion({ children, className = "" }: StepMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
