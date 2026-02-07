const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
let players = {};

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).substr(2, 5);
  players[id] = { x: 100, y: 100 };

  ws.on("message", (msg) => {
    players[id] = JSON.parse(msg);
    broadcast();
  });

  ws.on("close", () => {
    delete players[id];
    broadcast();
  });

  function broadcast() {
    const data = JSON.stringify(players);
    wss.clients.forEach((c) => c.readyState === 1 && c.send(data));
  }
});

console.log("Server running on ws://localhost:8080");
