'use client';

import { useState, useEffect } from 'react';

export function OptimizationBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mock: Show banner periodically to simulate background optimization
    // In a real app, this would subscribe to a websocket or poll an endpoint
    const checkStatus = () => {
        const isOptimizing = Math.random() > 0.7; // 30% chance
        setIsVisible(isOptimizing);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="bg-indigo-600/90 text-white text-xs font-medium py-1 px-4 text-center animate-pulse">
      VitalCV is optimizing performance in the background…
    </div>
  );
}


