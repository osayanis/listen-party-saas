const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer);

  const rooms = {};

  io.on("connection", (socket) => {
    console.log("Utilisateur connecté:", socket.id);

    socket.on("join-room", (roomId, username) => {
      socket.join(roomId);
      if (!rooms[roomId]) {
        rooms[roomId] = { 
          users: [], 
          trackInfo: { track: "En attente...", artist: "Mac Bridge", state: "paused" },
          queue: [] // NOUVEAU : File d'attente globale
        };
      }
      rooms[roomId].users.push({ id: socket.id, username });
      
      io.to(roomId).emit("room-update", rooms[roomId]);
    });

    // Gestion de la file d'attente collaborative
    socket.on("add-to-queue", (roomId, trackItem) => {
      if (rooms[roomId]) {
        rooms[roomId].queue.push(trackItem);
        io.to(roomId).emit("queue-update", rooms[roomId].queue);
      }
    });

    // Suppression d'une musique de la file
    socket.on("remove-from-queue", (roomId, trackId) => {
      if (rooms[roomId]) {
        rooms[roomId].queue = rooms[roomId].queue.filter(t => t.id !== trackId);
        io.to(roomId).emit("queue-update", rooms[roomId].queue);
      }
    });

    socket.on("web-action", (roomId, action) => {
      socket.to(roomId).emit("web-action", action);
    });

    socket.on("bridge-state", (roomId, state) => {
      if (rooms[roomId]) {
        rooms[roomId].trackInfo = state;
        io.to(roomId).emit("bridge-state", state);
      }
    });

    socket.on("disconnect", () => {
      for (const roomId in rooms) {
        rooms[roomId].users = rooms[roomId].users.filter((u) => u.id !== socket.id);
        io.to(roomId).emit("room-update", rooms[roomId]);
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
