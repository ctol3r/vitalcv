"use client";
import dynamic from "next/dynamic";

const NetworkBackground = dynamic(() => import("@/components/NetworkBackground"), { ssr: false });

export default function NetworkBackgroundLoader() {
  return <NetworkBackground />;
}
