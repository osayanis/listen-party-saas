"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import io from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Users, ListMusic, MessageCircle, SkipForward, Mic2, X, Maximize2, Search, Trophy, Music, Disc, ChevronLeft, Crown, Ban, Lock, Unlock, Download } from "lucide-react";
import Confetti from 'react-confetti';

let socket: any;

export default function Room() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const username = searchParams.get("username") || "Invite";
  
  const [socketId, setSocketId] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const isHost = socketId === hostId;

  const [isPlaying, setIsPlaying] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [trackInfo, setTrackInfo] = useState({ track: "En attente du Bridge...", artist: "Mac OS", state: "paused", queue: [] as any[], position: 0 });
  const [coverUrl, setCoverUrl] = useState("https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80");
  
  const [activeTab, setActiveTab] = useState<'queue' | 'chat' | 'lyrics' | 'search' | 'mod'>('queue');
  const [reactions, setReactions] = useState<{id: number, emoji: string}[]>([]);
  const [chatMessages, setChatMessages] = useState<{username: string, text: string, time: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  
  const [qrExpanded, setQrExpanded] = useState(false);
  const [syncedLyrics, setSyncedLyrics] = useState<{time: number, text: string}[]>([]);
  const [plainLyrics, setPlainLyrics] = useState("");
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 1 });
  
  const [isBlindTest, setIsBlindTest] = useState(false);
  const [blindTestScores, setBlindTestScores] = useState<any>({});
  const [showConfetti, setShowConfetti] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [wrappedData, setWrappedData] = useState<any>(null);
  const [showWrapped, setShowWrapped] = useState(false);
  const [wrappedStep, setWrappedStep] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const fetchArtworkAndLyrics = async (track: string, artist: string) => {
    if (!track || track === "Aucune musique" || track === "En attente du Bridge...") return;
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(track + " " + artist)}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const hdImage = data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
        setCoverUrl(hdImage);
      }
      
      setSyncedLyrics([]);
      setPlainLyrics("Recherche des paroles...");
      
      const lyricsRes = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`);
      if (lyricsRes.ok) {
        const lyricsData = await lyricsRes.json();
        if (lyricsData.syncedLyrics) {
          const lines = lyricsData.syncedLyrics.split('\n');
          const parsed = [];
          for (const line of lines) {
            const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
            if (match) {
              const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
              parsed.push({ time, text: match[3].trim() });
            }
          }
          setSyncedLyrics(parsed);
          setPlainLyrics("");
        } else if (lyricsData.plainLyrics) {
          setPlainLyrics(lyricsData.plainLyrics);
        } else {
          setPlainLyrics("🎶 Paroles Instrumentales 🎶");
        }
      } else {
        setPlainLyrics("Aucune parole trouvée.");
      }
    } catch (e) {
      console.error(e);
      setPlainLyrics("Erreur de récupération des paroles.");
    }
  };

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/room/${roomId}`);
    
    socket = io();
    socket.emit("join-room", roomId, username);

    socket.on("connect", () => {
        setSocketId(socket.id);
    });

    socket.on("room-locked", () => {
        alert("Ce salon a été verrouillé par l'hôte. Impossible de rejoindre.");
        router.push("/");
    });

    socket.on("kicked", () => {
        alert("Vous avez été expulsé du salon.");
        router.push("/");
    });

    socket.on("room-update", (roomData: any) => {
      setUsers(roomData.users.filter((u:any) => !u.username.includes("MacBridge")));
      setHostId(roomData.hostId);
      setIsLocked(roomData.isLocked);
      setSkipVotes({ votes: roomData.skipVotes, required: Math.max(1, Math.ceil(roomData.users.length / 2)) });
      setIsBlindTest(roomData.isBlindTest);
      setBlindTestScores(roomData.blindTestScores);
      if (roomData.isBlindTest && activeTab === 'lyrics') setActiveTab("search");
      if (roomData.trackInfo) {
        setTrackInfo(roomData.trackInfo);
        setIsPlaying(roomData.trackInfo.state === "playing");
        setCurrentPlaybackTime(roomData.trackInfo.position || 0);
        fetchArtworkAndLyrics(roomData.trackInfo.track, roomData.trackInfo.artist);
      }
    });

    socket.on("bridge-state", (state: any) => {
      setTrackInfo((prev) => {
        if (prev.track !== state.track || prev.artist !== state.artist) {
          fetchArtworkAndLyrics(state.track, state.artist);
          setShowConfetti(false);
          setSearchQuery("");
          setSearchResults([]);
        }
        return state;
      });
      setIsPlaying(state.state === "playing");
      setCurrentPlaybackTime(state.position || 0);
    });

    socket.on("new-reaction", (data: any) => {
      setReactions((prev) => [...prev, data]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== data.id)), 4000); 
    });

    socket.on("new-message", (msg: any) => {
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    socket.on("blind-test-update", (status: boolean) => {
        setIsBlindTest(status);
        if (status) setActiveTab("search");
        else setActiveTab("queue");
    });
    
    socket.on("blind-test-scores", (scores: any) => setBlindTestScores(scores));
    socket.on("blind-test-winner", (data: any) => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    });
    
    socket.on("blind-test-wrong", () => {
        alert("Ce n'est pas la bonne musique ! Réessaie !");
    });

    socket.on("skip-votes-update", (data: any) => setSkipVotes(data));

    return () => socket.disconnect();
  }, [roomId, username, router]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) interval = setInterval(() => setCurrentPlaybackTime(prev => prev + 0.1), 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (activeTab === 'lyrics' && syncedLyrics.length > 0 && !isBlindTest) {
      const activeLine = document.getElementById("active-lyric");
      if (activeLine && lyricsContainerRef.current) activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentPlaybackTime, activeTab, syncedLyrics, isBlindTest]);

  useEffect(() => {
    const timer = setTimeout(async () => {
        if (!searchQuery.trim()) return setSearchResults([]);
        try {
            const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=5`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch(e) {}
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const togglePlay = () => {
    const newState = isPlaying ? "paused" : "playing";
    setIsPlaying(!isPlaying);
    socket.emit("web-action", roomId, { state: newState });
  };

  const sendReaction = (emoji: string) => socket.emit("send-reaction", roomId, emoji);
  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit("chat-message", roomId, username, chatInput.trim());
    setChatInput("");
  };
  
  const voteSkip = () => socket.emit("vote-skip", roomId);
  const forceSkip = () => socket.emit("force-skip", roomId);
  const toggleBlindTest = () => socket.emit("toggle-blind-test", roomId, !isBlindTest);
  const toggleLock = () => socket.emit("toggle-lock", roomId);
  const kickUser = (id: string) => socket.emit("kick-user", roomId, id);

  const submitGuess = (trackName: string, artistName: string) => {
      socket.emit("guess-blind-test", roomId, username, trackName, artistName);
      setSearchQuery("");
      setSearchResults([]);
  };

  const leaveRoom = () => {
      if (socket) socket.disconnect();
      router.push("/");
  };

  const startWrapped = () => {
      socket.emit("get-wrapped", roomId, (data: any) => {
          setWrappedData(data);
          setShowWrapped(true);
          setWrappedStep(0);
      });
  };

  const exportPlaylist = () => {
      if (!wrappedData) return;
      const text = "🎵 ListenParty Playlist - " + new Date().toLocaleDateString() + "\n\n" + 
                   wrappedData.history.map((h:any, i:number) => `${i+1}. ${h.track} - ${h.artist}`).join('\n');
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ListenParty_Playlist_${roomId}.txt`;
      a.click();
  };

  let activeLyricIndex = -1;
  for (let i = 0; i < syncedLyrics.length; i++) {
    if (currentPlaybackTime >= syncedLyrics[i].time) activeLyricIndex = i;
  }

  const sortedScores = Object.entries(blindTestScores).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 font-sans text-white overflow-hidden relative">
      
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} />}

      {/* BACKGROUND DYNAMIQUE */}
      <div 
        className="fixed inset-0 z-0 scale-125 blur-[100px] opacity-60 bg-cover bg-center transition-all duration-[2000ms] ease-in-out"
        style={{ backgroundImage: isBlindTest ? 'none' : `url(${coverUrl})`, backgroundColor: isBlindTest ? '#4c1d95' : '#111' }}
      />
      <div className="fixed inset-0 z-0 bg-black/40 backdrop-blur-3xl" />

      {/* EMOJIS FLOTTANTS */}
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 100, x: Math.random() * 100 - 50, scale: 0.5 }} animate={{ opacity: 1, y: -800, x: Math.random() * 300 - 150, scale: 2 }} exit={{ opacity: 0 }} transition={{ duration: 4, ease: "easeOut" }} className="absolute bottom-10 left-1/2 z-50 text-6xl pointer-events-none drop-shadow-2xl">
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* MODAL QR CODE SIMPLE */}
      <AnimatePresence>
        {qrExpanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer" onClick={() => setQrExpanded(false)}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-white p-10 rounded-3xl shadow-2xl relative cursor-default" onClick={e => e.stopPropagation()}>
              <button onClick={() => setQrExpanded(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-black hover:bg-gray-200 transition"><X className="w-5 h-5" /></button>
              <h2 className="text-black text-2xl font-black text-center mb-6 mt-4">Code: <span className="text-pink-600">{roomId}</span></h2>
              <QRCodeSVG value={joinUrl} size={300} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER DESKTOP */}
      <header className="w-full max-w-6xl hidden md:flex justify-between items-center mb-6 bg-white/10 backdrop-blur-xl p-5 rounded-2xl shadow-xl border border-white/10 relative z-10">
        <div className="flex items-center gap-4">
          <button onClick={leaveRoom} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition text-white/70 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                ListenParty <span className="text-pink-400">#{roomId}</span>
                {isLocked && <Lock className="w-4 h-4 text-red-400" />}
                {isBlindTest && <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full animate-pulse uppercase">Blind Test</span>}
            </h1>
            <p className="text-white/60 font-medium flex items-center gap-2 mt-1 text-sm">
              <Users className="w-4 h-4" /> {users.length} ami(s) connecté(s)
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 items-center">
            {isHost && (
                <button onClick={toggleLock} className={`p-2 rounded-xl transition ${isLocked ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`} title="Verrouiller le salon">
                    {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>
            )}
            <button onClick={toggleBlindTest} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${isBlindTest ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'}`}>
                {isBlindTest ? 'Arrêter Blind Test' : 'Jouer au Blind Test'}
            </button>
            <button onClick={startWrapped} className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-pink-500 to-orange-400 hover:scale-105 transition shadow-lg">
                Soirée Terminée
            </button>
            <button onClick={() => setQrExpanded(true)} className="bg-white p-2 rounded-lg cursor-pointer hover:scale-105 transition">
                <QRCodeSVG value={joinUrl} size={32} />
            </button>
        </div>
      </header>

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 min-h-[500px] md:h-[70vh] relative z-10">
        
        {/* LECTEUR PRINCIPAL */}
        <motion.div className="flex-1 w-full md:max-w-[60%] bg-white/5 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm flex flex-col items-center">
            
            {/* Mobile Actions */}
            <div className="md:hidden flex w-full gap-2 items-center mb-6 overflow-x-auto pb-2 scrollbar-hide">
                <button onClick={leaveRoom} className="bg-white/10 p-2.5 rounded-full border border-white/20 hover:bg-white/20 transition shrink-0"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setQrExpanded(true)} className="bg-white/10 px-4 py-2 rounded-full text-xs font-bold border border-white/20 flex-1 text-center truncate shrink-0">
                  PIN: {roomId} {isLocked && "🔒"}
                </button>
                {isHost && (
                    <button onClick={toggleLock} className={`p-2.5 rounded-full shrink-0 ${isLocked ? 'bg-red-500/50' : 'bg-white/10'}`}>
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                )}
                <button onClick={toggleBlindTest} className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 ${isBlindTest ? 'bg-red-500' : 'bg-purple-500'}`}>
                    {isBlindTest ? 'Stop' : 'Blind Test'}
                </button>
            </div>

            <AnimatePresence mode="wait">
              {isBlindTest ? (
                  <motion.div key="blind" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-48 h-48 sm:w-64 sm:h-64 rounded-full shadow-2xl mb-8 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-900 border-8 border-white/10 animate-spin-slow">
                      <Disc className="w-20 h-20 text-white/40" />
                  </motion.div>
              ) : (
                <motion.img key={coverUrl} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} src={coverUrl} alt="Album Cover" className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl mb-8 object-cover border border-white/10" />
              )}
            </AnimatePresence>
            
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 text-center truncate w-full drop-shadow-md">
                {isBlindTest ? 'À vous de deviner !' : trackInfo.track}
            </h2>
            <p className="text-white/60 font-medium mb-8 text-center text-sm sm:text-base md:text-lg">
                {isBlindTest ? 'Cherchez la musique dans l\'onglet de droite' : trackInfo.artist}
            </p>
            
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="flex items-center justify-center gap-6 relative w-full">
                <button onClick={togglePlay} className="bg-white/20 backdrop-blur-md text-white p-4 sm:p-5 rounded-full hover:bg-white/30 hover:scale-110 transition active:scale-95 shadow-xl">
                  {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-1" />}
                </button>
                <div className="flex items-center relative">
                    <button onClick={voteSkip} className="bg-white/10 p-4 rounded-full hover:bg-white/20 transition relative">
                      <SkipForward className="w-5 h-5" />
                      {skipVotes.votes > 0 && (
                        <span className="absolute -top-1 -right-1 bg-pink-500 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg">
                          {skipVotes.votes}/{skipVotes.required}
                        </span>
                      )}
                    </button>
                    {isHost && (
                        <button onClick={forceSkip} className="absolute -right-12 p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-full transition" title="Forcer (Hôte)">
                            <SkipForward className="w-4 h-4" />
                        </button>
                    )}
                </div>
              </div>

              <div className="flex gap-4 mt-2">
                {['🔥', '💃', '😍', '😴', '🍻'].map(emoji => (
                  <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-125 hover:-translate-y-1 transition-transform drop-shadow-md">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* TABS (DROITE) */}
        <div className="w-full md:flex-1 flex flex-col bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden h-[500px] md:h-full">
          <div className="flex border-b border-white/5 bg-black/10 overflow-x-auto scrollbar-hide">
            {isBlindTest ? (
                <button onClick={() => setActiveTab('search')} className={`flex-1 min-w-[80px] p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'search' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><Search className="w-4 h-4 mx-auto mb-1" /> Rechercher</button>
            ) : (
                <button onClick={() => setActiveTab('lyrics')} className={`flex-1 min-w-[80px] p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'lyrics' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><Mic2 className="w-4 h-4 mx-auto mb-1" /> Paroles</button>
            )}
            <button onClick={() => setActiveTab('queue')} className={`flex-1 min-w-[80px] p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'queue' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><ListMusic className="w-4 h-4 mx-auto mb-1" /> Suivants</button>
            <button onClick={() => setActiveTab('chat')} className={`flex-1 min-w-[80px] p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><MessageCircle className="w-4 h-4 mx-auto mb-1" /> Chat</button>
            {isHost && (
                <button onClick={() => setActiveTab('mod')} className={`flex-1 min-w-[80px] p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'mod' ? 'bg-white/10 text-yellow-400' : 'text-white/50 hover:text-white/80'}`}><Crown className="w-4 h-4 mx-auto mb-1" /> Hôte</button>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            
            {/* RECHERCHE (BLIND TEST) */}
            {activeTab === 'search' && isBlindTest && (
                <div className="h-full flex flex-col p-4 bg-black/20">
                    <div className="flex items-center gap-2 mb-4">
                        <Search className="text-white/50 w-5 h-5" />
                        <input type="text" placeholder="Titre, Artiste..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-white/40 text-lg" />
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {searchResults.map((res: any, idx: number) => (
                            <div key={idx} onClick={() => submitGuess(res.trackName, res.artistName)} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition">
                                <img src={res.artworkUrl60} className="w-10 h-10 rounded-md" alt="" />
                                <div>
                                    <p className="text-sm font-bold text-white line-clamp-1">{res.trackName}</p>
                                    <p className="text-xs text-white/60 line-clamp-1">{res.artistName}</p>
                                </div>
                            </div>
                        ))}
                        {searchResults.length === 0 && searchQuery && <p className="text-white/40 text-sm text-center mt-4">Aucun résultat trouvé.</p>}
                        {searchResults.length === 0 && !searchQuery && (
                            <div className="mt-8 text-center">
                                <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-bold text-white/50 mb-4">Classement</h3>
                                {sortedScores.map((score: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl mb-2 mx-4">
                                        <span className="font-bold text-sm"><span className="text-yellow-400 mr-2">#{idx+1}</span> {score[0]}</span>
                                        <span className="font-black text-pink-400 text-sm">{score[1]} pts</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PAROLES */}
            {activeTab === 'lyrics' && !isBlindTest && (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto p-6 flex flex-col gap-4 mask-image-fade">
                {syncedLyrics.length > 0 ? (
                  syncedLyrics.map((lyric, idx) => {
                    const isActive = idx === activeLyricIndex;
                    const isPast = idx < activeLyricIndex;
                    return (
                      <p key={idx} id={isActive ? "active-lyric" : undefined} className={`text-lg sm:text-xl font-bold transition-all duration-500 ease-out cursor-default ${isActive ? 'text-white scale-105 origin-left drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : isPast ? 'text-white/30 blur-[0.5px]' : 'text-white/40'}`}>
                        {lyric.text || '🎵'}
                      </p>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-lg font-bold text-white/40 text-center whitespace-pre-line leading-relaxed">{plainLyrics}</p>
                  </div>
                )}
                <div className="h-32" />
              </div>
            )}

            {/* MODERATION (Hôte seulement) */}
            {activeTab === 'mod' && isHost && (
              <div className="h-full overflow-y-auto p-4 flex flex-col gap-4 bg-black/20">
                <h3 className="font-black text-lg text-yellow-400 flex items-center gap-2"><Crown className="w-5 h-5"/> Contrôle de la Salle</h3>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div>
                        <p className="font-bold">Verrouiller le salon</p>
                        <p className="text-xs text-white/50">Empêche les nouveaux joueurs de rejoindre</p>
                    </div>
                    <button onClick={toggleLock} className={`p-2 rounded-xl transition ${isLocked ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                        {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                    </button>
                </div>
                <h3 className="font-black text-lg mt-4 text-white/80">Membres ({users.length})</h3>
                <div className="flex flex-col gap-2">
                    {users.map(u => (
                        <div key={u.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                            <span className="font-bold flex items-center gap-2">
                                {u.username} {u.id === hostId && <Crown className="w-4 h-4 text-yellow-400" />}
                            </span>
                            {u.id !== socketId && (
                                <button onClick={() => kickUser(u.id)} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition" title="Expulser">
                                    <Ban className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
              </div>
            )}

            {/* QUEUE */}
            {activeTab === 'queue' && (
              <div className="h-full overflow-y-auto p-4 flex flex-col gap-2">
                {(!trackInfo.queue || trackInfo.queue.length === 0) ? (
                  <p className="text-white/40 text-center mt-10 text-sm font-medium">Aucune musique suivante.</p>
                ) : trackInfo.queue.map((q: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition">
                    <div className="text-white/30 font-black text-xs w-4 text-right">{idx + 1}</div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-white text-sm truncate">{q.track}</p>
                      <p className="text-xs text-white/50 truncate">{q.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CHAT */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full p-4">
                <div className="flex-1 overflow-y-auto mb-3 flex flex-col gap-2 pr-1">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-2xl max-w-[90%] ${msg.username === "🤖 Arbitre" ? 'bg-white/10 text-white self-center w-full text-center text-xs' : msg.username === username ? 'bg-pink-500/80 text-white self-end rounded-br-md' : 'bg-white/10 text-white self-start rounded-bl-md'}`}>
                      {msg.username !== "🤖 Arbitre" && <p className="text-[10px] opacity-60 mb-0.5 font-bold">{msg.username} <span className="font-normal ml-1">{msg.time}</span></p>}
                      <p className="text-xs sm:text-sm font-medium leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendChatMessage} className="flex gap-2">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message..." className="flex-1 p-3 text-sm bg-black/40 border border-white/5 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50 transition" />
                  <button type="submit" className="bg-pink-500 text-white p-3 rounded-xl text-sm font-bold hover:bg-pink-600 transition">Go</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WRAPPED MODAL REWORKED */}
      <AnimatePresence>
          {showWrapped && wrappedData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
                  <Confetti width={window.innerWidth} height={window.innerHeight} colors={['#ff007f', '#7928ca', '#ff0080', '#fbbf24']} />
                  <button onClick={() => setShowWrapped(false)} className="absolute top-6 right-6 bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition z-50"><X className="w-6 h-6" /></button>
                  
                  <motion.div 
                    initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                    className="max-w-md w-full aspect-[9/16] bg-gradient-to-tr from-pink-600 via-purple-700 to-indigo-900 rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden cursor-pointer border border-white/20" 
                    onClick={() => setWrappedStep((s) => (s + 1) % 4)}
                  >
                      {/* Background Decor */}
                      <div className="absolute -top-32 -left-32 w-64 h-64 bg-pink-500 rounded-full mix-blend-overlay blur-3xl opacity-50 pointer-events-none" />
                      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-indigo-500 rounded-full mix-blend-overlay blur-3xl opacity-50 pointer-events-none" />

                      {wrappedStep === 0 && (
                          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center z-10">
                              <Music className="w-20 h-20 mb-6 text-white drop-shadow-lg" />
                              <h2 className="text-5xl font-black mb-4 tracking-tighter drop-shadow-md">ListenParty<br/>Wrapped</h2>
                              <p className="text-base font-medium text-white/80 bg-black/20 px-4 py-2 rounded-full">Quelle soirée ! Appuyez pour le récap.</p>
                          </motion.div>
                      )}
                      
                      {wrappedStep === 1 && (
                          <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center w-full z-10">
                              <h3 className="text-3xl font-black mb-8 text-pink-200 drop-shadow-md">Vos Stats 📈</h3>
                              <div className="bg-black/30 backdrop-blur-md w-full p-6 rounded-3xl mb-4 border border-white/10 shadow-xl">
                                  <p className="text-6xl font-black mb-2 text-white drop-shadow-lg">{wrappedData.history.length}</p>
                                  <p className="text-base font-bold text-white/70 uppercase tracking-widest">Musiques écoutées</p>
                              </div>
                              <div className="bg-black/30 backdrop-blur-md w-full p-6 rounded-3xl border border-white/10 shadow-xl">
                                  <p className="text-6xl font-black mb-2 text-white drop-shadow-lg">{wrappedData.stats.emojisSent}</p>
                                  <p className="text-base font-bold text-white/70 uppercase tracking-widest">Émojis envoyés</p>
                              </div>
                          </motion.div>
                      )}
                      
                      {wrappedStep === 2 && (
                          <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center w-full z-10">
                              <Trophy className="w-16 h-16 text-yellow-400 mb-6 drop-shadow-lg" />
                              <h3 className="text-3xl font-black mb-8 text-yellow-100 drop-shadow-md">Les Champions</h3>
                              {Object.entries(wrappedData.scores).sort((a:any, b:any) => b[1] - a[1]).slice(0, 3).map((score: any, idx: number) => (
                                  <motion.div 
                                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.15 }}
                                      key={idx} className="bg-black/30 backdrop-blur-md w-full p-5 rounded-2xl mb-3 flex justify-between items-center border border-white/10 shadow-lg"
                                  >
                                      <span className="font-bold text-lg"><span className="text-yellow-400 mr-3">#{idx+1}</span> {score[0]}</span>
                                      <span className="font-black text-pink-300 text-lg">{score[1]} pts</span>
                                  </motion.div>
                              ))}
                              {Object.keys(wrappedData.scores).length === 0 && <p className="text-white/50 text-base font-medium">Aucun Blind Test n'a été joué ce soir.</p>}
                          </motion.div>
                      )}

                      {wrappedStep === 3 && (
                          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center w-full z-10">
                              <Download className="w-16 h-16 text-white mb-6 drop-shadow-lg" />
                              <h3 className="text-3xl font-black mb-4 text-white drop-shadow-md">Sauvegardez l'instant</h3>
                              <p className="text-white/80 mb-8 text-center text-sm px-4">Gardez une trace des {wrappedData.history.length} musiques qui ont ambiancé cette session.</p>
                              <button onClick={(e) => { e.stopPropagation(); exportPlaylist(); }} className="bg-white text-pink-600 px-8 py-4 rounded-full font-black text-lg hover:scale-105 transition active:scale-95 shadow-xl flex items-center gap-3">
                                  <Download className="w-6 h-6" /> Exporter Playlist
                              </button>
                              <p className="text-white/40 mt-10 text-xs uppercase tracking-widest font-bold">Appuyez pour fermer</p>
                          </motion.div>
                      )}
                      
                      {/* Story Progress Bar */}
                      <div className="absolute top-6 left-6 right-6 flex gap-2 z-20">
                          {[0, 1, 2, 3].map((i) => (
                              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= wrappedStep ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-white/20'}`} />
                          ))}
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>

      <style jsx global>{`.mask-image-fade { mask-image: linear-gradient(to bottom, transparent, black 5%, black 80%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent, black 5%, black 80%, transparent 100%);} .animate-spin-slow { animation: spin 4s linear infinite; }`}</style>
    </div>
  );
}
