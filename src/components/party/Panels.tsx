"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Ban, Crown, Laptop, Lock, Search, Unlock } from "lucide-react";
import Mascot from "./Mascot";
import {
  bridgeLabel, colorFor, findArtwork, initials,
  type ChatMsg, type LyricLine, type QueueItem, type RoomUser,
} from "./lib";

export function Avatar({ name, size = 32, ring }: { name: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full font-bold text-[#141418] shrink-0 ${ring ? "ring-2 ring-[#0b0b0e]" : ""}`}
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

function Empty({ mood = "sleep" as const, title, text }: { mood?: "sleep" | "think" | "idle"; title: string; text?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-4">
      <Mascot size={56} mood={mood} />
      <div>
        <p className="font-semibold text-white/80">{title}</p>
        {text && <p className="text-sm text-white/40 mt-1 leading-relaxed">{text}</p>}
      </div>
    </div>
  );
}

// ── Paroles synchronisées, façon Apple Music ─────────────────────────────────
export function Lyrics({ lines, plain, pos, loading, hidden }: { lines: LyricLine[]; plain: string; pos: number; loading: boolean; hidden: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLParagraphElement | null)[]>([]);
  const touchedAt = useRef(0);

  let active = -1;
  for (let i = 0; i < lines.length; i++) if (pos >= lines[i].time) active = i; else break;

  useEffect(() => {
    const el = refs.current[active], c = box.current;
    if (!el || !c || Date.now() - touchedAt.current < 4000) return; // l'utilisateur fait défiler → on le laisse
    c.scrollTo({ top: el.offsetTop - c.clientHeight * 0.38, behavior: "smooth" });
  }, [active]);

  if (hidden) return <Empty mood="think" title="Les paroles se cachent 🤫" text="Pendant le blind test, pas de triche : à toi de reconnaître le morceau." />;
  if (loading) return <Empty mood="think" title="Je cherche les paroles…" />;
  if (!lines.length) return plain
    ? <div className="h-full overflow-y-auto osa-scroll px-7 py-8 osa-fade"><p className="osa-display text-xl font-semibold text-white/70 whitespace-pre-line leading-relaxed">{plain}</p></div>
    : <Empty title="Pas de paroles pour ce titre" text="LRCLIB ne connaît pas encore ce morceau." />;

  return (
    <div
      ref={box}
      onWheel={() => (touchedAt.current = Date.now())}
      onTouchMove={() => (touchedAt.current = Date.now())}
      className="relative h-full overflow-y-auto osa-scroll osa-fade px-7"
    >
      <div className="h-[30%]" />
      {lines.map((l, i) => {
        const d = Math.abs(i - active);
        return (
          <p
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="osa-display font-bold leading-snug py-2 origin-left transition-all duration-500 ease-out"
            style={{
              fontSize: "clamp(20px, 2.1vw, 28px)",
              color: i === active ? "#fff" : `rgba(255,255,255,${i < active ? 0.24 : 0.36})`,
              filter: d <= 2 ? "none" : `blur(${Math.min(1.2, (d - 2) * 0.4)}px)`,
              transform: i === active ? "scale(1)" : "scale(0.96)",
              textShadow: i === active ? "0 0 24px rgba(255,255,255,0.25)" : "none",
            }}
          >
            {l.text || "♪"}
          </p>
        );
      })}
      <div className="h-[55%]" />
      <p className="text-[10px] text-white/25 text-center pb-4">Paroles · LRCLIB</p>
    </div>
  );
}

// ── File d'attente ───────────────────────────────────────────────────────────
function QueueRow({ q, i }: { q: QueueItem; i: number }) {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => { let on = true; findArtwork(q.track, q.artist, 100).then((u) => on && setArt(u)); return () => { on = false; }; }, [q.track, q.artist]);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.05] transition">
      <span className="w-5 text-right font-mono text-xs text-white/30">{i + 1}</span>
      <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden shrink-0">
        {art && <img src={art} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{q.track}</p>
        <p className="text-xs text-white/45 truncate">{q.artist}</p>
      </div>
    </motion.div>
  );
}

export function Queue({ items, hidden }: { items: QueueItem[]; hidden: boolean }) {
  if (hidden) return <Empty mood="think" title="La suite est masquée 🤫" text="Le blind test cache aussi les prochains morceaux." />;
  if (!items.length) return <Empty mood="idle" title="Rien à suivre pour l'instant" text="La file vient de la playlist du Mac qui diffuse." />;
  return (
    <div className="h-full overflow-y-auto osa-scroll p-3">
      <p className="px-3 pt-1 pb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">À suivre</p>
      {items.map((q, i) => <QueueRow key={`${q.track}-${i}`} q={q} i={i} />)}
    </div>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────
export function Chat({ messages, me, onSend }: { messages: ChatMsg[]; me: string; onSend: (t: string) => void }) {
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto osa-scroll px-4 pt-4 pb-2 space-y-1.5">
        {messages.length === 0 && <Empty mood="idle" title="C'est calme ici" text="Lance la conversation, ou envoie une réaction 🔥" />}
        {messages.map((m, i) => {
          if (m.system) return (
            <div key={i} className="flex justify-center py-1">
              <span className="text-[11px] text-white/45 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1">{m.text}</span>
            </div>
          );
          const mine = m.username === me;
          const first = i === 0 || messages[i - 1].username !== m.username || messages[i - 1].system;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} ${first ? "pt-2" : ""}`}>
              {!mine && <div className="w-7 shrink-0">{first && <Avatar name={m.username} size={28} />}</div>}
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {first && !mine && <span className="text-[11px] font-bold mb-0.5 ml-1" style={{ color: colorFor(m.username) }}>{m.username} <span className="text-white/30 font-medium">{m.time}</span></span>}
                <div className={`px-3.5 py-2 text-sm leading-relaxed break-words ${mine ? "bg-[#fdfcf7] text-[#111] rounded-[18px] rounded-br-md" : "bg-white/[0.08] text-white rounded-[18px] rounded-bl-md"}`}>
                  {m.text}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); const t = input.trim(); if (t) { onSend(t); setInput(""); } }}
        className="p-3 border-t border-white/[0.06] flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Écris à la salle…"
          className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-full px-4 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/25 transition"
        />
        <button type="submit" disabled={!input.trim()} className="w-10 h-10 rounded-full bg-[#fdfcf7] text-black grid place-items-center disabled:opacity-30 active:scale-90 transition" aria-label="Envoyer">
          <ArrowUp className="w-4 h-4" strokeWidth={2.6} />
        </button>
      </form>
    </div>
  );
}

// ── La salle : membres, pont Mac, réglages hôte ──────────────────────────────
function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`relative w-11 h-6 rounded-full transition ${on ? "bg-[#fdfcf7]" : "bg-white/15"} disabled:opacity-40`}>
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={`absolute top-0.5 w-5 h-5 rounded-full ${on ? "bg-black right-0.5" : "bg-white left-0.5"}`} />
    </button>
  );
}

export function People({
  users, bridges, hostId, socketId, isHost, isLocked, isBlindTest, roomId,
  onKick, onTransfer, onLock, onBlind,
}: {
  users: RoomUser[]; bridges: RoomUser[]; hostId: string | null; socketId: string; isHost: boolean;
  isLocked: boolean; isBlindTest: boolean; roomId: string;
  onKick: (id: string) => void; onTransfer: (id: string) => void; onLock: () => void; onBlind: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto osa-scroll p-4 space-y-6">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 px-1 mb-2">Dans la salle · {users.length}</p>
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {users.map((u) => (
              <motion.div key={u.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="group flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-white/[0.04]">
                <Avatar name={u.username} size={34} />
                <span className="font-semibold text-sm flex-1 min-w-0 truncate flex items-center gap-1.5">
                  {u.username}
                  {u.id === hostId && <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                  {u.id === socketId && <span className="text-[10px] font-bold text-white/40 bg-white/[0.06] rounded-full px-1.5 py-0.5">toi</span>}
                </span>
                {isHost && u.id !== socketId && (
                  <span className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => onTransfer(u.id)} title="Donner la couronne" className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] hover:bg-amber-300 hover:text-black transition"><Crown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onKick(u.id)} title="Expulser" className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] hover:bg-red-500 transition"><Ban className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 px-1 mb-2">Diffusion</p>
        {bridges.length ? bridges.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <span className="w-8 h-8 rounded-full bg-emerald-400/15 grid place-items-center"><Laptop className="w-4 h-4 text-emerald-300" /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{bridgeLabel(b.username)}</p>
              <p className="text-xs text-white/40">pilote Apple Music pour toute la salle</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          </div>
        )) : (
          <div className="px-4 py-4 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 text-sm text-white/55 leading-relaxed">
            Aucun Mac ne diffuse. Ouvre <b className="text-white">OsaNotch</b> → <b className="text-white">OsaParty</b> → <b className="text-white">Rejoindre</b> avec le code <span className="font-mono text-white">{roomId}</span>.
            <a href="https://notch.osalabs.fr" target="_blank" rel="noreferrer" className="block mt-2 text-white underline underline-offset-4 decoration-white/30 hover:decoration-white">Télécharger OsaNotch ↗</a>
          </div>
        )}
      </section>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 px-1 mb-2">Réglages {isHost ? "· tu es l'hôte" : "· réservés à l'hôte"}</p>
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.06]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            {isLocked ? <Lock className="w-4 h-4 text-white/60" /> : <Unlock className="w-4 h-4 text-white/60" />}
            <div className="flex-1"><p className="text-sm font-semibold">Verrouiller le salon</p><p className="text-xs text-white/40">Plus personne ne peut entrer</p></div>
            <Toggle on={isLocked} onClick={onLock} disabled={!isHost} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-base">🎯</span>
            <div className="flex-1"><p className="text-sm font-semibold">Blind test</p><p className="text-xs text-white/40">Pochette, titre et paroles cachés</p></div>
            <Toggle on={isBlindTest} onClick={onBlind} disabled={!isHost && !!hostId} />
          </div>
        </div>
      </section>

      <section className="pb-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 px-1 mb-2">Raccourcis</p>
        <div className="flex flex-wrap gap-2 text-xs text-white/50">
          <span className="px-2.5 py-1.5 rounded-lg bg-white/[0.05]"><kbd className="font-mono text-white">Espace</kbd> lecture / pause</span>
          <span className="px-2.5 py-1.5 rounded-lg bg-white/[0.05]"><kbd className="font-mono text-white">1–6</kbd> réactions</span>
          <span className="px-2.5 py-1.5 rounded-lg bg-white/[0.05]"><kbd className="font-mono text-white">S</kbd> vote skip</span>
        </div>
      </section>
    </div>
  );
}

// ── Blind test : deviner ─────────────────────────────────────────────────────
export function Guess({
  solved, solvers, scores, me, shake, onGuess,
}: {
  solved: boolean; solvers: string[]; scores: Record<string, number>; me: string; shake: number;
  onGuess: (track: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`);
        setResults((await r.json()).results || []);
      } catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { if (solved) { setQ(""); setResults([]); } }, [solved]);

  const board = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-2">
        {solved ? (
          <div className="rounded-2xl bg-emerald-400/10 border border-emerald-400/20 px-4 py-3 text-sm text-emerald-200 font-semibold">
            Bien joué ! Attends le prochain morceau 🎉
          </div>
        ) : (
          <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}
            className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] rounded-full px-4 focus-within:border-violet-300/40 transition">
            <Search className="w-4 h-4 text-white/40" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="C'est quoi ce son ?" className="flex-1 bg-transparent py-3 text-sm placeholder:text-white/30 focus:outline-none" />
          </motion.div>
        )}
        <p className="text-[11px] text-white/35 mt-2 px-2">Les 3 premiers marquent 10 · 6 · 3 pts{solvers.length ? ` — déjà trouvé par ${solvers.join(", ")}` : ""}</p>
      </div>
      <div className="flex-1 overflow-y-auto osa-scroll px-3 pb-3">
        {results.map((r) => (
          <button key={r.trackId} onClick={() => { onGuess(r.trackName); }} className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-white/[0.06] text-left transition">
            <img src={r.artworkUrl60} alt="" className="w-10 h-10 rounded-lg" />
            <div className="min-w-0"><p className="text-sm font-semibold truncate">{r.trackName}</p><p className="text-xs text-white/45 truncate">{r.artistName}</p></div>
          </button>
        ))}
        {!results.length && (
          <div className="px-2 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-2">Classement</p>
            {board.length === 0 && <p className="text-sm text-white/40">Personne n'a encore marqué.</p>}
            {board.map(([name, pts], i) => (
              <div key={name} className="flex items-center gap-3 py-2">
                <span className="w-6 text-center">{["🥇", "🥈", "🥉"][i] || <span className="text-white/30 text-xs font-mono">{i + 1}</span>}</span>
                <Avatar name={name} size={26} />
                <span className={`flex-1 text-sm font-semibold truncate ${name === me ? "text-white" : "text-white/75"}`}>{name}{name === me && " (toi)"}</span>
                <span className="osa-display font-extrabold text-sm">{pts}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
