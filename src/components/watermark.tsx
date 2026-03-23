"use client";

import { useEffect, useRef } from "react";

export function Watermark({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 14;
    const gap = 180;
    const angle = -20;

    // Size canvas to fit one tile
    canvas.width = gap + 100;
    canvas.height = gap + 60;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Rotate and draw text at center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.fillText(text, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    containerRef.current.style.backgroundImage = `url(${dataUrl})`;
  }, [text]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ backgroundRepeat: "repeat" }}
    />
  );
}
