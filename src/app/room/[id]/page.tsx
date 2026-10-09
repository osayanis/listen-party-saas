"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import io, { type Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Copy, Crown, FastForward, Pause, Play, Share2, SkipForward, Sparkles, Target } from "lucide-react";
import Confetti from "react-confetti";

import Island from "@/components/party/Island";
import Mascot from "@/components/party/Mascot";
import Wrapped, { type WrappedData } from "@/components/party/Wrapped";
import { Avatar, Chat, Guess, Lyrics, People, Queue } from "@/components/party/Panels";
import {
  REACTIONS, dominantColor, findArtwork, findLyrics, fmtTime, hasTrack, isBridge,
  type ChatMsg, type LyricLine, type Notice, type RoomUser, type TrackInfo,
} from "@/components/party/lib";

type Tab = "lyrics" | "guess" | "queue" | "chat" | "people";
type Playback = { pos: number; at: number; playing: boolean };
type Floating = { id: number; emoji: string; username: string; x: number; y: number; drift: number };

const LAVENDER: [number, number, number] = [196, 181, 253];
const live = (p: Playback) => (p.playing ? p.pos + (performance.now() - p.at) / 1000 : p.pos);
const NOTICE_ICONS: Record<string, string> = { join: "👋", leave: "🚪", bridge: "💻", host: "👑", lock: "🔒", game: "🎯", skip: "⏭", win: "🎯" };

export default function Room() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const roomId = String(params.id);
  const username = (search.get("username") || "Invité").trim().slice(0, 24) || "Invité";

  const sock = useRef<Socket | null>(null);
  const [socketId, setSocketId] = useState("");
  const [allUsers, setAllUsers] = useState<RoomUser[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const [track, setTrack] = useState<TrackInfo>({ track: "En attente...", artist: "", state: "paused", queue: [] });
  const [playback, setPlayback] = useState<Playback>({ pos: 0, at: 0, playing: false });
  const [, setTick] = useState(0);
  const trackKey = useRef("");
  const metaToken = useRef(0);
  const [cover, setCover] = useState<string | null>(null);
  const [rgb, setRgb] = useState<[number, number, number]>(LAVENDER);
  const [lyrics, setLyrics] = useState<{ lines: LyricLine[]; plain: string; loading: boolean }>({ lines: [], plain: "", loading: false });

  const [skip, setSkip] = useState({ votes: 0, required: 1 });
  const [voted, setVoted] = useState(false);
  const [isBlindTest, setIsBlindTest] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [solvers, setSolvers] = useState<string[]>([]);
  const [shake, setShake] = useState(0);

  const [tab, setTab] = useState<Tab>("lyrics");
  const tabRef = useRef<Tab>("lyrics");
  tabRef.current = tab;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const [floating, setFloating] = useState<Floating[]>([]);
  const barRef = useRef<HTMLDivElement>(null);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wrapped, setWrapped] = useState<WrappedData | null>(null);
  const [fatal, setFatal] = useState<{ title: string; text: string } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [greet, setGreet] = useState(true);
  // La mascotte réagit à ce qui se passe dans le salon (quelques secondes).
  const [buzz, setBuzz] = useState<{ mood: "excited" | "cheer" | "happy" | "love"; say?: string } | null>(null);
  const buzzTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const react2 = useCallback((b: { mood: "excited" | "cheer" | "happy" | "love"; say?: string }, ms = 2600) => {
    setBuzz(b);
    if (buzzTimer.current) clearTimeout(buzzTimer.current);
    buzzTimer.current = setTimeout(() => setBuzz(null), ms);
  }, []);
  const firstTrack = useRef(true);
  const [joinUrl, setJoinUrl] = useState("");

  const users = allUsers.filter((u) => !isBridge(u.username));
  const bridges = allUsers.filter((u) => isBridge(u.username));
  const isHost = !!socketId && socketId === hostId;
  const solvedByMe = solvers.includes(username);
  const hiddenTrack = isBlindTest && !solvedByMe;
  const showTrack = hasTrack(track);
  const accent = isBlindTest ? LAVENDER : rgb;
  const acc = (a = 1) => `rgb(${accent[0]} ${accent[1]} ${accent[2]} / ${a})`;

  const notify = useCallback((text: string, icon?: string, tone?: Notice["tone"]) => {
    setNotices((n) => [...n.slice(-3), { id: Date.now() + Math.random(), text, icon, tone }]);
  }, []);
  useEffect(() => {
    if (!notices.length) return;
    const t = setTimeout(() => setNotices((n) => n.slice(1)), 3000);
    return () => clearTimeout(t);
  }, [notices]);

  // Pochette, couleur et paroles d'un nouveau morceau (les réponses périmées sont ignorées).
  const loadMeta = useCallback((t: TrackInfo) => {
    const token = ++metaToken.current;
    if (!hasTrack(t)) { setCover(null); setLyrics({ lines: [], plain: "", loading: false }); return; }
    setLyrics({ lines: [], plain: "", loading: true });
    findArtwork(t.track, t.artist).then((url) => {
      if (token !== metaToken.current) return;
      setCover(url);
      if (url) dominantColor(url).then((c) => token === metaToken.current && setRgb(c));
    });
    findLyrics(t.track, t.artist).then((l) => token === metaToken.current && setLyrics({ lines: l.synced, plain: l.plain, loading: false }));
  }, []);

  const applyTrack = useCallback((t: TrackInfo, ageMs: number) => {
    const key = `${t.track}::${t.artist}`;
    const changed = key !== trackKey.current;
    if (changed) {
      trackKey.current = key; loadMeta(t); setVoted(false);
      if (hasTrack(t)) {
        if (!firstTrack.current) react2({ mood: "excited", say: ["Oh, j'adore celui-là !", "Bon choix 👌", "Ça c'est un son !", "On monte le son ?"][Math.floor(Math.random() * 4)] });
        firstTrack.current = false;
      }
    }
    setTrack(t);
    const playing = t.state === "playing";
    if (typeof t.position === "number") {
      setPlayback({ pos: t.position, at: performance.now() - (playing ? ageMs : 0), playing });
    } else {
      setPlayback((p) => ({ pos: changed ? 0 : live(p), at: performance.now(), playing }));
    }
  }, [loadMeta, react2]);

  // ── Connexion temps réel ────────────────────────────────────────────────
  useEffect(() => {
    setJoinUrl(`${window.location.origin}/room/${roomId}`);
    const s = io();
    sock.current = s;

    // (Re)rejoindre à chaque connexion : survit aux coupures réseau.
    s.on("connect", () => { setSocketId(s.id || ""); s.emit("join-room", roomId, username); });

    s.on("room-update", (d: any) => {
      setAllUsers(d.users || []);
      setHostId(d.hostId ?? null);
      setIsLocked(!!d.isLocked);
      if (typeof d.skipVotes === "number") setSkip({ votes: d.skipVotes, required: d.requiredVotes || 1 });
      setIsBlindTest(!!d.isBlindTest);
      setScores(d.blindTestScores || {});
      setSolvers(d.solvers || []);
      if (d.trackInfo) applyTrack(d.trackInfo, d.trackAge || 0);
    });
    s.on("bridge-state", (st: any) => {
      applyTrack(st, st.age || 0);
      if (Array.isArray(st.solvers)) setSolvers(st.solvers);
    });
    s.on("web-action", (d: any) => {
      if (d.state === "playing" || d.state === "paused") setPlayback((p) => ({ pos: live(p), at: performance.now(), playing: d.state === "playing" }));
    });
    s.on("skip-votes-update", (d: any) => setSkip(d));

    s.on("new-message", (m: ChatMsg) => {
      setMessages((prev) => [...prev.slice(-199), m]);
      if (m.system) {
        if (m.kind && m.kind !== "win") notify(m.text, NOTICE_ICONS[m.kind], m.kind === "leave" ? "bad" : m.kind === "game" ? "game" : "info");
        if (m.kind === "join" && !m.text.startsWith(username + " ")) react2({ mood: "happy", say: `Salut ${m.text.replace(/ a rejoint la soirée$/, "")} 👋` });
        if (m.kind === "win") notify(m.text, "🎯", "game");
      } else if (m.username !== username && tabRef.current !== "chat") {
        setUnread((u) => u + 1);
        notify(`${m.username} : ${m.text}`, "💬");
      }
    });
    s.on("new-reaction", (r: { emoji: string; username?: string; id: number }) => {
      const rect = barRef.current?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 + (Math.random() * 160 - 80) : window.innerWidth / 2;
      const y = rect ? rect.top : window.innerHeight - 160;
      setFloating((f) => [...f.slice(-24), { id: r.id, emoji: r.emoji, username: r.username || "", x, y, drift: Math.random() * 120 - 60 }]);
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== r.id)), 3200);
      react2({ mood: r.emoji === "😍" ? "love" : "excited" }, 1400);
    });

    s.on("blind-test-update", (on: boolean) => { setIsBlindTest(on); setSolvers([]); setTab(on ? "guess" : "lyrics"); });
    s.on("blind-test-scores", (sc: Record<string, number>) => setScores(sc));
    s.on("blind-test-winner", (d: any) => {
      setSolvers(d.solvers || []);
      if (d.username === username || d.rank === 0) { setConfetti(true); setTimeout(() => setConfetti(false), 4500); }
      react2({ mood: "cheer", say: d.username === username ? "Bien joué toi ! 🎉" : `Bravo ${d.username} !` }, 3200);
    });
    s.on("blind-test-wrong", () => { setShake((n) => n + 1); notify("Raté ! Ce n'est pas ça 🙈", "✖", "bad"); });
    s.on("blind-test-already", () => notify("Tu as déjà trouvé ce morceau", "✔", "good"));

    s.on("room-locked", () => setFatal({ title: "Salon verrouillé", text: "L'hôte a fermé les portes de cette soirée." }));
    s.on("kicked", () => setFatal({ title: "Tu as été expulsé", text: "L'hôte t'a retiré du salon." }));

    return () => { s.disconnect(); sock.current = null; };
  }, [roomId, username, applyTrack, notify, react2]);

  // Horloge locale : la position avance entre deux mises à jour du Mac.
  useEffect(() => {
    if (!playback.playing) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [playback.playing]);

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    const g = setTimeout(() => setGreet(false), 3200);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(g); };
  }, []);

  useEffect(() => { if (tab === "chat") setUnread(0); }, [tab, messages.length]);

  // Titre de l'onglet (sans rien révéler pendant un blind test).
  useEffect(() => {
    document.title = isBlindTest ? `🎯 Blind test · #${roomId}` : showTrack ? `${track.track} — ${track.artist} · OsaParty` : `#${roomId} · OsaParty`;
  }, [isBlindTest, showTrack, track.track, track.artist, roomId]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const emit = (ev: string, ...args: any[]) => sock.current?.emit(ev, roomId, ...args);
  const togglePlay = () => {
    if (!bridges.length) { notify("Aucun Mac ne diffuse dans ce salon", "💻", "bad"); return; }
    const next = playback.playing ? "paused" : "playing";
    setPlayback((p) => ({ pos: live(p), at: performance.now(), playing: !p.playing }));
    emit("web-action", { state: next });
  };
  const react = (e: string) => emit("send-reaction", e, username);
  const voteSkip = () => { if (voted) return; setVoted(true); emit("vote-skip"); };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "OsaParty", text: `Rejoins ma soirée OsaParty (code ${roomId})`, url: joinUrl }); return; } catch {} }
    setShareOpen((o) => !o);
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  const openWrapped = () => sock.current?.emit("get-wrapped", roomId, (d: WrappedData) => setWrapped(d));
  const leave = () => { sock.current?.disconnect(); router.push("/"); };

  // Raccourcis clavier (hors champs de saisie).
  const keys = useRef({ togglePlay, react, voteSkip });
  keys.current = { togglePlay, react, voteSkip };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") { e.preventDefault(); keys.current.togglePlay(); }
      else if (/^[1-6]$/.test(e.key)) keys.current.react(REACTIONS[Number(e.key) - 1]);
      else if (e.key.toLowerCase() === "s") keys.current.voteSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pos = Math.min(live(playback), track.duration || Infinity);
  const progress = track.duration ? Math.min(1, pos / track.duration) : 0;
  const mascotMood = !bridges.length && !showTrack ? "sleep" : playback.playing && !hiddenTrack ? "dance" : hiddenTrack ? "think" : "idle";
  const tabs: { id: Tab; label: string }[] = [
    isBlindTest ? { id: "guess", label: "Deviner" } : { id: "lyrics", label: "Paroles" },
    { id: "queue", label: "À suivre" },
    { id: "chat", label: "Chat" },
    { id: "people", label: `Salle · ${users.length}` },
  ];
  const visibleTab: Tab = tab === "lyrics" && isBlindTest ? "guess" : tab === "guess" && !isBlindTest ? "lyrics" : tab;
  const names = users.map((u) => (u.username === username ? "toi" : u.username));
  const who = names.length <= 2 ? names.join(" et ") : `${names.slice(0, 2).join(", ")} et ${names.length - 2} autre${names.length > 3 ? "s" : ""}`;

  return (
    <div className="relative min-h-[100dvh] text-white overflow-x-hidden bg-[#0a0a0c]">
      {confetti && dims.w > 0 && <Confetti width={dims.w} height={dims.h} recycle={false} numberOfPieces={420} colors={["#fdfcf7", "#c4b5fd", "#fcd34d", "#f9a8d4"]} />}

      {/* ── Fond : pochette floutée + grille canvas OsaNotch ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatePresence>
          {cover && !hiddenTrack && (
            <motion.div key={cover} initial={{ opacity: 0 }} animate={{ opacity: 0.32 }} exit={{ opacity: 0 }} transition={{ duration: 1.6 }}
              className="absolute inset-0 bg-cover bg-center scale-125 blur-[110px]" style={{ backgroundImage: `url(${cover})` }} />
          )}
        </AnimatePresence>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[110vw] h-[60vh] rounded-full blur-[120px] transition-colors duration-[1500ms]" style={{ background: `radial-gradient(circle, ${acc(0.22)}, transparent 70%)` }} />
        <div className="absolute inset-0 osa-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_80%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]" />
      </div>

      {/* ── Réactions qui s'envolent ── */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        <AnimatePresence>
          {floating.map((f) => (
            <motion.div key={f.id} className="absolute flex flex-col items-center" style={{ left: f.x, top: f.y }}
              initial={{ opacity: 0, y: 0, x: "-50%", scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -380, x: `calc(-50% + ${f.drift}px)`, scale: [0.5, 1.35, 1.2, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: "easeOut" }}>
              <span className="text-5xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]">{f.emoji}</span>
              {f.username && <span className="mt-1 text-[11px] font-bold bg-black/60 backdrop-blur rounded-full px-2 py-0.5">{f.username}</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── En-tête : quitter · île · actions ── */}
      <header className="relative z-30 grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-4 sm:px-8 pt-4">
        <div>
          <button onClick={leave} className="h-11 pl-2.5 pr-4 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/10 flex items-center gap-1 text-sm font-semibold text-white/80 transition">
            <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
        <div className="relative flex justify-center">
          <Island roomId={roomId} count={users.length} playing={playback.playing && showTrack} accent={acc()} notice={notices[0] || null}
            isLocked={isLocked} isBlindTest={isBlindTest} onClick={() => setShareOpen((o) => !o)} />
          <AnimatePresence>
            {shareOpen && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="absolute top-14 w-[300px] rounded-[28px] bg-black border border-white/10 p-5 shadow-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Inviter des amis</p>
                <p className="font-mono text-4xl font-bold tracking-[0.2em] mt-2">{roomId}</p>
                <div className="mt-4 bg-[#fdfcf7] rounded-2xl p-4 grid place-items-center">
                  {joinUrl && <QRCodeSVG value={joinUrl} size={200} bgColor="#fdfcf7" fgColor="#111111" />}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={copyLink} className="flex-1 h-10 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold flex items-center justify-center gap-2 transition">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Lien copié" : "Copier le lien"}
                  </button>
                  <button onClick={share} className="w-10 h-10 rounded-full bg-[#fdfcf7] text-black grid place-items-center" aria-label="Partager"><Share2 className="w-4 h-4" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex justify-end gap-2">
          {(isHost || !hostId) && (
            <button onClick={() => emit("toggle-blind-test", !isBlindTest)}
              className={`hidden sm:flex h-11 px-4 rounded-full border text-sm font-semibold items-center gap-2 transition ${isBlindTest ? "bg-violet-300 text-black border-violet-300" : "bg-white/[0.06] border-white/10 hover:bg-white/10 text-white/80"}`}>
              <Target className="w-4 h-4" /> <span className="hidden md:inline">{isBlindTest ? "Arrêter" : "Blind test"}</span>
            </button>
          )}
          <button onClick={openWrapped} className="h-11 px-4 rounded-full bg-[#fdfcf7] text-black text-sm font-bold flex items-center gap-2 hover:scale-[1.03] active:scale-95 transition">
            <Sparkles className="w-4 h-4" /> <span className="hidden md:inline">Fin de soirée</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-8 pt-8 lg:pt-10 pb-10 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] gap-8 lg:gap-12 items-center">
        {/* ── Scène : pochette, titre, contrôles ── */}
        <section className="flex flex-col items-center">
          <div className="relative w-[min(78vw,360px,40vh)] aspect-square mt-6">
            {/* halo couleur de la pochette, qui respire en lecture */}
            <motion.div className="absolute -inset-10 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${acc(0.55)}, transparent 68%)` }}
              animate={playback.playing ? { scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] } : { scale: 0.92, opacity: 0.5 }}
              transition={playback.playing ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6 }} />

            {/* la mascotte perchée sur la pochette */}
            <div className="absolute -top-[66px] right-5 z-20">
              <Mascot size={84} mood={greet ? "happy" : buzz ? buzz.mood : mascotMood} wave={greet} glow={acc(0.4)}
                say={greet ? `Salut ${username} !` : buzz?.say || null} holding={playback.playing && !hiddenTrack && !buzz ? "note" : null} />
            </div>

            <motion.div className="relative w-full h-full" animate={{ scale: playback.playing || !showTrack || hiddenTrack ? 1 : 0.92 }} transition={{ type: "spring", stiffness: 220, damping: 22 }}>
              <AnimatePresence mode="popLayout">
                {hiddenTrack ? (
                  <motion.div key="blind" initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }} transition={{ duration: 0.5 }}
                    className="absolute inset-0 rounded-[32px] bg-black border border-violet-300/20 overflow-hidden grid place-items-center">
                    <div className="absolute inset-0 osa-grid opacity-70" />
                    <motion.div className="absolute w-[72%] aspect-square rounded-full"
                      style={{ background: "repeating-radial-gradient(circle, #141418 0 3px, #0d0d10 3px 6px)", boxShadow: "0 0 80px rgba(196,181,253,0.25)" }}
                      animate={{ rotate: 360 }} transition={{ duration: playback.playing ? 4 : 30, repeat: Infinity, ease: "linear" }}>
                      <div className="absolute inset-[38%] rounded-full bg-violet-300/80" />
                    </motion.div>
                    <span className="relative osa-display text-[120px] font-extrabold text-white drop-shadow-[0_6px_30px_rgba(196,181,253,0.6)]">?</span>
                  </motion.div>
                ) : showTrack && cover ? (
                  <motion.img key={cover} src={cover} alt="" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                    className="absolute inset-0 w-full h-full object-cover rounded-[32px] border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]" />
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-[32px] bg-black/70 border border-white/10 overflow-hidden flex flex-col items-center justify-center text-center p-8">
                    <div className="absolute inset-0 osa-grid opacity-60" />
                    <p className="relative osa-display text-2xl font-bold">{showTrack ? "♪" : "En attente d'un Mac"}</p>
                    {!showTrack && (
                      <p className="relative text-sm text-white/50 mt-3 leading-relaxed max-w-[260px]">
                        Ouvre <b className="text-white">OsaNotch</b> → <b className="text-white">OsaParty</b> → <b className="text-white">Rejoindre</b> et tape <span className="font-mono text-white">{roomId}</span>.
                      </p>
                    )}
                    {!showTrack && (
                      <a href="https://notch.osalabs.fr" target="_blank" rel="noreferrer" className="relative mt-5 text-xs font-bold bg-[#fdfcf7] text-black rounded-full px-4 py-2 hover:scale-105 transition">Télécharger OsaNotch</a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="w-[min(86vw,420px)] mt-8 text-center">
            <AnimatePresence mode="wait">
              <motion.div key={hiddenTrack ? "blind" : track.track} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <h1 className="osa-display font-extrabold leading-[1.05] line-clamp-2" style={{ fontSize: "clamp(28px, 3.2vw, 42px)" }}>
                  {hiddenTrack ? "Quel est ce titre ?" : showTrack ? track.track : "Le salon est prêt"}
                </h1>
                <p className="text-white/55 text-lg mt-2 truncate">
                  {hiddenTrack ? "Devine-le dans l'onglet de droite" : showTrack ? track.artist : "La musique démarre dès qu'un Mac diffuse."}
                </p>
              </motion.div>
            </AnimatePresence>

            {showTrack && !!track.duration && (
              <div className="mt-6">
                <div className="h-1.5 rounded-full bg-white/[0.12] overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="flex justify-between mt-2 font-mono text-[11px] text-white/45">
                  <span>{fmtTime(pos)}</span><span>-{fmtTime((track.duration || 0) - pos)}</span>
                </div>
              </div>
            )}

            {/* contrôles */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <button onClick={voteSkip} title={`Voter pour passer (${skip.votes}/${skip.required})`}
                className={`relative w-14 h-14 rounded-full grid place-items-center transition ${voted ? "bg-white/[0.14]" : "bg-white/[0.07] hover:bg-white/[0.12]"}`}>
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                  <motion.circle cx="28" cy="28" r="26" fill="none" stroke="#fdfcf7" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 26} animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - Math.min(1, skip.votes / Math.max(1, skip.required))) }} />
                </svg>
                <SkipForward className="w-5 h-5" />
                {skip.votes > 0 && <span className="absolute -bottom-6 text-[10px] font-bold text-white/50 font-mono">{skip.votes}/{skip.required}</span>}
              </button>

              <motion.button onClick={togglePlay} whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}
                className={`w-[76px] h-[76px] rounded-full bg-[#fdfcf7] text-black grid place-items-center ${bridges.length ? "" : "opacity-40"}`}
                style={{ boxShadow: `0 18px 50px -12px ${acc(0.7)}` }} aria-label={playback.playing ? "Pause" : "Lecture"}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={playback.playing ? "p" : "l"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.15 }}>
                    {playback.playing ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black ml-1" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>

              {isHost ? (
                <button onClick={() => emit("force-skip")} title="Passer (hôte)" className="relative w-14 h-14 rounded-full bg-white/[0.07] hover:bg-white/[0.12] grid place-items-center transition">
                  <FastForward className="w-5 h-5" />
                  <Crown className="absolute -top-1 -right-1 w-4 h-4 text-amber-300" />
                </button>
              ) : (
                <button onClick={share} title="Inviter" className="w-14 h-14 rounded-full bg-white/[0.07] hover:bg-white/[0.12] grid place-items-center transition">
                  <Share2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* réactions */}
            <div ref={barRef} className="inline-flex items-center gap-1 mt-7 p-1.5 rounded-full bg-black/55 border border-white/10 backdrop-blur-xl">
              {REACTIONS.map((e, i) => (
                <motion.button key={e} onClick={() => react(e)} whileHover={{ y: -3, scale: 1.12 }} whileTap={{ scale: 1.35 }}
                  className="w-11 h-11 rounded-full grid place-items-center text-[22px] hover:bg-white/10 transition-colors" title={`Réaction (${i + 1})`}>
                  {e}
                </motion.button>
              ))}
            </div>

            {/* qui écoute */}
            <div className="flex items-center justify-center gap-3 mt-6 text-sm text-white/55">
              <div className="flex -space-x-2">
                {users.slice(0, 5).map((u) => <Avatar key={u.id} name={u.username} size={28} ring />)}
                {users.length > 5 && <span className="w-7 h-7 rounded-full bg-white/10 ring-2 ring-[#0b0b0e] grid place-items-center text-[10px] font-bold">+{users.length - 5}</span>}
              </div>
              <span className="truncate">{users.length ? `${who} écoute${users.length > 1 ? "nt" : ""}` : "Personne pour l'instant"}</span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${bridges.length ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${bridges.length ? "bg-emerald-400" : "bg-amber-300"}`} />
                {bridges.length ? "Mac connecté" : "Aucun Mac"}
              </span>
            </div>
          </div>
        </section>

        {/* ── Panneau : paroles · file · chat · salle ── */}
        <section className="rounded-[32px] bg-black/55 backdrop-blur-2xl border border-white/[0.08] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] flex flex-col h-[560px] lg:h-[min(720px,calc(100dvh-130px))] overflow-hidden">
          <div className="p-3">
            <div className="flex bg-white/[0.05] rounded-full p-1">
              {tabs.map((t) => {
                const on = visibleTab === t.id;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex-1 py-2 text-[13px] font-semibold rounded-full transition-colors ${on ? "text-black" : "text-white/55 hover:text-white"}`}>
                    {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-[#fdfcf7]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span className="relative">{t.label}</span>
                    {t.id === "chat" && unread > 0 && !on && (
                      <span className="absolute -top-0.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-black grid place-items-center" style={{ background: acc() }}>{unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div key={visibleTab} className="absolute inset-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                {visibleTab === "lyrics" && <Lyrics lines={lyrics.lines} plain={lyrics.plain} pos={pos} loading={lyrics.loading} hidden={hiddenTrack} />}
                {visibleTab === "guess" && <Guess solved={solvedByMe} solvers={solvers} scores={scores} me={username} shake={shake} onGuess={(t) => emit("guess-blind-test", username, t, "")} />}
                {visibleTab === "queue" && <Queue items={track.queue || []} hidden={isBlindTest} />}
                {visibleTab === "chat" && <Chat messages={messages} me={username} onSend={(t) => emit("chat-message", username, t)} />}
                {visibleTab === "people" && (
                  <People users={users} bridges={bridges} hostId={hostId} socketId={socketId} isHost={isHost} isLocked={isLocked} isBlindTest={isBlindTest} roomId={roomId}
                    onKick={(id) => emit("kick-user", id)} onTransfer={(id) => emit("transfer-host", id)} onLock={() => emit("toggle-lock")} onBlind={() => emit("toggle-blind-test", !isBlindTest)} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {wrapped && <Wrapped data={wrapped} roomId={roomId} accent={acc()} onClose={() => setWrapped(null)} />}
      </AnimatePresence>

      {/* ── Écran de fin : expulsé / salon verrouillé ── */}
      <AnimatePresence>
        {fatal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[300] bg-[#0a0a0c] grid place-items-center p-6">
            <div className="absolute inset-0 osa-grid opacity-50" />
            <div className="relative flex flex-col items-center text-center">
              <Mascot size={96} mood="sad" />
              <h2 className="osa-display text-4xl font-extrabold mt-8">{fatal.title}</h2>
              <p className="text-white/55 mt-3">{fatal.text}</p>
              <button onClick={() => router.push("/")} className="mt-8 h-12 px-6 rounded-full bg-[#fdfcf7] text-black font-bold hover:scale-105 transition">Retour à l'accueil</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
