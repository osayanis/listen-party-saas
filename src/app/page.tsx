"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white relative overflow-hidden font-sans">
      
      {/* Design Apple Music Style : Formes floutées discrètes */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl relative z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 relative rounded-2xl overflow-hidden shadow-lg shadow-pink-500/10 border border-white/5">
            <Image src="/logo.jpg" alt="ListenParty Logo" fill className="object-cover" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-2 tracking-tight">ListenParty</h1>
        <p className="text-center text-white/50 mb-10 font-medium text-sm md:text-base">
          Écoutez Apple Music ou Spotify entre amis.
        </p>

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-white/60 mb-2 block uppercase tracking-wider ml-1">Ton Pseudo</label>
            <input 
              type="text" 
              placeholder="Ex: Yanis" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-white/5 text-white p-4 rounded-xl focus:outline-none focus:border-pink-500/50 transition placeholder:text-white/20 font-medium"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/60 mb-2 block uppercase tracking-wider ml-1">Code du salon (PIN)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="123456" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="flex-1 bg-black/40 border border-white/5 text-white p-4 rounded-xl focus:outline-none focus:border-pink-500/50 transition placeholder:text-white/20 font-bold tracking-widest uppercase"
              />
              <button 
                type="submit" 
                className="bg-white text-black px-6 rounded-xl font-bold hover:bg-pink-500 hover:text-white transition group flex items-center justify-center"
              >
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px bg-white/5 flex-1"></div>
          <span className="text-white/30 text-xs font-bold uppercase tracking-wider">OU</span>
          <div className="h-px bg-white/5 flex-1"></div>
        </div>

        <button 
          onClick={createRoom}
          className="w-full mt-8 bg-white/[0.05] border border-white/10 text-white p-4 rounded-xl font-bold hover:bg-white/10 transition active:scale-[0.98]"
        >
          Créer un nouveau salon
        </button>
      </motion.div>

      {/* FOOTER : TÉLÉCHARGER L'APP */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-8 z-10"
      >
        <a 
          href="https://github.com/osayanis/listen-party-saas" 
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full hover:bg-white/10 transition cursor-pointer group"
        >
          <Download className="w-4 h-4 text-white/70 group-hover:-translate-y-0.5 transition" />
          <span className="text-white/90 font-semibold text-sm">App Mac (Bridge)</span>
        </a>
      </motion.div>

    </div>
  );
}
