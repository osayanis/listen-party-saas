"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, Users } from "lucide-react";
import type { Notice } from "./lib";

// L'île du haut de page, comme l'encoche d'OsaNotch : compacte au repos,
// elle s'étire pour afficher les notifications (arrivées, blind test, erreurs…).
export default function Island({
  roomId, count, playing, accent, notice, isLocked, isBlindTest, onClick,
}: {
  roomId: string; count: number; playing: boolean; accent: string; notice: Notice | null;
  isLocked: boolean; isBlindTest: boolean; onClick: () => void;
}) {
  const tone = notice?.tone === "bad" ? "#f87171" : notice?.tone === "good" ? "#4ade80" : notice?.tone === "game" ? "#c4b5fd" : accent;
  return (
    <motion.button
      layout
      onClick={onClick}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="relative bg-black text-white rounded-full border border-white/10 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] flex items-center overflow-hidden h-11 px-4"
      style={{ minWidth: 196 }}
      title="Inviter des amis"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {notice ? (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            className="flex items-center gap-2.5 pr-1 whitespace-nowrap"
          >
            <span className="w-6 h-6 rounded-full grid place-items-center text-[13px]" style={{ background: `${tone}33` }}>{notice.icon || "•"}</span>
            <span className="text-[13px] font-semibold max-w-[60vw] truncate">{notice.text}</span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 whitespace-nowrap w-full justify-between"
          >
            <Equalizer active={playing} color={isBlindTest ? "#c4b5fd" : accent} />
            <span className="font-mono text-[13px] font-bold tracking-[0.18em]">#{roomId}</span>
            <span className="flex items-center gap-1.5 text-[12px] text-white/60 font-semibold">
              {isLocked && <Lock className="w-3 h-3 text-white/50" />}
              <Users className="w-3.5 h-3.5" />
              {count}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Equalizer({ active, color, size = 14 }: { active: boolean; color: string; size?: number }) {
  const bars = [0.55, 1, 0.7, 0.85];
  return (
    <span className="flex items-center gap-[2.5px]" style={{ height: size }}>
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: color }}
          animate={active ? { height: [size * 0.3, size * h, size * 0.45, size * h * 0.8, size * 0.3] } : { height: size * 0.25 }}
          transition={active ? { duration: 0.9 + i * 0.12, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        />
      ))}
    </span>
  );
}
