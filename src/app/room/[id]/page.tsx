"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import io from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Users, ListMusic } from "lucide-react";

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

  const fetchArtwork = async (track: string, artist: string) => {
    if (!track || track === "Aucune musique" || track === "En attente du Bridge...") return;
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(track + " " + artist)}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const hdImage = data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
        setCoverUrl(hdImage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/room/${roomId}`);
    
    socket = io();
    socket.emit("join-room", roomId, username);

    socket.on("room-update", (roomData: any) => {
      setUsers(roomData.users.filter((u:any) => !u.username.includes("MacBridge")));
      if (roomData.trackInfo) {
        setTrackInfo(roomData.trackInfo);
        setIsPlaying(roomData.trackInfo.state === "playing");
        // FIX: Charger l'image immédiatement si on actualise la page
        fetchArtwork(roomData.trackInfo.track, roomData.trackInfo.artist);
      }
    });

    socket.on("bridge-state", (state: any) => {
      setTrackInfo((prev) => {
        if (prev.track !== state.track || prev.artist !== state.artist) {
          fetchArtwork(state.track, state.artist);
        }
        return state;
      });
      setIsPlaying(state.state === "playing");
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, username]); // FIX: Retrait de trackInfo.track pour éviter les déconnexions Socket intempestives

  const togglePlay = () => {
    const newState = isPlaying ? "paused" : "playing";
    setIsPlaying(!isPlaying);
    socket.emit("web-action", roomId, { state: newState });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-0 md:p-8 font-sans text-gray-900 overflow-hidden">
      
      {/* HEADER : Invisible en mode "Mini App", visible sur grand écran */}
      <header className="w-full max-w-5xl hidden md:flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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

      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8 h-screen md:h-auto">
        
        {/* LECTEUR PRINCIPAL : Prend tout l'écran en mode "Mini App" */}
        <motion.div 
          className="flex-1 bg-gray-900 text-white md:rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center h-full md:h-auto"
        >
          {/* Background Flouté dynamique */}
          <div 
            className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none scale-150 blur-3xl transition-all duration-1000"
            style={{ backgroundImage: `url(${coverUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
          />
          
          <div className="relative z-10 flex flex-col items-center w-full max-w-xs">
            {/* Petit badge Code PIN en mode mini */}
            <div className="md:hidden bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Salon: {roomId}
            </div>

            <AnimatePresence mode="wait">
              <motion.img 
                key={coverUrl}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                transition={{ duration: 0.3 }}
                src={coverUrl}
                alt="Album Cover" 
                className="w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-2xl shadow-2xl mb-6 md:mb-8 object-cover border border-white/10"
              />
            </AnimatePresence>
            
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 text-center truncate w-full">{trackInfo.track}</h2>
            <p className="text-gray-400 font-medium mb-6 md:mb-8 text-center text-sm md:text-lg">{trackInfo.artist}</p>
            
            <div className="flex items-center gap-6">
              <button 
                onClick={togglePlay}
                className="bg-white text-black p-4 sm:p-5 rounded-full hover:scale-105 transition active:scale-95 shadow-xl"
              >
                {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-black" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-black" />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* SIDEBAR : Invisible en mode Mini-App, visible sur grand écran */}
        <div className="w-full md:w-1/3 hidden md:flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex-1 relative max-h-[600px] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-purple-500" /> Suivants (Apple Music)
              </h3>
            </div>
            
            <div className="flex flex-col gap-3">
              {!trackInfo.queue || trackInfo.queue.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-4">
                  Aucune musique suivante.
                </p>
              ) : (
                trackInfo.queue.map((q: any, idx: number) => (
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    key={q.id + q.track} 
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition"
                  >
                    <div className="text-gray-400 font-bold text-sm w-4">{idx + 1}</div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm text-gray-900 truncate">{q.track}</p>
                      <p className="text-xs text-gray-500 truncate">{q.artist}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
