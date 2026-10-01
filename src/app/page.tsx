"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Music, Users } from "lucide-react";

export default function Home() {
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin && username) {
      router.push(`/room/${pin}?username=${username}`);
    }
  };

  const handleCreate = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    router.push(`/room/${newPin}?host=true&username=Admin`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex flex-col items-center justify-center p-4 font-sans text-white">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-gray-800"
      >
        <div className="text-center mb-8">
          <div className="bg-pink-500 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Music className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">ListenParty</h1>
          <p className="text-gray-500 font-medium mt-2">Écoutez Apple Music entre amis, en temps réel.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <input 
            type="text" 
            placeholder="Code PIN de la session" 
            className="w-full text-center text-2xl font-bold p-4 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none transition"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="Ton pseudo" 
            className="w-full text-center text-lg p-4 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none transition"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button 
            type="submit" 
            className="w-full bg-gray-900 hover:bg-black text-white font-bold text-xl py-4 rounded-xl transition shadow-xl"
          >
            Rejoindre
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <button onClick={handleCreate} className="w-full bg-pink-100 hover:bg-pink-200 text-pink-700 font-bold py-3 rounded-xl transition flex justify-center items-center gap-2">
            <Users className="w-5 h-5" /> Créer un nouveau salon
          </button>
        </div>
      </motion.div>
    </div>
  );
}
