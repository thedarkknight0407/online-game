// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const rooms = {}; // roomId -> {password, clients: []}

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "host") {
      // create room
      const roomId = data.roomId;
      rooms[roomId] = { password: data.password, clients: [ws] };
      ws.roomId = roomId;
      ws.send(JSON.stringify({ type: "hosted", roomId }));
    }

    if (data.type === "join") {
      const room = rooms[data.roomId];
      if (!room) {
        ws.send(JSON.stringify({ type: "error", msg: "Room not found" }));
        return;
      }
      if (room.password !== data.password) {
        ws.send(JSON.stringify({ type: "error", msg: "Wrong password" }));
        return;
      }
      room.clients.push(ws);
      ws.roomId = data.roomId;
      ws.send(JSON.stringify({ type: "joined" }));

      // notify host of new player
      room.clients.forEach((c) => {
        if (c !== ws) c.send(JSON.stringify({ type: "new-player" }));
      });
    }

    if (data.type === "position") {
      const room = rooms[ws.roomId];
      if (!room) return;
      // broadcast to everyone else
      room.clients.forEach((c) => {
        if (c !== ws)
          c.send(JSON.stringify({ type: "position", pos: data.pos }));
      });
    }
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms[ws.roomId];
    if (!room) return;
    room.clients = room.clients.filter((c) => c !== ws);
    if (room.clients.length === 0) delete rooms[ws.roomId];
  });
});

console.log("WebSocket server running on port 8080");
