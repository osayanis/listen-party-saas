"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import io from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Users, ListMusic, MessageCircle, SkipForward, Mic2, X, Maximize2, Search, Trophy, Music, Disc, ChevronLeft } from "lucide-react";
import Confetti from 'react-confetti';

let socket: any;

export default function Room() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const username = searchParams.get("username") || "Invite";
  
  const [users, setUsers] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [trackInfo, setTrackInfo] = useState({ track: "En attente du Bridge...", artist: "Mac OS", state: "paused", queue: [] as any[], position: 0 });
  const [coverUrl, setCoverUrl] = useState("https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80");
  
  const [activeTab, setActiveTab] = useState<'queue' | 'chat' | 'lyrics' | 'search'>('queue');
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
  
  // NOUVEAU: iTunes Search pour Blind Test
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

    socket.on("room-update", (roomData: any) => {
      setUsers(roomData.users.filter((u:any) => !u.username.includes("MacBridge")));
      setSkipVotes({ votes: roomData.skipVotes, required: Math.max(1, Math.ceil(roomData.users.length / 2)) });
      setIsBlindTest(roomData.isBlindTest);
      setBlindTestScores(roomData.blindTestScores);
      if (roomData.isBlindTest) setActiveTab("search");
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
  }, [roomId, username]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => setCurrentPlaybackTime(prev => prev + 0.1), 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (activeTab === 'lyrics' && syncedLyrics.length > 0 && !isBlindTest) {
      const activeLine = document.getElementById("active-lyric");
      if (activeLine && lyricsContainerRef.current) activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentPlaybackTime, activeTab, syncedLyrics, isBlindTest]);

  // iTunes Search Debounce
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
  
  const toggleBlindTest = () => socket.emit("toggle-blind-test", roomId, !isBlindTest);

  const startWrapped = () => {
      socket.emit("get-wrapped", roomId, (data: any) => {
          setWrappedData(data);
          setShowWrapped(true);
          setWrappedStep(0);
      });
  };

  const submitGuess = (trackName: string, artistName: string) => {
      socket.emit("guess-blind-test", roomId, username, trackName, artistName);
      setSearchQuery("");
      setSearchResults([]);
  };

  const leaveRoom = () => {
      if (socket) socket.disconnect();
      router.push("/");
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
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 100, x: Math.random() * 100 - 50, scale: 0.5 }}
            animate={{ opacity: 1, y: -800, x: Math.random() * 300 - 150, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 4, ease: "easeOut" }}
            className="absolute bottom-10 left-1/2 z-50 text-6xl pointer-events-none drop-shadow-2xl"
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* MODAL QR CODE SIMPLE */}
      <AnimatePresence>
        {qrExpanded && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
            onClick={() => setQrExpanded(false)}
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white p-10 rounded-3xl shadow-2xl relative cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setQrExpanded(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-black hover:bg-gray-200 transition">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-black text-2xl font-black text-center mb-6 mt-4">Code: <span className="text-pink-600">{roomId}</span></h2>
              <QRCodeSVG value={joinUrl} size={300} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="w-full max-w-6xl hidden md:flex justify-between items-center mb-6 bg-white/10 backdrop-blur-xl p-5 rounded-2xl shadow-xl border border-white/10 relative z-10">
        <div className="flex items-center gap-4">
          <button onClick={leaveRoom} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition text-white/70 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                ListenParty <span className="text-pink-400">#{roomId}</span>
                {isBlindTest && <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full animate-pulse uppercase">Blind Test</span>}
            </h1>
            <p className="text-white/60 font-medium flex items-center gap-2 mt-1 text-sm">
              <Users className="w-4 h-4" /> {users.length} ami(s) connecté(s)
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
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
            <div className="md:hidden flex w-full justify-between items-center mb-6">
                <button onClick={leaveRoom} className="bg-white/10 p-2 rounded-full border border-white/20 hover:bg-white/20 transition">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setQrExpanded(true)} className="bg-white/10 px-4 py-2 rounded-full text-xs font-bold border border-white/20 mx-2 flex-1 text-center truncate">
                  PIN: {roomId}
                </button>
                <button onClick={toggleBlindTest} className={`px-4 py-2 rounded-full text-xs font-bold ${isBlindTest ? 'bg-red-500' : 'bg-purple-500'}`}>
                    {isBlindTest ? 'Stop' : 'Blind Test'}
                </button>
            </div>

            <AnimatePresence mode="wait">
              {isBlindTest ? (
                  <motion.div 
                    key="blind"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    className="w-48 h-48 sm:w-64 sm:h-64 rounded-full shadow-2xl mb-8 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-900 border-8 border-white/10 animate-spin-slow"
                  >
                      <Disc className="w-20 h-20 text-white/40" />
                  </motion.div>
              ) : (
                <motion.img 
                  key={coverUrl}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  src={coverUrl} alt="Album Cover" 
                  className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl mb-8 object-cover border border-white/10"
                />
              )}
            </AnimatePresence>
            
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 text-center truncate w-full drop-shadow-md">
                {isBlindTest ? 'À vous de deviner !' : trackInfo.track}
            </h2>
            <p className="text-white/60 font-medium mb-8 text-center text-sm sm:text-base md:text-lg">
                {isBlindTest ? 'Cherchez la musique dans l\'onglet de droite' : trackInfo.artist}
            </p>
            
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="bg-white/20 backdrop-blur-md text-white p-4 sm:p-5 rounded-full hover:bg-white/30 hover:scale-110 transition active:scale-95 shadow-xl">
                  {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-1" />}
                </button>
                <button onClick={voteSkip} className="bg-white/10 p-4 rounded-full hover:bg-white/20 transition relative">
                  <SkipForward className="w-5 h-5" />
                  {skipVotes.votes > 0 && (
                    <span className="absolute -top-1 -right-1 bg-pink-500 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg">
                      {skipVotes.votes}/{skipVotes.required}
                    </span>
                  )}
                </button>
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
          <div className="flex border-b border-white/5 bg-black/10">
            {isBlindTest ? (
                <button onClick={() => setActiveTab('search')} className={`flex-1 p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'search' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><Search className="w-4 h-4 mx-auto mb-1" /> Recherche</button>
            ) : (
                <button onClick={() => setActiveTab('lyrics')} className={`flex-1 p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'lyrics' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><Mic2 className="w-4 h-4 mx-auto mb-1" /> Paroles</button>
            )}
            <button onClick={() => setActiveTab('queue')} className={`flex-1 p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'queue' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><ListMusic className="w-4 h-4 mx-auto mb-1" /> Suivants</button>
            <button onClick={() => setActiveTab('chat')} className={`flex-1 p-4 font-bold text-xs sm:text-sm transition ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><MessageCircle className="w-4 h-4 mx-auto mb-1" /> Chat</button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            
            {/* RECHERCHE (BLIND TEST) */}
            {activeTab === 'search' && isBlindTest && (
                <div className="h-full flex flex-col p-4 bg-black/20">
                    <div className="flex items-center gap-2 mb-4">
                        <Search className="text-white/50 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Titre, Artiste..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-white/40 text-lg"
                        />
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
                      <p 
                        key={idx} 
                        id={isActive ? "active-lyric" : undefined}
                        className={`text-lg sm:text-xl font-bold transition-all duration-500 ease-out cursor-default
                          ${isActive ? 'text-white scale-105 origin-left drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 
                            isPast ? 'text-white/30 blur-[0.5px]' : 'text-white/40'}`}
                      >
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
                    <div key={i} className={`p-3 rounded-2xl max-w-[90%] 
                        ${msg.username === "🤖 Arbitre" ? 'bg-white/10 text-white self-center w-full text-center text-xs' : 
                          msg.username === username ? 'bg-pink-500/80 text-white self-end rounded-br-md' : 
                          'bg-white/10 text-white self-start rounded-bl-md'}`}>
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

      {/* WRAPPED MODAL */}
      <AnimatePresence>
          {showWrapped && wrappedData && (
              <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4"
              >
                  <Confetti width={window.innerWidth} height={window.innerHeight} />
                  <button onClick={() => setShowWrapped(false)} className="absolute top-6 right-6 bg-white/10 p-2 rounded-full text-white hover:bg-white/20"><X className="w-6 h-6" /></button>
                  
                  <div className="max-w-md w-full aspect-[9/16] bg-gradient-to-b from-pink-600 to-indigo-900 rounded-3xl shadow-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden cursor-pointer" onClick={() => setWrappedStep((s) => (s + 1) % 3)}>
                      {wrappedStep === 0 && (
                          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                              <Music className="w-16 h-16 mb-4 text-white" />
                              <h2 className="text-4xl font-black mb-3">ListenParty<br/>Wrapped</h2>
                              <p className="text-sm font-medium text-white/70">Quelle soirée incroyable !<br/>Appuyez pour voir le récap.</p>
                          </motion.div>
                      )}
                      {wrappedStep === 1 && (
                          <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center w-full">
                              <h3 className="text-2xl font-black mb-6 text-pink-200">Stats de la Soirée</h3>
                              <div className="bg-black/20 w-full p-5 rounded-2xl mb-4 border border-white/5">
                                  <p className="text-4xl font-black mb-1">{wrappedData.history.length}</p>
                                  <p className="text-sm text-white/60">Musiques écoutées</p>
                              </div>
                              <div className="bg-black/20 w-full p-5 rounded-2xl border border-white/5">
                                  <p className="text-4xl font-black mb-1">{wrappedData.stats.emojisSent}</p>
                                  <p className="text-sm text-white/60">Émojis envoyés</p>
                              </div>
                          </motion.div>
                      )}
                      {wrappedStep === 2 && (
                          <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center w-full">
                              <h3 className="text-2xl font-black mb-6 text-yellow-200">Les Champions 🏆</h3>
                              {Object.entries(wrappedData.scores).sort((a:any, b:any) => b[1] - a[1]).slice(0, 3).map((score: any, idx: number) => (
                                  <div key={idx} className="bg-black/20 w-full p-4 rounded-xl mb-2 flex justify-between items-center border border-white/5">
                                      <span className="font-bold text-sm"><span className="text-yellow-400 mr-2">#{idx+1}</span> {score[0]}</span>
                                      <span className="font-black text-pink-300 text-sm">{score[1]} pts</span>
                                  </div>
                              ))}
                              {Object.keys(wrappedData.scores).length === 0 && <p className="text-white/50 text-sm">Aucun Blind Test joué.</p>}
                              <p className="text-white/30 mt-8 text-xs uppercase tracking-wider">Appuyez pour fermer</p>
                          </motion.div>
                      )}
                      <div className="absolute top-4 left-4 right-4 flex gap-1">
                          {[0, 1, 2].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full ${i <= wrappedStep ? 'bg-white' : 'bg-white/20'}`} />
                          ))}
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <style jsx global>{`.mask-image-fade { mask-image: linear-gradient(to bottom, transparent, black 5%, black 80%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent, black 5%, black 80%, transparent 100%);} .animate-spin-slow { animation: spin 4s linear infinite; }`}</style>
    </div>
  );
}
