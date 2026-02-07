const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
console.log("Server running on ws://localhost:8080");

const rooms = {};
const SPEED = 5;
const TICK_RATE = 30; // 30 updates per second

// Helper: random color
function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
}

// Handle connections
wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "host") {
      const roomId = data.roomId;
      const password = data.password || "";

      if (!roomId || rooms[roomId]) {
        ws.send(
          JSON.stringify({ type: "error", msg: "Room exists or invalid" }),
        );
        return;
      }

      rooms[roomId] = { password, players: {}, clients: [] };
      ws.roomId = roomId;
      rooms[roomId].clients.push(ws);

      rooms[roomId].players[(ws._id = "host")] = {
        x: 200,
        y: 200,
        role: "host",
        color: randomColor(),
        keys: {},
      };

      ws.send(JSON.stringify({ type: "hostCreated", roomId }));
    } else if (data.type === "join") {
      const room = rooms[data.roomId];
      if (!room) {
        ws.send(JSON.stringify({ type: "error", msg: "Room not found" }));
        return;
      }
      if (room.password !== data.password) {
        ws.send(JSON.stringify({ type: "error", msg: "Wrong password" }));
        return;
      }

      ws.roomId = data.roomId;
      room.clients.push(ws);
      room.players[(ws._id = "guest" + Date.now())] = {
        x: 350,
        y: 200,
        role: "guest",
        color: randomColor(),
        keys: {},
      };

      ws.send(JSON.stringify({ type: "joined", players: room.players }));
    } else if (data.type === "input") {
      const room = rooms[ws.roomId];
      if (!room) return;
      const p = room.players[ws._id];
      if (!p) return;
      p.keys = data.keys || {};
    }
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms[ws.roomId];
    if (!room) return;

    room.clients = room.clients.filter((c) => c !== ws);
    delete room.players[ws._id];

    if (room.clients.length === 0) delete rooms[ws.roomId];
  });
});

// Server tick for smooth movement
setInterval(() => {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    for (const id in room.players) {
      const p = room.players[id];
      const k = p.keys || {};
      if (k.w) p.y -= SPEED;
      if (k.s) p.y += SPEED;
      if (k.a) p.x -= SPEED;
      if (k.d) p.x += SPEED;

      p.x = Math.max(0, Math.min(580, p.x));
      p.y = Math.max(0, Math.min(380, p.y));
    }

    // Broadcast positions
    room.clients.forEach((c) => {
      c.send(JSON.stringify({ type: "state", players: room.players }));
    });
  }
}, 1000 / TICK_RATE);
