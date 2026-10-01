"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import io from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Users, ListMusic, MessageCircle, SkipForward, Volume2, Mic2, X, Maximize2, Trophy, Music, Disc } from "lucide-react";
import Confetti from 'react-confetti';

let socket: any;

export default function Room() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const username = searchParams.get("username") || "Invite";
  
  const [users, setUsers] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [trackInfo, setTrackInfo] = useState({ track: "En attente du Bridge...", artist: "Mac OS", state: "paused", queue: [] as any[], position: 0 });
  const [coverUrl, setCoverUrl] = useState("https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80");
  
  const [activeTab, setActiveTab] = useState<'queue' | 'chat' | 'lyrics'>('queue');
  const [reactions, setReactions] = useState<{id: number, emoji: string}[]>([]);
  const [chatMessages, setChatMessages] = useState<{username: string, text: string, time: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  
  const [qrExpanded, setQrExpanded] = useState(false);
  const [syncedLyrics, setSyncedLyrics] = useState<{time: number, text: string}[]>([]);
  const [plainLyrics, setPlainLyrics] = useState("");
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 1 });
  const [volume, setVolume] = useState(50);
  
  // NOUVEAU : BLIND TEST & WRAPPED
  const [isBlindTest, setIsBlindTest] = useState(false);
  const [blindTestScores, setBlindTestScores] = useState<any>({});
  const [showConfetti, setShowConfetti] = useState(false);
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
          setShowConfetti(false); // Reset confetti on new song
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

    socket.on("blind-test-update", (status: boolean) => setIsBlindTest(status));
    socket.on("blind-test-scores", (scores: any) => setBlindTestScores(scores));
    socket.on("blind-test-winner", (data: any) => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    });

    socket.on("skip-votes-update", (data: any) => setSkipVotes(data));

    return () => socket.disconnect();
  }, [roomId, username]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentPlaybackTime(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (activeTab === 'lyrics' && syncedLyrics.length > 0 && !isBlindTest) {
      const activeLine = document.getElementById("active-lyric");
      if (activeLine && lyricsContainerRef.current) {
        activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentPlaybackTime, activeTab, syncedLyrics, isBlindTest]);

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
  const changeVolume = (e: any) => {
    setVolume(e.target.value);
    socket.emit("web-action", roomId, { state: 'volume', value: e.target.value });
  };
  
  const toggleBlindTest = () => {
      socket.emit("toggle-blind-test", roomId, !isBlindTest);
      if (!isBlindTest) setActiveTab("chat"); // Force chat pour répondre
  };

  const startWrapped = () => {
      socket.emit("get-wrapped", roomId, (data: any) => {
          setWrappedData(data);
          setShowWrapped(true);
          setWrappedStep(0);
      });
  };

  let activeLyricIndex = -1;
  for (let i = 0; i < syncedLyrics.length; i++) {
    if (currentPlaybackTime >= syncedLyrics[i].time) activeLyricIndex = i;
  }

  // Trier les scores du blind test
  const sortedScores = Object.entries(blindTestScores).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="min-h-screen flex flex-col items-center p-0 md:p-8 font-sans text-white overflow-hidden relative">
      
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} />}

      {/* BACKGROUND DYNAMIQUE */}
      <div 
        className="fixed inset-0 z-0 scale-125 blur-3xl opacity-50 bg-cover bg-center transition-all duration-[2000ms] ease-in-out"
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

      {/* HEADER */}
      <header className="w-full max-w-6xl hidden md:flex justify-between items-center mb-8 bg-white/10 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/20 relative z-10">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
              Code PIN: <span className="text-pink-400">{roomId}</span>
              {isBlindTest && <span className="bg-purple-500 text-white text-sm px-3 py-1 rounded-full animate-pulse">MODE BLIND TEST ACTIF</span>}
          </h1>
          <p className="text-white/70 font-medium flex items-center gap-2 mt-1">
            <Users className="w-4 h-4" /> {users.length} ami(s) connecté(s)
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
            <button onClick={toggleBlindTest} className={`px-4 py-2 rounded-2xl font-bold transition ${isBlindTest ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'}`}>
                {isBlindTest ? 'Arrêter Blind Test' : 'Jouer au Blind Test'}
            </button>
            <button onClick={startWrapped} className="px-4 py-2 rounded-2xl font-bold bg-gradient-to-r from-pink-500 to-orange-400 hover:scale-105 transition shadow-lg">
                Terminer la soirée (Wrapped)
            </button>
            <motion.div layoutId="qr-container" onClick={() => setQrExpanded(true)} className="bg-white p-2 rounded-xl cursor-pointer hover:scale-105 transition">
                <QRCodeSVG value={joinUrl} size={40} />
            </motion.div>
        </div>
      </header>

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 h-screen md:h-[75vh] relative z-10">
        
        {/* LECTEUR PRINCIPAL */}
        <motion.div className="flex-1 bg-white/5 backdrop-blur-2xl md:rounded-[3rem] p-6 md:p-10 shadow-2xl border border-white/10 flex flex-col items-center justify-center h-full">
          <div className="w-full max-w-md flex flex-col items-center">
            
            <AnimatePresence mode="wait">
              {isBlindTest ? (
                  <motion.div 
                    key="blind"
                    initial={{ opacity: 0, scale: 0.5, rotateY: 90 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} exit={{ opacity: 0, scale: 0.5, rotateY: -90 }}
                    className="w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 rounded-full shadow-2xl mb-8 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-900 border-8 border-white/20 animate-spin-slow"
                  >
                      <Disc className="w-32 h-32 text-white/50" />
                  </motion.div>
              ) : (
                <motion.img 
                  key={coverUrl}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  src={coverUrl} alt="Album Cover" 
                  className="w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 rounded-3xl shadow-2xl mb-8 object-cover border border-white/10"
                />
              )}
            </AnimatePresence>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 text-center truncate w-full drop-shadow-md">
                {isBlindTest ? 'À vous de deviner !' : trackInfo.track}
            </h2>
            <p className="text-white/70 font-medium mb-8 text-center text-lg md:text-xl">
                {isBlindTest ? 'Trouvez le titre dans le Chat' : trackInfo.artist}
            </p>
            
            <div className="flex flex-col items-center gap-8 w-full px-4">
              <div className="flex items-center gap-8">
                <button onClick={togglePlay} className="bg-white/20 backdrop-blur-md text-white p-5 sm:p-6 rounded-full hover:bg-white/30 hover:scale-110 transition active:scale-95 shadow-xl">
                  {isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
                </button>
                <button onClick={voteSkip} className="bg-white/10 p-5 rounded-full hover:bg-white/20 transition relative">
                  <SkipForward className="w-6 h-6" />
                  {skipVotes.votes > 0 && (
                    <span className="absolute -top-2 -right-2 bg-pink-500 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-lg">
                      {skipVotes.votes}/{skipVotes.required}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 w-full">
                <Volume2 className="w-5 h-5 text-white/50" />
                <input type="range" min="0" max="100" value={volume} onChange={changeVolume} className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white" />
              </div>

              <div className="flex gap-6 mt-2">
                {['🔥', '💃', '😍', '😴', '🍻'].map(emoji => (
                  <button key={emoji} onClick={() => sendReaction(emoji)} className="text-3xl hover:scale-125 hover:-translate-y-2 transition-transform drop-shadow-lg">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* TABS (DROITE) */}
        <div className="w-full md:w-[450px] hidden md:flex flex-col bg-white/5 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden">
          <div className="flex border-b border-white/10 bg-black/20">
            <button onClick={() => setActiveTab('lyrics')} className={`flex-1 p-5 font-bold text-sm transition ${activeTab === 'lyrics' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><Mic2 className="w-5 h-5 mx-auto mb-1" /> {isBlindTest ? 'Scores' : 'Paroles'}</button>
            <button onClick={() => setActiveTab('queue')} className={`flex-1 p-5 font-bold text-sm transition ${activeTab === 'queue' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><ListMusic className="w-5 h-5 mx-auto mb-1" /> Suivants</button>
            <button onClick={() => setActiveTab('chat')} className={`flex-1 p-5 font-bold text-sm transition ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}><MessageCircle className="w-5 h-5 mx-auto mb-1" /> Chat</button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            
            {/* PAROLES OU SCORE BLIND TEST */}
            {activeTab === 'lyrics' && (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto p-8 flex flex-col gap-6 mask-image-fade">
                {isBlindTest ? (
                    <div className="flex flex-col items-center">
                        <Trophy className="w-16 h-16 text-yellow-400 mb-6 drop-shadow-lg" />
                        <h3 className="text-2xl font-black mb-6">Classement Blind Test</h3>
                        {sortedScores.map((score: any, idx: number) => (
                            <div key={idx} className="w-full flex justify-between items-center bg-white/10 p-4 rounded-2xl mb-3">
                                <span className="font-bold text-lg"><span className="text-yellow-400 mr-2">#{idx+1}</span> {score[0]}</span>
                                <span className="font-black text-pink-400">{score[1]} pts</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    syncedLyrics.length > 0 ? (
                      syncedLyrics.map((lyric, idx) => {
                        const isActive = idx === activeLyricIndex;
                        const isPast = idx < activeLyricIndex;
                        return (
                          <p 
                            key={idx} 
                            id={isActive ? "active-lyric" : undefined}
                            className={`text-2xl font-bold transition-all duration-500 ease-out cursor-default
                              ${isActive ? 'text-white scale-110 origin-left drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 
                                isPast ? 'text-white/40 blur-[1px]' : 'text-white/40'}`}
                          >
                            {lyric.text || '🎵'}
                          </p>
                        );
                      })
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-xl font-bold text-white/50 text-center whitespace-pre-line leading-relaxed">{plainLyrics}</p>
                      </div>
                    )
                )}
                <div className="h-32" />
              </div>
            )}

            {/* QUEUE */}
            {activeTab === 'queue' && (
              <div className="h-full overflow-y-auto p-6 flex flex-col gap-3">
                {(!trackInfo.queue || trackInfo.queue.length === 0) ? (
                  <p className="text-white/50 text-center mt-10 font-medium">Aucune musique suivante.</p>
                ) : trackInfo.queue.map((q: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition">
                    <div className="text-white/30 font-black w-6 text-right">{idx + 1}</div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-white truncate">{q.track}</p>
                      <p className="text-sm text-white/60 truncate">{q.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CHAT */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full p-4">
                <div className="flex-1 overflow-y-auto mb-4 flex flex-col gap-3 pr-2">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`p-4 rounded-3xl max-w-[85%] 
                        ${msg.username === "🤖 Arbitre" ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white self-center w-full text-center shadow-lg' : 
                          msg.username === username ? 'bg-pink-500 text-white self-end rounded-br-md' : 
                          'bg-white/10 backdrop-blur-md text-white self-start rounded-bl-md'}`}>
                      {msg.username !== "🤖 Arbitre" && <p className="text-xs opacity-70 mb-1 font-bold">{msg.username} <span className="font-normal ml-1">{msg.time}</span></p>}
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendChatMessage} className="flex gap-2">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={isBlindTest ? "Tapez le titre de la musique !" : "Message..."} className="flex-1 p-4 bg-black/30 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-pink-500 transition" />
                  <button type="submit" className="bg-pink-500 text-white p-4 rounded-2xl font-bold hover:bg-pink-600 transition shadow-lg shadow-pink-500/30">Envoyer</button>
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
                  initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -100 }}
                  className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6"
              >
                  <Confetti width={window.innerWidth} height={window.innerHeight} />
                  <button onClick={() => setShowWrapped(false)} className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-8 h-8" /></button>
                  
                  <div className="max-w-lg w-full aspect-[9/16] bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-900 rounded-[3rem] shadow-2xl p-10 flex flex-col items-center justify-center text-center relative overflow-hidden cursor-pointer" onClick={() => setWrappedStep((s) => (s + 1) % 3)}>
                      
                      {wrappedStep === 0 && (
                          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                              <Music className="w-24 h-24 mb-6 text-white" />
                              <h2 className="text-5xl font-black mb-4">ListenParty<br/>Wrapped</h2>
                              <p className="text-xl font-medium text-white/80">Quelle soirée incroyable !<br/>Appuyez pour voir le récap.</p>
                          </motion.div>
                      )}

                      {wrappedStep === 1 && (
                          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center w-full">
                              <h3 className="text-3xl font-black mb-8 text-pink-200">Stats de la Soirée</h3>
                              <div className="bg-black/30 w-full p-6 rounded-3xl mb-4 border border-white/10">
                                  <p className="text-5xl font-black mb-2">{wrappedData.history.length}</p>
                                  <p className="text-lg text-white/70">Musiques écoutées</p>
                              </div>
                              <div className="bg-black/30 w-full p-6 rounded-3xl border border-white/10">
                                  <p className="text-5xl font-black mb-2">{wrappedData.stats.emojisSent}</p>
                                  <p className="text-lg text-white/70">Émojis envoyés</p>
                              </div>
                          </motion.div>
                      )}

                      {wrappedStep === 2 && (
                          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center w-full">
                              <h3 className="text-3xl font-black mb-8 text-yellow-200">Les Champions du Blind Test</h3>
                              {Object.entries(wrappedData.scores).sort((a:any, b:any) => b[1] - a[1]).slice(0, 3).map((score: any, idx: number) => (
                                  <div key={idx} className="bg-black/30 w-full p-4 rounded-2xl mb-3 flex justify-between items-center border border-white/10">
                                      <span className="font-bold text-xl"><span className="text-yellow-400 mr-2">#{idx+1}</span> {score[0]}</span>
                                      <span className="font-black text-pink-300">{score[1]} pts</span>
                                  </div>
                              ))}
                              {Object.keys(wrappedData.scores).length === 0 && <p className="text-white/60 text-lg">Aucune partie de Blind Test n'a été jouée.</p>}
                              <p className="text-white/40 mt-10 text-sm">Appuyez pour fermer</p>
                          </motion.div>
                      )}
                      
                      {/* Progress bar story style */}
                      <div className="absolute top-6 left-6 right-6 flex gap-2">
                          {[0, 1, 2].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full ${i <= wrappedStep ? 'bg-white' : 'bg-white/20'}`} />
                          ))}
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <style jsx global>{`.mask-image-fade { mask-image: linear-gradient(to bottom, transparent, black 10%, black 70%, transparent 100%); } .animate-spin-slow { animation: spin 4s linear infinite; }`}</style>
    </div>
  );
}
