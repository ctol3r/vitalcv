"use client";
import { useEffect } from 'react';

export default function A11yInit() {
  useEffect(() => {
    document.body.classList.add('focus:outline-none', 'focus-visible:ring');
  }, []);

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:p-4 focus:rounded focus:shadow-lg"
    >
      Skip to content
    </a>
  );
}

