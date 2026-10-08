"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Download, Music, Plus, Loader2, Key } from "lucide-react";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && username) {
      setIsLoading(true);
      router.push(`/room/${roomId}?username=${encodeURIComponent(username)}`);
    }
  };

  const createRoom = () => {
    if (username) {
      setIsLoading(true);
      const newRoom = Math.floor(100000 + Math.random() * 900000).toString();
      router.push(`/room/${newRoom}?username=${encodeURIComponent(username)}`);
    } else {
      alert("Veuillez entrer un pseudo pour créer un salon !");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 text-white relative overflow-hidden font-sans">

      {/* Halos radiaux — identiques à OsaDrop / OsaCast */}
      <div className="fixed top-[-250px] left-[-250px] w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_50%)] pointer-events-none z-0" />
      <div className="fixed bottom-[-250px] right-[-250px] w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.15)_0%,transparent_50%)] pointer-events-none z-0" />

      {/* En-tête */}
      <div className="relative z-10 text-center mb-10">
        <h1 className="text-5xl font-black mb-4 tracking-tight">OsaParty</h1>
        <div className="flex items-center justify-center gap-2 text-white/50 font-medium">
          <Music className="w-5 h-5 text-blue-400" />
          <span>Écoute synchronisée. Lecture partagée entre amis.</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md glass-card rounded-3xl p-8 space-y-8 relative z-10"
      >
        {/* Pseudo */}
        <div>
          <label className="block text-sm font-bold mb-2 text-white/70">Ton pseudo</label>
          <input
            type="text"
            placeholder="Ex: Yanis"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white font-medium focus:outline-none focus:border-blue-500 transition placeholder:text-white/30"
          />
        </div>

        {/* Créer */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-bold mb-2">Créer un salon</h2>
          <button
            onClick={createRoom}
            disabled={isLoading}
            className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            {isLoading ? "Création…" : "Lancer un nouveau salon"}
          </button>
        </div>

        {/* Rejoindre */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-bold mb-4">Rejoindre un salon</h2>
          <form onSubmit={handleJoin} className="flex gap-2">
            <div className="relative flex-1">
              <Key className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Code à 6 chiffres"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-bold tracking-widest focus:outline-none focus:border-blue-500 transition placeholder:text-white/30 placeholder:font-medium placeholder:tracking-normal"
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={!roomId || !username || isLoading}
              className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Lien app Mac */}
      <a
        href="https://github.com/osayanis/listen-party-saas"
        target="_blank" rel="noopener noreferrer"
        className="relative z-10 mt-10 flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full hover:bg-white/10 hover:border-white/20 transition group"
      >
        <Download className="w-4 h-4 text-white/70 group-hover:-translate-y-0.5 transition-transform" />
        <span className="text-white/70 group-hover:text-white font-medium text-sm">Télécharger pour Mac</span>
      </a>
    </div>
  );
}
