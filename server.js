const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = {};
const EMPTY_ROOM_TTL = 15 * 60 * 1000; // un salon vide est oublié au bout de 15 min
const BLIND_POINTS = [10, 6, 3];       // 1er, 2e, 3e à trouver (puis 1 pt)
const PLACEHOLDER_TRACKS = ["Aucune musique", "En attente...", "Unknown"];

const isBridge = (name) => (name || "").includes("MacBridge");
const clip = (s, n) => String(s || "").trim().slice(0, n);
const clock = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

// Normalise un titre pour le blind test : sans accents, sans (feat. …) / [Remix], alphanumérique.
const norm = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\s-\s.*$/, "")
    .replace(/[^a-z0-9]/g, "");

function newRoom() {
  return {
    users: [],
    trackInfo: { track: "En attente...", artist: "Mac Bridge", state: "paused", queue: [] },
    sampledAt: Date.now(),
    skipVotes: new Set(),
    isBlindTest: false,
    blindTestScores: {},
    solvers: [],               // qui a trouvé le morceau en cours (blind test)
    history: [],
    stats: { emojisSent: 0, messagesSent: 0, skips: 0 },
    perUser: {},               // { pseudo: { messages, reactions } } pour le Wrapped
    emojiCounts: {},
    createdAt: Date.now(),
    hostId: null,
    isLocked: false,
    cleanup: null,
  };
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url, true)));
  const io = new Server(server);

  const humans = (room) => room.users.filter((u) => !isBridge(u.username));
  const requiredVotes = (room) => Math.max(1, Math.ceil(humans(room).length / 2));
  const userStats = (room, name) => (room.perUser[name] ||= { messages: 0, reactions: 0 });

  const snapshot = (room) => ({
    users: room.users,
    trackInfo: room.trackInfo,
    trackAge: Date.now() - room.sampledAt,   // ms écoulées depuis la dernière position connue
    skipVotes: room.skipVotes.size,
    requiredVotes: requiredVotes(room),
    isBlindTest: room.isBlindTest,
    blindTestScores: room.blindTestScores,
    solvers: room.solvers.map((s) => s.username),
    hostId: room.hostId,
    isLocked: room.isLocked,
    createdAt: room.createdAt,
  });

  const broadcastRoom = (roomId) => rooms[roomId] && io.to(roomId).emit("room-update", snapshot(rooms[roomId]));
  const system = (roomId, text, kind = "info") =>
    io.to(roomId).emit("new-message", { username: "OsaParty", text, time: clock(), system: true, kind });
  const isHostOf = (room, socket) => room && room.hostId === socket.id;

  io.on("connection", (socket) => {
    socket.on("join-room", (rawRoomId, rawName) => {
      const roomId = clip(rawRoomId, 12);
      const username = clip(rawName, 24) || "Invité";
      if (!roomId) return;
      const room = (rooms[roomId] ||= newRoom());

      if (room.isLocked && !isBridge(username)) {
        socket.emit("room-locked");
        return;
      }
      if (room.cleanup) { clearTimeout(room.cleanup); room.cleanup = null; }

      socket.join(roomId);
      if (!room.hostId && !isBridge(username)) room.hostId = socket.id;

      if (!room.users.some((u) => u.id === socket.id)) {
        room.users.push({ id: socket.id, username });
        if (!isBridge(username)) {
          room.blindTestScores[username] ||= 0;
          system(roomId, `${username} a rejoint la soirée`, "join");
        } else {
          system(roomId, `Un Mac diffuse maintenant la musique${username.includes("OsaNotch") ? " (OsaNotch)" : ""}`, "bridge");
        }
      }
      broadcastRoom(roomId);
    });

    // État de lecture envoyé par le Mac qui diffuse (OsaNotch ou mac_bridge.py).
    socket.on("bridge-state", (roomId, state) => {
      const room = rooms[roomId];
      if (!room || !state) return;
      const prev = room.trackInfo || {};
      const trackChanged = prev.track !== state.track || prev.artist !== state.artist;

      room.trackInfo = {
        state: state.state,
        track: clip(state.track, 200),
        artist: clip(state.artist, 200),
        queue: Array.isArray(state.queue) ? state.queue.slice(0, 20) : [],
        position: typeof state.position === "number" ? state.position : undefined,
        duration: typeof state.duration === "number" ? state.duration : undefined,
      };
      room.sampledAt = Date.now();

      if (trackChanged) {
        if (!PLACEHOLDER_TRACKS.includes(state.track)) {
          room.history.push({ track: room.trackInfo.track, artist: room.trackInfo.artist, timestamp: Date.now() });
        }
        // Les votes et le blind test ne repartent à zéro qu'au changement de morceau
        // (le pont renvoie aussi la position toutes les quelques secondes).
        room.skipVotes.clear();
        room.solvers = [];
        io.to(roomId).emit("skip-votes-update", { votes: 0, required: requiredVotes(room) });
      }
      io.to(roomId).emit("bridge-state", { ...room.trackInfo, age: 0, solvers: room.solvers.map((s) => s.username) });
    });

    socket.on("web-action", (roomId, data) => {
      if (rooms[roomId] && data && data.state) io.to(roomId).emit("web-action", { state: data.state });
    });

    // --- CHAT ---
    socket.on("chat-message", (roomId, username, text) => {
      const room = rooms[roomId];
      const msg = clip(text, 500);
      if (!room || !msg) return;
      room.stats.messagesSent++;
      userStats(room, clip(username, 24)).messages++;
      io.to(roomId).emit("new-message", { username: clip(username, 24), text: msg, time: clock() });
    });

    // --- BLIND TEST ---
    socket.on("guess-blind-test", (roomId, username, guessTrack) => {
      const room = rooms[roomId];
      if (!room || !room.isBlindTest || !room.trackInfo) return;
      const name = clip(username, 24);
      if (room.solvers.some((s) => s.username === name)) { socket.emit("blind-test-already"); return; }

      const current = norm(room.trackInfo.track);
      const guess = norm(guessTrack);
      const ok = guess.length >= 2 && current.length >= 1 && (current === guess || current.includes(guess) || guess.includes(current));
      if (!ok) { socket.emit("blind-test-wrong"); return; }

      const rank = room.solvers.length;
      const points = BLIND_POINTS[rank] ?? 1;
      room.solvers.push({ username: name, points });
      room.blindTestScores[name] = (room.blindTestScores[name] || 0) + points;
      system(roomId, `${rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "✅"} ${name} a trouvé ! +${points} pts`, "win");
      io.to(roomId).emit("blind-test-scores", room.blindTestScores);
      io.to(roomId).emit("blind-test-winner", {
        username: name, points, rank,
        solvers: room.solvers.map((s) => s.username),
        track: room.trackInfo.track, artist: room.trackInfo.artist,
      });
    });

    socket.on("toggle-blind-test", (roomId, status) => {
      const room = rooms[roomId];
      if (!room || (room.hostId && room.hostId !== socket.id)) return;
      room.isBlindTest = !!status;
      room.solvers = [];
      io.to(roomId).emit("blind-test-update", room.isBlindTest);
      system(roomId, room.isBlindTest ? "🎯 Blind test lancé ! Devinez le titre." : "Blind test terminé", "game");
      broadcastRoom(roomId);
    });

    // --- WRAPPED ---
    socket.on("get-wrapped", (roomId, callback) => {
      const room = rooms[roomId];
      if (!room || typeof callback !== "function") return;
      callback({
        history: room.history,
        stats: room.stats,
        scores: room.blindTestScores,
        perUser: room.perUser,
        emojiCounts: room.emojiCounts,
        createdAt: room.createdAt,
        endedAt: Date.now(),
      });
    });

    // --- MODÉRATION (hôte) ---
    socket.on("kick-user", (roomId, targetId) => {
      const room = rooms[roomId];
      if (!isHostOf(room, socket) || targetId === socket.id) return;
      const target = room.users.find((u) => u.id === targetId);
      io.to(targetId).emit("kicked");
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) targetSocket.disconnect();
      if (target) system(roomId, `${target.username} a été expulsé`, "leave");
    });

    socket.on("transfer-host", (roomId, targetId) => {
      const room = rooms[roomId];
      if (!isHostOf(room, socket)) return;
      const target = room.users.find((u) => u.id === targetId && !isBridge(u.username));
      if (!target) return;
      room.hostId = target.id;
      system(roomId, `👑 ${target.username} est maintenant l'hôte`, "host");
      broadcastRoom(roomId);
    });

    socket.on("force-skip", (roomId) => {
      const room = rooms[roomId];
      if (!isHostOf(room, socket)) return;
      room.stats.skips++;
      room.skipVotes.clear();
      io.to(roomId).emit("web-action", { state: "skip" });
      system(roomId, "L'hôte a passé le morceau", "skip");
    });

    socket.on("toggle-lock", (roomId) => {
      const room = rooms[roomId];
      if (!isHostOf(room, socket)) return;
      room.isLocked = !room.isLocked;
      system(roomId, room.isLocked ? "🔒 Salon verrouillé" : "🔓 Salon ouvert", "lock");
      broadcastRoom(roomId);
    });

    // --- RÉACTIONS & VOTES ---
    socket.on("send-reaction", (roomId, emoji, username) => {
      const room = rooms[roomId];
      const e = clip(emoji, 8);
      if (!room || !e) return;
      room.stats.emojisSent++;
      room.emojiCounts[e] = (room.emojiCounts[e] || 0) + 1;
      const name = clip(username, 24);
      if (name) userStats(room, name).reactions++;
      io.to(roomId).emit("new-reaction", { emoji: e, username: name, id: Date.now() + Math.random() });
    });

    socket.on("vote-skip", (roomId) => {
      const room = rooms[roomId];
      if (!room) return;
      const me = room.users.find((u) => u.id === socket.id);
      if (!me || isBridge(me.username)) return;
      room.skipVotes.add(socket.id);

      const required = requiredVotes(room);
      const votes = room.skipVotes.size;
      io.to(roomId).emit("skip-votes-update", { votes, required });

      if (votes >= required) {
        room.stats.skips++;
        room.skipVotes.clear();
        io.to(roomId).emit("web-action", { state: "skip" });
        system(roomId, "La salle a voté : morceau suivant ⏭", "skip");
      }
    });

    socket.on("disconnect", () => {
      for (const roomId in rooms) {
        const room = rooms[roomId];
        const leaving = room.users.find((u) => u.id === socket.id);
        if (!leaving) continue;

        room.users = room.users.filter((u) => u.id !== socket.id);
        room.skipVotes.delete(socket.id);
        system(roomId, isBridge(leaving.username) ? "Le Mac qui diffusait s'est déconnecté" : `${leaving.username} est parti`, isBridge(leaving.username) ? "bridge" : "leave");

        if (room.hostId === socket.id) {
          const next = humans(room)[0];
          room.hostId = next ? next.id : null;
          if (next) system(roomId, `👑 ${next.username} est maintenant l'hôte`, "host");
        }

        if (room.users.length === 0) {
          room.cleanup = setTimeout(() => { if (rooms[roomId] && rooms[roomId].users.length === 0) delete rooms[roomId]; }, EMPTY_ROOM_TTL);
        }
        broadcastRoom(roomId);
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Serveur temps réel prêt sur http://${hostname}:${port}`);
  });
});
