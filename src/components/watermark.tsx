"use client";

import { useEffect, useRef } from "react";

export function Watermark({ name, department }: { name: string; department: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !name) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 14;
    const angle = -20;
    const today = new Date().toLocaleDateString("zh-CN");
    const line1 = `${name} ${department}`;
    const line2 = today;

    canvas.width = 300;
    canvas.height = 200;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.fillText(line1, 0, -8);
    ctx.fillText(line2, 0, 12);

    const dataUrl = canvas.toDataURL("image/png");
    containerRef.current.style.backgroundImage = `url(${dataUrl})`;
  }, [name, department]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ backgroundRepeat: "repeat" }}
    />
  );
}
