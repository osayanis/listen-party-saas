"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Headphones, ArrowRight } from "lucide-react";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && username) {
      router.push(`/room/${roomId}?username=${encodeURIComponent(username)}`);
    }
  };

  const createRoom = () => {
    const newRoom = Math.floor(100000 + Math.random() * 900000).toString();
    if (username) {
      router.push(`/room/${newRoom}?username=${encodeURIComponent(username)}`);
    } else {
      alert("Veuillez entrer un pseudo pour créer un salon !");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white relative overflow-hidden">
      
      {/* Design Apple Music Style : Formes floutées */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-pink-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-3xl border border-white/20 p-8 md:p-10 rounded-[3rem] shadow-2xl relative z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-pink-500 p-4 rounded-full shadow-lg shadow-pink-500/30">
            <Headphones className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-center mb-2 tracking-tight">ListenParty</h1>
        <p className="text-center text-white/60 mb-10 font-medium text-sm md:text-base">
          Écoutez Apple Music ou Spotify entre amis, en temps réel.
        </p>

        <form onSubmit={handleJoin} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-bold text-white/80 mb-2 block ml-2">Ton Pseudo</label>
            <input 
              type="text" 
              placeholder="Ex: Yanis" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/30 border border-white/10 text-white p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500 transition placeholder:text-white/30 font-medium"
              required
            />
          </div>

          <div>
            <label className="text-sm font-bold text-white/80 mb-2 block ml-2">Code du salon (PIN)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="123456" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="flex-1 bg-black/30 border border-white/10 text-white p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500 transition placeholder:text-white/30 font-bold tracking-widest uppercase"
              />
              <button 
                type="submit" 
                className="bg-white text-black px-6 rounded-2xl font-bold hover:bg-pink-500 hover:text-white transition group flex items-center justify-center"
              >
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-white/40 text-sm font-medium">OU</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <button 
          onClick={createRoom}
          className="w-full mt-8 bg-pink-500 text-white p-4 rounded-2xl font-bold hover:bg-pink-600 transition shadow-lg shadow-pink-500/25 active:scale-[0.98]"
        >
          Créer un nouveau salon
        </button>
      </motion.div>
    </div>
  );
}
