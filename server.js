// server.js
const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket server running");
});

const wss = new WebSocket.Server({ server });
const rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "host") {
      rooms[data.roomId] = { password: data.password, clients: [ws] };
      ws.roomId = data.roomId;
      ws.send(JSON.stringify({ type: "hosted", roomId: data.roomId }));
    }

    if (data.type === "join") {
      const room = rooms[data.roomId];
      if (!room || room.password !== data.password) {
        ws.send(
          JSON.stringify({ type: "error", msg: "Invalid room/password" }),
        );
        return;
      }
      room.clients.push(ws);
      ws.roomId = data.roomId;
      ws.send(JSON.stringify({ type: "joined" }));
    }

    if (data.type === "position") {
      const room = rooms[ws.roomId];
      if (!room) return;
      room.clients.forEach((c) => c !== ws && c.send(JSON.stringify(data)));
    }
  });
});

server.listen(8080, () => {
  console.log("HTTP + WebSocket server running on port 8080");
});
