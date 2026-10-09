"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Headphones, Loader2, Mic2, Music, Sparkles, Target } from "lucide-react";
import Mascot, { type Mood } from "@/components/osa/Mascot";
import { CodeSlots, Island, OsaBox, Pill, Shell, useNotices } from "@/components/osa/Kit";

const ACCENT = "#f9a8d4";
const ACCENT2 = "#c4b5fd";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState<null | "create" | "join">(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [hoverWhich, setHoverWhich] = useState<"create" | "join" | null>(null);
  const [focus, setFocus] = useState<"name" | "code" | null>(null);
  const [shake, setShake] = useState(0);
  const [greeted, setGreeted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const { notice, notify } = useNotices();

  // Le pseudo est mémorisé d'une visite à l'autre.
  useEffect(() => {
    try { const n = localStorage.getItem("osaparty:name"); if (n) { setUsername(n); setGreeted(true); } } catch {}
  }, []);
  useEffect(() => { try { if (username.trim()) localStorage.setItem("osaparty:name", username.trim()); } catch {} }, [username]);

  const needName = () => {
    if (username.trim()) return false;
    setShake((n) => n + 1);
    notify("Choisis d'abord un pseudo", "✏️", "bad");
    nameRef.current?.focus();
    return true;
  };

  const go = (code: string, mode: "create" | "join") => {
    setLoading(mode);
    router.push(`/room/${code}?username=${encodeURIComponent(username.trim())}`);
  };
  const createRoom = () => {
    if (needName()) return;
    go(Math.floor(100000 + Math.random() * 900000).toString(), "create");
  };
  const joinRoom = (code = roomId) => {
    if (needName()) return;
    if (code.length !== 6) { notify("Le code fait 6 chiffres", "🔢", "bad"); return; }
    go(code, "join");
  };

  // ── La mascotte anime l'accueil ──
  const name = username.trim();
  let mood: Mood = "idle";
  let say: string | null = greeted && name ? `Re-salut ${name} !` : "Prêt pour la soirée ?";
  let holding: "note" | null = null;
  if (loading) { mood = "dance"; holding = "note"; say = "C'est parti ! 🎶"; }
  else if (focus === "name") { mood = name ? "happy" : "think"; say = name ? `Enchanté ${name} !` : "Comment tu t'appelles ?"; }
  else if (focus === "code") { mood = "think"; say = "Je t'écoute…"; }
  else if (hoverWhich === "create") { mood = "excited"; holding = "note"; say = "On lance la musique ?"; }
  else if (hoverWhich === "join") { mood = "happy"; say = "Tape le code du salon"; }

  return (
    <Shell
      app="osaparty" accent={ACCENT} accent2={ACCENT2}
      island={<Island title="OsaParty" status="écoute synchronisée" accent={ACCENT} live notice={notice} />}
      right={<Pill href="https://notch.osalabs.fr"><Headphones className="w-4 h-4" /> <span className="hidden sm:inline">OsaNotch</span></Pill>}
    >
      <div className="flex-1 w-full max-w-[920px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 flex flex-col items-center">
        <div className="relative mt-6">
          <Mascot size={128} mood={mood} say={say} holding={holding} lookAt={hover} wave={!loading && !focus && !hoverWhich} glow={`${ACCENT}55`} />
        </div>

        <h1 className="osa-display text-center font-extrabold leading-[0.95] mt-6" style={{ fontSize: "clamp(40px, 7vw, 76px)" }}>
          Écoutez ensemble.<br /><span className="text-white/40">En même temps.</span>
        </h1>
        <p className="text-white/55 text-center mt-5 max-w-[540px] text-lg">Une soirée Apple Music partagée : on écoute, on réagit, on chante, on joue au blind test.</p>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {[
            { i: <Mic2 className="w-3.5 h-3.5" />, t: "Paroles synchronisées" },
            { i: <Sparkles className="w-3.5 h-3.5" />, t: "Chat & réactions" },
            { i: <Target className="w-3.5 h-3.5" />, t: "Blind test" },
            { i: <Music className="w-3.5 h-3.5" />, t: "Pont OsaNotch" },
          ].map((c) => (
            <span key={c.t} className="text-xs font-semibold text-white/60 bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1.5 flex items-center gap-1.5">{c.i}{c.t}</span>
          ))}
        </div>

        {/* pseudo */}
        <motion.div key={shake} animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : {}} transition={{ duration: 0.4 }} className="mt-10 w-full max-w-[360px]">
          <div className="relative">
            <input
              ref={nameRef}
              value={username}
              onChange={(e) => { setUsername(e.target.value.slice(0, 24)); setGreeted(false); }}
              onFocus={() => setFocus("name")}
              onBlur={() => setFocus(null)}
              onKeyDown={(e) => { if (e.key === "Enter") createRoom(); }}
              placeholder="Ton pseudo"
              className="w-full h-14 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-center text-lg font-semibold placeholder:text-white/30 focus:outline-none transition"
              style={{ boxShadow: focus === "name" ? `0 0 0 4px ${ACCENT}22, 0 0 0 1px ${ACCENT}` : "none" }}
              maxLength={24}
            />
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 w-full mt-6">
          <OsaBox as="button" accent={ACCENT} onClick={createRoom} onHover={(p) => { setHover(p); setHoverWhich(p ? "create" : null); }} active={loading === "create"} className="min-h-[250px]">
            <div className="h-full flex flex-col items-center justify-center text-center p-7 gap-4">
              <motion.div className="w-16 h-16 rounded-full bg-white/[0.08] grid place-items-center" whileHover={{ rotate: 12, scale: 1.06 }}>
                <Music className="w-7 h-7" />
              </motion.div>
              <div>
                <p className="osa-display text-2xl font-bold">Créer un salon</p>
                <p className="text-sm text-white/50 mt-1.5">Tu deviens l'hôte : invite tes amis<br />avec un code ou un QR</p>
              </div>
              <span className="mt-1 text-xs font-bold bg-[#fdfcf7] text-black rounded-full px-4 py-2 flex items-center gap-1.5">
                {loading === "create" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {loading === "create" ? "Création…" : "Lancer la soirée"}
              </span>
            </div>
          </OsaBox>

          <OsaBox accent={ACCENT} onHover={(p) => { setHover(p); setHoverWhich(p ? "join" : null); }} active={focus === "code"} className="min-h-[250px]">
            <div className="h-full flex flex-col items-center justify-center text-center p-7 gap-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/45">Rejoindre</p>
              <CodeSlots numeric value={roomId} onChange={(v) => { setRoomId(v); if (v.length === 6 && username.trim()) joinRoom(v); }} accent={ACCENT}
                onFocusChange={(f) => setFocus(f ? "code" : null)} />
              <button onClick={() => joinRoom()} disabled={roomId.length !== 6 || !!loading}
                className="h-10 px-5 rounded-full bg-[#fdfcf7] text-black text-sm font-bold disabled:opacity-30 flex items-center gap-2 transition">
                {loading === "join" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Entrer
              </button>
              <p className="text-[11px] text-white/35">Le code à 6 chiffres de l'hôte</p>
            </div>
          </OsaBox>
        </div>

        <AnimatePresence>
          <motion.a
            href="https://notch.osalabs.fr" target="_blank" rel="noreferrer"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mt-8 flex items-center gap-3 rounded-full bg-white/[0.04] border border-white/[0.08] pl-2 pr-5 py-2 hover:bg-white/[0.08] transition group"
          >
            <span className="w-9 h-9 rounded-full bg-black grid place-items-center"><Headphones className="w-4 h-4 text-white/70" /></span>
            <span className="text-sm text-white/60 group-hover:text-white transition">Le Mac qui diffuse la musique utilise <b className="text-white">OsaNotch</b> ↗</span>
          </motion.a>
        </AnimatePresence>
      </div>
    </Shell>
  );
}
