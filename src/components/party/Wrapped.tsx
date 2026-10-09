"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, X } from "lucide-react";
import Mascot from "./Mascot";
import { fmtDuration } from "./lib";

export type WrappedData = {
  history: { track: string; artist: string; timestamp: number }[];
  stats: { emojisSent: number; messagesSent: number; skips: number };
  scores: Record<string, number>;
  perUser?: Record<string, { messages: number; reactions: number }>;
  emojiCounts?: Record<string, number>;
  createdAt?: number;
  endedAt?: number;
};

const top = <T,>(entries: [string, T][], score: (v: T) => number) =>
  entries.filter(([, v]) => score(v) > 0).sort((a, b) => score(b[1]) - score(a[1]))[0];

// Récap de fin de soirée façon stories, dans la DA OsaNotch.
export default function Wrapped({ data, roomId, accent, onClose }: { data: WrappedData; roomId: string; accent: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const facts = useMemo(() => {
    const per = Object.entries(data.perUser || {});
    const chatter = top(per, (v) => v.messages);
    const hype = top(per, (v) => v.reactions);
    const emoji = top(Object.entries(data.emojiCounts || {}), (v) => v);
    const artists: Record<string, number> = {};
    data.history.forEach((h) => (artists[h.artist] = (artists[h.artist] || 0) + 1));
    const artist = top(Object.entries(artists), (v) => v);
    const podium = Object.entries(data.scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const duration = data.createdAt && data.endedAt ? fmtDuration(data.endedAt - data.createdAt) : null;
    return { chatter, hype, emoji, artist, podium, duration };
  }, [data]);

  const playlistText = useMemo(
    () => `🎧 OsaParty #${roomId} — ${new Date().toLocaleDateString("fr-FR")}\n\n` +
      data.history.map((h, i) => `${i + 1}. ${h.track} — ${h.artist}`).join("\n"),
    [data, roomId]
  );

  const steps = useMemo(() => {
    const s: { key: string; node: JSX.Element }[] = [];
    s.push({ key: "intro", node: (
      <div className="flex flex-col items-center text-center">
        <Mascot size={120} mood="happy" wave glow={`${accent}`} />
        <p className="mt-10 text-white/50 text-xs font-bold uppercase tracking-[0.3em]">OsaParty Wrapped</p>
        <h2 className="osa-display text-5xl font-extrabold mt-3 leading-[0.95]">Quelle<br />soirée.</h2>
        <p className="mt-6 text-white/60 text-sm">Salon #{roomId}{facts.duration ? ` · ${facts.duration}` : ""}</p>
      </div>
    ) });
    s.push({ key: "tracks", node: (
      <div className="text-center">
        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.3em]">Vous avez écouté</p>
        <p className="osa-display text-[120px] font-extrabold leading-none mt-4" style={{ color: accent }}>{data.history.length}</p>
        <p className="osa-display text-3xl font-bold">morceau{data.history.length > 1 ? "x" : ""}</p>
        {facts.duration && <p className="mt-6 text-white/60">en {facts.duration}, ensemble.</p>}
      </div>
    ) });
    s.push({ key: "vibe", node: (
      <div className="w-full">
        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.3em] text-center mb-8">L'ambiance</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { n: data.stats.emojisSent, l: "réactions" },
            { n: data.stats.messagesSent, l: "messages" },
            { n: data.stats.skips, l: "skips" },
            { n: facts.emoji ? facts.emoji[0] : "—", l: "émoji star", big: true },
          ].map((c, i) => (
            <motion.div key={c.l} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-3xl bg-white/[0.06] border border-white/10 p-5">
              <p className={`osa-display font-extrabold ${c.big ? "text-5xl" : "text-4xl"}`}>{c.n}</p>
              <p className="text-white/50 text-xs font-semibold mt-1">{c.l}</p>
            </motion.div>
          ))}
        </div>
      </div>
    ) });
    if (facts.chatter || facts.hype) s.push({ key: "mvp", node: (
      <div className="w-full text-center">
        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.3em] mb-8">Les MVP</p>
        {facts.chatter && (
          <div className="rounded-3xl bg-white/[0.06] border border-white/10 p-5 mb-3">
            <p className="text-white/50 text-xs font-semibold">💬 La pipelette</p>
            <p className="osa-display text-3xl font-extrabold mt-1">{facts.chatter[0]}</p>
            <p className="text-white/40 text-xs mt-1">{facts.chatter[1].messages} messages</p>
          </div>
        )}
        {facts.hype && (
          <div className="rounded-3xl bg-white/[0.06] border border-white/10 p-5">
            <p className="text-white/50 text-xs font-semibold">🔥 L'ambianceur</p>
            <p className="osa-display text-3xl font-extrabold mt-1">{facts.hype[0]}</p>
            <p className="text-white/40 text-xs mt-1">{facts.hype[1].reactions} réactions</p>
          </div>
        )}
      </div>
    ) });
    if (facts.artist) s.push({ key: "artist", node: (
      <div className="text-center">
        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.3em]">Artiste de la soirée</p>
        <p className="osa-display text-5xl font-extrabold mt-8 leading-tight" style={{ color: accent }}>{facts.artist[0]}</p>
        <p className="mt-4 text-white/60">{facts.artist[1]} morceau{facts.artist[1] > 1 ? "x" : ""} sur la playlist</p>
      </div>
    ) });
    if (facts.podium.length) s.push({ key: "podium", node: (
      <div className="w-full text-center">
        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.3em] mb-8">Blind test</p>
        {facts.podium.map(([name, pts], i) => (
          <motion.div key={name} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.12 }}
            className="flex items-center justify-between rounded-2xl bg-white/[0.06] border border-white/10 px-5 py-4 mb-2.5">
            <span className="flex items-center gap-3 font-bold text-lg"><span className="text-2xl">{["🥇", "🥈", "🥉"][i]}</span>{name}</span>
            <span className="osa-display font-extrabold text-xl">{pts} pts</span>
          </motion.div>
        ))}
      </div>
    ) });
    s.push({ key: "playlist", node: (
      <div className="w-full">
        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.3em] text-center mb-6">La playlist</p>
        <div className="max-h-[42vh] overflow-y-auto pr-1 space-y-1.5 osa-scroll">
          {data.history.length === 0 && <p className="text-center text-white/40 text-sm">Aucun morceau joué ce soir.</p>}
          {data.history.map((h, i) => (
            <div key={i} className="flex items-baseline gap-3 text-sm">
              <span className="text-white/30 font-mono w-6 text-right">{i + 1}</span>
              <span className="font-semibold truncate">{h.track}</span>
              <span className="text-white/40 truncate">{h.artist}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([playlistText], { type: "text/plain" }));
              a.download = `OsaParty_${roomId}.txt`;
              a.click();
            }}
            className="flex-1 bg-[#fdfcf7] text-black rounded-full py-3 font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition"
          >
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(playlistText); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} }}
            className="flex-1 bg-white/10 rounded-full py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/15 active:scale-95 transition"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copiée" : "Copier"}
          </button>
        </div>
      </div>
    ) });
    return s;
  }, [data, facts, accent, roomId, playlistText, copied]);

  const last = steps.length - 1;
  const atEnd = step >= last;

  // Avance automatique (sauf sur la dernière carte, où l'on agit).
  useEffect(() => {
    if (atEnd) return;
    const t = setTimeout(() => setStep((s) => Math.min(last, s + 1)), 6000);
    return () => clearTimeout(t);
  }, [step, last, atEnd]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(last, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition" aria-label="Fermer"><X className="w-5 h-5" /></button>
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative w-full max-w-[400px] aspect-[9/16] max-h-[88vh] rounded-[40px] overflow-hidden border border-white/10 bg-[#0c0c0f] text-white shadow-2xl"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          if (e.clientX - r.left < r.width * 0.3) setStep((s) => Math.max(0, s - 1));
          else setStep((s) => Math.min(last, s + 1));
        }}
      >
        <div className="absolute inset-0 osa-grid opacity-70" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[130%] h-72 rounded-full blur-3xl opacity-40" style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }} />
        {/* barres de progression façon stories */}
        <div className="absolute top-5 left-5 right-5 flex gap-1.5 z-10">
          {steps.map((s, i) => (
            <div key={s.key} className="h-1 flex-1 rounded-full bg-white/15 overflow-hidden">
              {i < step && <div className="h-full w-full bg-white rounded-full" />}
              {i === step && (
                <motion.div
                  key={`bar-${step}`}
                  className="h-full bg-white rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: atEnd ? 0.3 : 6, ease: "linear" }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center px-8 pt-10 pb-8">
          <AnimatePresence mode="wait">
            <motion.div key={steps[step]?.key} initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -16, filter: "blur(6px)" }} transition={{ duration: 0.35 }} className="w-full flex justify-center">
              {steps[step]?.node}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
