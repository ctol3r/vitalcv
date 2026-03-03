'use client';

import { useEffect, useRef, useState } from 'react';

interface ScrollRevealOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
}

export function useScrollReveal({
  root = null,
  rootMargin = '0px',
  threshold = 0.1,
  triggerOnce = true,
}: ScrollRevealOptions = {}) {
  const [inView, setInView] = useState(false);
  const ref = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true); // Fallback if no observer
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(el);

    return () => {
      observer.unobserve(el);
    };
  }, [root, rootMargin, threshold, triggerOnce]);

  return { ref, inView };
}
