"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import io from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Users, ListMusic, MessageCircle, SkipForward, Volume2, Mic2 } from "lucide-react";

let socket: any;

export default function Room() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const username = searchParams.get("username") || "Invite";
  
  const [users, setUsers] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [trackInfo, setTrackInfo] = useState({ track: "En attente du Bridge...", artist: "Mac OS", state: "paused", queue: [] as any[] });
  const [coverUrl, setCoverUrl] = useState("https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80");
  
  // NOUVELLES FONCTIONNALITÉS
  const [activeTab, setActiveTab] = useState<'queue' | 'chat' | 'lyrics'>('queue');
  const [reactions, setReactions] = useState<{id: number, emoji: string}[]>([]);
  const [chatMessages, setChatMessages] = useState<{username: string, text: string, time: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [lyrics, setLyrics] = useState("Recherche des paroles...");
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 1 });
  const [volume, setVolume] = useState(50);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchArtworkAndLyrics = async (track: string, artist: string) => {
    if (!track || track === "Aucune musique" || track === "En attente du Bridge...") return;
    try {
      // 1. Fetch Artwork
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(track + " " + artist)}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const hdImage = data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
        setCoverUrl(hdImage);
      }
      
      // 2. Fetch Lyrics (API Lyrics.ovh)
      setLyrics("Recherche des paroles...");
      const lyricsRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`);
      const lyricsData = await lyricsRes.json();
      if (lyricsData.lyrics) {
        setLyrics(lyricsData.lyrics);
      } else {
        setLyrics("Aucune parole trouvée pour cette musique.");
      }
    } catch (e) {
      console.error(e);
      setLyrics("Erreur lors de la récupération des paroles.");
    }
  };

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/room/${roomId}`);
    
    socket = io();
    socket.emit("join-room", roomId, username);

    socket.on("room-update", (roomData: any) => {
      setUsers(roomData.users.filter((u:any) => !u.username.includes("MacBridge")));
      setSkipVotes({ votes: roomData.skipVotes, required: Math.max(1, Math.ceil(roomData.users.length / 2)) });
      if (roomData.trackInfo) {
        setTrackInfo(roomData.trackInfo);
        setIsPlaying(roomData.trackInfo.state === "playing");
        fetchArtworkAndLyrics(roomData.trackInfo.track, roomData.trackInfo.artist);
      }
    });

    socket.on("bridge-state", (state: any) => {
      setTrackInfo((prev) => {
        if (prev.track !== state.track || prev.artist !== state.artist) {
          fetchArtworkAndLyrics(state.track, state.artist);
        }
        return state;
      });
      setIsPlaying(state.state === "playing");
    });

    socket.on("new-reaction", (data: any) => {
      setReactions((prev) => [...prev, data]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== data.id));
      }, 4000); // L'émoji disparaît après 4s
    });

    socket.on("new-message", (msg: any) => {
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    socket.on("skip-votes-update", (data: any) => {
      setSkipVotes(data);
    });

    return () => socket.disconnect();
  }, [roomId, username]);

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-0 md:p-8 font-sans text-gray-900 overflow-hidden relative">
      
      {/* EFFETS EMOJIS FLOTTANTS */}
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 100, x: Math.random() * 100 - 50, scale: 0.5 }}
            animate={{ opacity: 1, y: -500, x: Math.random() * 200 - 100, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 4, ease: "easeOut" }}
            className="absolute bottom-10 left-1/2 z-50 text-5xl pointer-events-none"
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      <header className="w-full max-w-6xl hidden md:flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative z-10">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Code PIN: <span className="text-pink-600">{roomId}</span></h1>
          <p className="text-gray-500 font-medium flex items-center gap-2 mt-1">
            <Users className="w-4 h-4" /> {users.length} ami(s) connecté(s)
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="bg-white p-2 rounded-lg shadow-md">
            {joinUrl && <QRCodeSVG value={joinUrl} size={60} />}
          </div>
        </div>
      </header>

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 h-screen md:h-auto relative z-10">
        
        {/* COLONNE GAUCHE : LECTEUR */}
        <motion.div className="flex-1 bg-gray-900 text-white md:rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center h-full md:h-auto">
          <div 
            className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none scale-150 blur-3xl transition-all duration-1000"
            style={{ backgroundImage: `url(${coverUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
          />
          
          <div className="relative z-10 flex flex-col items-center w-full max-w-xs">
            <AnimatePresence mode="wait">
              <motion.img 
                key={coverUrl}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}
                src={coverUrl} alt="Album Cover" 
                className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl mb-6 md:mb-8 object-cover border border-white/10"
              />
            </AnimatePresence>
            
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 text-center truncate w-full">{trackInfo.track}</h2>
            <p className="text-gray-400 font-medium mb-6 md:mb-8 text-center text-sm md:text-lg">{trackInfo.artist}</p>
            
            {/* CONTROLES */}
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="bg-white text-black p-4 sm:p-6 rounded-full hover:scale-105 transition active:scale-95 shadow-xl">
                  {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-black" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-black" />}
                </button>
                <button onClick={voteSkip} className="bg-white/10 p-4 rounded-full hover:bg-white/20 transition relative">
                  <SkipForward className="w-6 h-6" />
                  {skipVotes.votes > 0 && (
                    <span className="absolute -top-2 -right-2 bg-pink-500 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                      {skipVotes.votes}/{skipVotes.required}
                    </span>
                  )}
                </button>
              </div>

              {/* VOLUME */}
              <div className="flex items-center gap-3 w-full px-4">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <input type="range" min="0" max="100" value={volume} onChange={changeVolume} className="flex-1 accent-pink-500" />
              </div>

              {/* REACTIONS */}
              <div className="flex gap-4 mt-2">
                {['🔥', '💃', '😍', '😴', '🍻'].map(emoji => (
                  <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-125 transition">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* COLONNE DROITE : TABS (QUEUE / CHAT / PAROLES) */}
        <div className="w-full md:w-[400px] hidden md:flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden max-h-[700px]">
          
          <div className="flex border-b border-gray-100">
            <button onClick={() => setActiveTab('queue')} className={`flex-1 p-4 font-bold text-sm ${activeTab === 'queue' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-400'}`}><ListMusic className="w-5 h-5 mx-auto mb-1" /> File</button>
            <button onClick={() => setActiveTab('lyrics')} className={`flex-1 p-4 font-bold text-sm ${activeTab === 'lyrics' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-400'}`}><Mic2 className="w-5 h-5 mx-auto mb-1" /> Paroles</button>
            <button onClick={() => setActiveTab('chat')} className={`flex-1 p-4 font-bold text-sm ${activeTab === 'chat' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-400'}`}><MessageCircle className="w-5 h-5 mx-auto mb-1" /> Chat</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 relative">
            
            {/* TABS CONTENT */}
            {activeTab === 'queue' && (
              <div className="flex flex-col gap-3">
                {(!trackInfo.queue || trackInfo.queue.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center mt-4">Aucune musique suivante.</p>
                ) : trackInfo.queue.map((q: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                    <div className="text-pink-400 font-bold text-sm w-4">{idx + 1}</div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm text-gray-900 truncate">{q.track}</p>
                      <p className="text-xs text-gray-500 truncate">{q.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'lyrics' && (
              <div className="p-4 bg-gray-900 text-white rounded-2xl min-h-full">
                <p className="whitespace-pre-line text-lg font-medium leading-relaxed text-center opacity-90">
                  {lyrics}
                </p>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-full justify-end">
                <div className="flex-1 overflow-y-auto mb-4 flex flex-col gap-3">
                  {chatMessages.length === 0 && <p className="text-gray-400 text-center text-sm mt-4">Soyez le premier à envoyer un message !</p>}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-2xl max-w-[85%] ${msg.username === username ? 'bg-pink-500 text-white self-end rounded-br-sm' : 'bg-white text-gray-800 self-start shadow-sm rounded-bl-sm'}`}>
                      <p className="text-xs opacity-70 mb-1 font-bold">{msg.username} <span className="font-normal ml-1">{msg.time}</span></p>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendChatMessage} className="flex gap-2">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message..." className="flex-1 p-3 rounded-xl border border-gray-200 focus:outline-pink-500" />
                  <button type="submit" className="bg-gray-900 text-white p-3 rounded-xl font-bold hover:bg-pink-600 transition">Envoyer</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
