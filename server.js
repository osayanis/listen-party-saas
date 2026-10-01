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

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  io.on("connection", (socket) => {
    
    socket.on("join-room", (roomId, username) => {
      socket.join(roomId);
      if (!rooms[roomId]) {
        rooms[roomId] = {
          users: [],
          trackInfo: { track: "En attente...", artist: "Mac Bridge", state: "paused", queue: [] },
          skipVotes: new Set(),
          isBlindTest: false,
          blindTestScores: {},
          history: [],
          stats: { emojisSent: 0, messagesSent: 0, skips: 0 }
        };
      }
      
      const existingUserIndex = rooms[roomId].users.findIndex(u => u.id === socket.id);
      if (existingUserIndex === -1) {
        rooms[roomId].users.push({ id: socket.id, username });
        if (!rooms[roomId].blindTestScores[username]) {
            rooms[roomId].blindTestScores[username] = 0;
        }
      }

      io.to(roomId).emit("room-update", {
        users: rooms[roomId].users,
        trackInfo: rooms[roomId].trackInfo,
        skipVotes: rooms[roomId].skipVotes.size,
        isBlindTest: rooms[roomId].isBlindTest,
        blindTestScores: rooms[roomId].blindTestScores
      });
    });

    socket.on("bridge-state", (roomId, state) => {
      if (rooms[roomId]) {
        // Track History for Wrapped
        if (state.track !== "Aucune musique" && state.track !== "En attente...") {
            const lastTrack = rooms[roomId].history[rooms[roomId].history.length - 1];
            if (!lastTrack || lastTrack.track !== state.track) {
                rooms[roomId].history.push({ track: state.track, artist: state.artist, timestamp: Date.now() });
            }
        }

        rooms[roomId].trackInfo = state;
        rooms[roomId].skipVotes.clear();
        io.to(roomId).emit("bridge-state", state);
        io.to(roomId).emit("skip-votes-update", { votes: 0, required: getRequiredVotes(roomId) });
      }
    });

    socket.on("web-action", (roomId, data) => {
      io.to(roomId).emit("web-action", data);
    });

    // --- CHAT & BLIND TEST ---
    socket.on("chat-message", (roomId, username, text) => {
      if (!rooms[roomId]) return;
      rooms[roomId].stats.messagesSent++;
      io.to(roomId).emit("new-message", { username, text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    });

    socket.on("guess-blind-test", (roomId, username, guessTrack, guessArtist) => {
        if (!rooms[roomId] || !rooms[roomId].isBlindTest || !rooms[roomId].trackInfo) return;
        
        const currentTrack = rooms[roomId].trackInfo.track.toLowerCase().replace(/[^a-z0-9]/g, '');
        const currentArtist = rooms[roomId].trackInfo.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        const gTrack = guessTrack.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Validation basique : si le titre deviné correspond au vrai titre
        if (currentTrack.includes(gTrack) || gTrack.includes(currentTrack)) {
            rooms[roomId].blindTestScores[username] += 10;
            const systemMessage = `🎉 ${username} a trouvé la bonne réponse ! (+10 pts)`;
            io.to(roomId).emit("new-message", { username: "🤖 Arbitre", text: systemMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
            io.to(roomId).emit("blind-test-scores", rooms[roomId].blindTestScores);
            io.to(roomId).emit("blind-test-winner", { username, track: rooms[roomId].trackInfo.track, artist: rooms[roomId].trackInfo.artist });
        } else {
            socket.emit("blind-test-wrong"); // Notify the guesser that it's wrong
        }
    });

    socket.on("toggle-blind-test", (roomId, status) => {
        if (rooms[roomId]) {
            rooms[roomId].isBlindTest = status;
            io.to(roomId).emit("blind-test-update", status);
        }
    });

    socket.on("get-wrapped", (roomId, callback) => {
        if (rooms[roomId] && callback) {
            callback({
                history: rooms[roomId].history,
                stats: rooms[roomId].stats,
                scores: rooms[roomId].blindTestScores
            });
        }
    });

    socket.on("send-reaction", (roomId, emoji) => {
      if (rooms[roomId]) rooms[roomId].stats.emojisSent++;
      io.to(roomId).emit("new-reaction", { emoji, id: Date.now() + Math.random() });
    });

    socket.on("vote-skip", (roomId) => {
      if (!rooms[roomId]) return;
      rooms[roomId].skipVotes.add(socket.id);
      
      const required = getRequiredVotes(roomId);
      const votes = rooms[roomId].skipVotes.size;
      
      io.to(roomId).emit("skip-votes-update", { votes, required });

      if (votes >= required && required > 0) {
        rooms[roomId].stats.skips++;
        io.to(roomId).emit("web-action", { state: 'skip' });
        rooms[roomId].skipVotes.clear();
      }
    });

    socket.on("disconnect", () => {
      for (const roomId in rooms) {
        rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
        rooms[roomId].skipVotes.delete(socket.id);
        io.to(roomId).emit("room-update", {
          users: rooms[roomId].users,
          trackInfo: rooms[roomId].trackInfo,
          isBlindTest: rooms[roomId].isBlindTest,
          blindTestScores: rooms[roomId].blindTestScores
        });
      }
    });
  });

  function getRequiredVotes(roomId) {
    if (!rooms[roomId]) return 1;
    const humanUsers = rooms[roomId].users.filter(u => !u.username.includes("MacBridge")).length;
    return Math.max(1, Math.ceil(humanUsers / 2));
  }

  server.listen(port, () => {
    console.log(`> Serveur temps réel prêt sur http://${hostname}:${port}`);
  });
});
