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
          skipVotes: new Set()
        };
      }
      
      const existingUserIndex = rooms[roomId].users.findIndex(u => u.id === socket.id);
      if (existingUserIndex === -1) {
        rooms[roomId].users.push({ id: socket.id, username });
      }

      io.to(roomId).emit("room-update", {
        users: rooms[roomId].users,
        trackInfo: rooms[roomId].trackInfo,
        skipVotes: rooms[roomId].skipVotes.size
      });
    });

    socket.on("bridge-state", (roomId, state) => {
      if (rooms[roomId]) {
        rooms[roomId].trackInfo = state;
        // On reset les votes quand la musique change
        rooms[roomId].skipVotes.clear();
        io.to(roomId).emit("bridge-state", state);
        io.to(roomId).emit("skip-votes-update", { votes: 0, required: getRequiredVotes(roomId) });
      }
    });

    socket.on("web-action", (roomId, data) => {
      io.to(roomId).emit("web-action", data); // Relay to Mac Bridge
    });

    // --- NOUVELLES FONCTIONNALITÉS ---

    socket.on("send-reaction", (roomId, emoji) => {
      io.to(roomId).emit("new-reaction", { emoji, id: Date.now() + Math.random() });
    });

    socket.on("chat-message", (roomId, username, text) => {
      io.to(roomId).emit("new-message", { username, text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    });

    socket.on("vote-skip", (roomId) => {
      if (!rooms[roomId]) return;
      rooms[roomId].skipVotes.add(socket.id);
      
      const required = getRequiredVotes(roomId);
      const votes = rooms[roomId].skipVotes.size;
      
      io.to(roomId).emit("skip-votes-update", { votes, required });

      if (votes >= required && required > 0) {
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
          trackInfo: rooms[roomId].trackInfo
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
