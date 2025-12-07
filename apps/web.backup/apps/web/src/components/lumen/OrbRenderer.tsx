/**
 * OrbRenderer
 * Renders the identity orb with internal light core and animations
 * Task 11: Build OrbRenderer component
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useAnimation } from 'framer-motion';
import { useLumenContext } from '@/lib/lumen';
import { LumenColorEngine } from '@/lib/lumen/LumenColorEngine';
import { LumenMotionEngine } from '@/lib/lumen/LumenMotionEngine';
import type { OrbState } from '@/lib/lumen/types';

interface OrbRendererProps {
  size?: number;
  trustScore?: number;
  riskScore?: number;
  compliance?: number;
  skillDepth?: number;
  anchorStale?: boolean;
  onTouch?: () => void;
  className?: string;
}

export function OrbRenderer({
  size = 120,
  trustScore = 0.7,
  riskScore = 0.2,
  compliance = 0.8,
  skillDepth = 0.6,
  anchorStale = false,
  onTouch,
  className = '',
}: OrbRendererProps) {
  const { config } = useLumenContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const [orbState, setOrbState] = useState<OrbState>({
    luminance: trustScore,
    breathingRate: 3000,
    elasticity: compliance,
    surfaceTension: riskScore,
    rotation: 0,
    pulseIntensity: 0,
    jitterAmount: 0,
  });

  // Initialize engines
  const colorEngine = useRef(new LumenColorEngine(config.colorSpectrum)).current;
  const motionEngine = useRef(new LumenMotionEngine(config.physics, config.reducedMotion)).current;

  // Calculate orb properties
  const orbColor = colorEngine.getTrustGradient(trustScore, config.role);
  const breathingDuration = motionEngine.getBreathingRate(trustScore);
  const rotationVelocity = motionEngine.getRotationVelocity(skillDepth);
  const jitter = motionEngine.getJitterAmount(riskScore, anchorStale);

  // Animation controls
  const breathingScale = useMotionValue(1);
  const breathingSpring = useSpring(breathingScale, motionEngine.getSpringPreset('soft'));
  const rotationAnimation = useMotionValue(0);
  const pulseAnimation = useAnimation();

  // Breathing animation (driven by trust score)
  useEffect(() => {
    if (config.reducedMotion) return;

    const interval = setInterval(() => {
      breathingScale.set(0.92);
      setTimeout(() => {
        breathingScale.set(1.0);
      }, breathingDuration / 2);
    }, breathingDuration);

    return () => clearInterval(interval);
  }, [breathingDuration, breathingScale, config.reducedMotion]);

  // Rotation animation (driven by skill depth)
  useEffect(() => {
    if (config.reducedMotion) return;

    let frameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000; // Convert to seconds
      const currentRotation = rotationAnimation.get();
      rotationAnimation.set((currentRotation + rotationVelocity * delta) % (Math.PI * 2));
      lastTime = currentTime;
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [rotationVelocity, rotationAnimation, config.reducedMotion]);

  // Pulse on anchor confirmation
  useEffect(() => {
    if (trustScore > 0.8 && orbState.pulseIntensity === 0) {
      pulseAnimation.start({
        scale: [1, 1.15, 1],
        transition: {
          duration: 0.6,
          ease: 'easeOut',
        },
      });
    }
  }, [trustScore, pulseAnimation, orbState.pulseIntensity]);

  // Jitter on stale anchor
  useEffect(() => {
    if (anchorStale && jitter > 0) {
      const jitterInterval = setInterval(() => {
        if (config.reducedMotion) return;

        pulseAnimation.start({
          x: [(Math.random() - 0.5) * jitter * 10, 0],
          y: [(Math.random() - 0.5) * jitter * 10, 0],
          transition: {
            duration: 0.1,
            ease: 'easeOut',
          },
        });
      }, 500);

      return () => clearInterval(jitterInterval);
    }
  }, [anchorStale, jitter, pulseAnimation, config.reducedMotion]);

  const handleTouch = () => {
    if (onTouch) {
      onTouch();
    }
  };

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.4;
  const coreRadius = radius * 0.4 * orbState.luminance;

  // Wake effect (glow that expands on touch)
  const [wakeRadius, setWakeRadius] = useState(radius);

  const handleClick = () => {
    setWakeRadius(radius * 1.5);
    setTimeout(() => setWakeRadius(radius), 600);
    handleTouch();
  };

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      animate={pulseAnimation}
      onTap={handleClick}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        {/* Wake effect glow */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={wakeRadius}
          fill={orbColor}
          opacity={0.2}
          animate={{
            r: wakeRadius,
            opacity: [0.3, 0, 0.3],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />

        {/* Outer orb (surface tension based on risk) */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill={orbColor}
          opacity={0.8}
          style={{
            filter: `blur(${orbState.surfaceTension * 5}px)`,
            scale: breathingSpring,
          }}
        />

        {/* Inner light core (variable luminance based on trust) */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={coreRadius}
          fill="#ffffff"
          opacity={orbState.luminance * 0.9}
          style={{
            filter: 'blur(2px)',
            scale: breathingSpring,
          }}
        />

        {/* Rotating gradient overlay (skill depth) */}
        <defs>
          <radialGradient id="orbGradient">
            <stop offset="0%" stopColor={orbColor} stopOpacity={0.8} />
            <stop offset="100%" stopColor={orbColor} stopOpacity={0.2} />
          </radialGradient>
        </defs>
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="url(#orbGradient)"
          style={{
            transform: `rotate(${rotationAnimation.get()}rad)`,
          }}
        />
      </svg>
    </motion.div>
  );
}

