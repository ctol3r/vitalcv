"use client";
import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { ISourceOptions } from "@tsparticles/engine";

const OPTIONS: ISourceOptions = {
  background: { color: { value: "transparent" } },
  fpsLimit: 60,
  interactivity: {
    events: {
      onHover: { enable: true, mode: "grab" },
      resize: { enable: true },
    },
    modes: { grab: { distance: 180, links: { opacity: 0.5 } } },
  },
  particles: {
    color: { value: ["#3b82f6", "#0ea5e9", "#6366f1", "#94a3b8"] },
    links: {
      color: "#94a3b8",
      distance: 140,
      enable: true,
      opacity: 0.2,
      width: 1,
    },
    move: { enable: true, speed: 0.6, outModes: { default: "bounce" } },
    number: { density: { enable: true }, value: 60 },
    opacity: { value: 0.35 },
    shape: { type: "circle" },
    size: { value: { min: 1, max: 3 } },
  },
  detectRetina: true,
};

export default function NetworkBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Particles
      id="tsparticles"
      options={OPTIONS}
      className="fixed inset-0 -z-50 pointer-events-none"
    />
  );
}
