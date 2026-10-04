"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Download, Music, Plus } from "lucide-react";
import Image from "next/image";

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
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 text-white relative overflow-hidden font-sans selection:bg-pink-500/30">
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen transform -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen transform translate-y-1/3" />

      {/* Main Card */}
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="bg-[#0f0f0f]/90 backdrop-blur-3xl border border-white/[0.08] p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-black/50">
          
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 relative rounded-3xl overflow-hidden shadow-[0_0_40px_-10px_rgba(236,72,153,0.4)] border border-white/10 mb-6">
              <Image src="/logo.jpg" alt="ListenParty Logo" fill className="object-cover" unoptimized={true} />
            </div>
            <h1 className="text-3xl font-bold text-center tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              ListenParty
            </h1>
            <p className="text-center text-white/40 font-medium text-sm mt-2 flex items-center justify-center gap-2">
              <Music className="w-4 h-4" /> Connecte Spotify ou Apple Music
            </p>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-5">
            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest pl-1">Ton Pseudo</label>
              <input 
                type="text" 
                placeholder="Ex: Yanis" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] text-white p-4 rounded-2xl focus:outline-none focus:border-pink-500/50 focus:bg-white/[0.05] transition-all placeholder:text-white/20 font-medium"
                required
              />
            </div>

            {/* PIN & Submit */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest pl-1">Rejoindre un salon</label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="CODE PIN" 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] text-white p-4 rounded-2xl focus:outline-none focus:border-pink-500/50 focus:bg-white/[0.05] transition-all placeholder:text-white/20 font-bold tracking-[0.2em] uppercase"
                />
                <button 
                  type="submit" 
                  disabled={!roomId || !username}
                  className="aspect-square h-full bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:hover:bg-pink-500 text-white rounded-2xl transition-all flex items-center justify-center group shadow-lg shadow-pink-500/25"
                >
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-1"></div>
            <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Ou</span>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-1"></div>
          </div>

          {/* Create Button */}
          <button 
            onClick={createRoom}
            className="w-full bg-white text-black p-4 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Créer un nouveau salon
          </button>
        </div>
      </motion.div>

      {/* Mac App Download */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-12 relative z-10"
      >
        <a 
          href="https://github.com/osayanis/listen-party-saas" 
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] px-6 py-3.5 rounded-full hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer group"
        >
          <div className="bg-white/10 p-1.5 rounded-full">
            <Download className="w-4 h-4 text-white group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <span className="text-white/70 group-hover:text-white font-medium text-sm">Télécharger pour Mac</span>
        </a>
      </motion.div>

    </div>
  );
}
