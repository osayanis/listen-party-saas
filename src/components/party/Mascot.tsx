"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export type Mood = "idle" | "dance" | "sleep" | "happy" | "think" | "sad";

// La mascotte d'OsaNotch, version web : yeux qui suivent le curseur, humeurs animées.
export default function Mascot({ size = 64, mood = "idle", wave = false, glow }: { size?: number; mood?: Mood; wave?: boolean; glow?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.max(1, Math.hypot(dx, dy));
      const k = Math.min(1, d / 420) * size * 0.06;
      setEye({ x: (dx / d) * k, y: (dy / d) * k });
    };
    window.addEventListener("mousemove", onMove);
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 130); }, 3400);
    return () => { window.removeEventListener("mousemove", onMove); clearInterval(t); };
  }, [size]);

  const look = mood === "think" ? { x: size * 0.04, y: -size * 0.06 } : mood === "sleep" ? { x: 0, y: 0 } : eye;
  const closed = mood === "sleep" || blink;
  const happyEyes = mood === "happy" || mood === "dance";
  const ink = "#1b1d24";

  const body = {
    dance: { y: [0, -size * 0.08, 0], rotate: [-6, 6, -6], scaleY: [1, 0.94, 1] },
    happy: { y: [0, -size * 0.12, 0] },
    idle: { scaleY: [1, 1.03, 1], scaleX: [1, 0.98, 1] },
    sleep: { scaleY: [1, 1.02, 1] },
    think: { rotate: [0, -4, 0] },
    sad: { y: [0, 2, 0] },
  }[mood];
  const dur = mood === "dance" ? 0.55 : mood === "happy" ? 0.6 : 2.6;

  const eyeW = size * 0.15, eyeH = size * 0.21;
  return (
    <div ref={ref} className="relative select-none" style={{ width: size, height: size }} aria-hidden>
      <div className="absolute inset-[-30%] rounded-full blur-2xl opacity-60 pointer-events-none" style={{ background: `radial-gradient(circle, ${glow || "rgba(255,255,255,0.35)"}, transparent 65%)` }} />
      <motion.div
        className="absolute inset-0"
        animate={body}
        transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "50% 90%" }}
      >
        {/* bras « coucou » derrière le corps */}
        {wave && (
          <motion.div
            className="absolute rounded-full"
            style={{ width: size * 0.16, height: size * 0.42, background: "#f7f3ec", right: size * 0.02, top: size * 0.02, transformOrigin: "50% 100%" }}
            animate={{ rotate: [25, 55, 25] }}
            transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div
          className="absolute"
          style={{
            inset: `${size * 0.04}px ${size * 0}px ${size * 0.02}px`,
            borderRadius: "46% 46% 44% 44% / 50% 50% 46% 46%",
            background: "linear-gradient(180deg, #fffdf8 0%, #f1ece4 60%, #ddd6cc 100%)",
            boxShadow: `inset 0 -${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.08)`,
          }}
        />
        {[-1, 1].map((s) => (
          <div
            key={s}
            className="absolute"
            style={{
              left: size / 2 + s * size * 0.17 - eyeW / 2 + look.x,
              top: size * 0.4 - eyeH / 2 + look.y,
              width: eyeW,
              height: happyEyes || closed ? eyeW * 0.5 : eyeH,
              transition: "height 90ms ease, left 80ms linear, top 80ms linear",
            }}
          >
            {happyEyes && !closed ? (
              <svg viewBox="0 0 12 7" className="w-full h-full overflow-visible">
                <path d="M1 6 Q6 -1.5 11 6" fill="none" stroke={ink} strokeWidth={size < 40 ? 2.6 : 2} strokeLinecap="round" />
              </svg>
            ) : (
              <div className="w-full h-full relative" style={{ background: ink, borderRadius: closed ? 999 : eyeW }}>
                {!closed && <div className="absolute rounded-full bg-white" style={{ width: eyeW * 0.38, height: eyeW * 0.38, left: eyeW * 0.42, top: eyeH * 0.16 }} />}
              </div>
            )}
          </div>
        ))}
        {(mood === "happy" || mood === "dance") && (
          <div className="absolute" style={{ left: size / 2 - size * 0.07, top: size * 0.58, width: size * 0.14, height: size * 0.07, borderBottom: `${Math.max(2, size * 0.035)}px solid ${ink}`, borderRadius: "0 0 50% 50%", opacity: 0.8 }} />
        )}
        {mood === "sad" && (
          <div className="absolute" style={{ left: size / 2 - size * 0.06, top: size * 0.62, width: size * 0.12, height: size * 0.06, borderTop: `${Math.max(2, size * 0.03)}px solid ${ink}`, borderRadius: "50% 50% 0 0", opacity: 0.7 }} />
        )}
        {(mood === "happy" || mood === "dance") && [-1, 1].map((s) => (
          <div key={s} className="absolute rounded-full" style={{ left: size / 2 + s * size * 0.3 - size * 0.06, top: size * 0.55, width: size * 0.12, height: size * 0.07, background: "rgba(255,140,158,0.45)" }} />
        ))}
      </motion.div>
      {mood === "sleep" && (
        <motion.span
          className="absolute font-bold text-white/60 osa-display"
          style={{ right: -size * 0.1, top: -size * 0.12, fontSize: size * 0.22 }}
          animate={{ opacity: [0, 1, 0], y: [0, -size * 0.15, -size * 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          z
        </motion.span>
      )}
    </div>
  );
}
