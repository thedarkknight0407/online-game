const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};
const SPEED = 5;
const TICK_RATE = 30; // 30 updates per second

wss.on("connection", (ws) => {
  ws.id = Math.random().toString(36).slice(2);

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // HOST
    if (data.type === "host") {
      rooms[data.roomId] = {
        password: data.password,
        clients: [ws],
        players: {
          [ws.id]: { x: 200, y: 200, role: "host", color: give_color() }, // assign host role
        },
      };
      ws.roomId = data.roomId;
      ws.send(
        JSON.stringify({
          type: "hosted",
          id: ws.id,
        }),
      );

      // send initial state
      ws.send(
        JSON.stringify({
          type: "state",
          players: rooms[data.roomId].players,
        }),
      );
    }

    // JOIN
    if (data.type === "join") {
      const room = rooms[data.roomId];
      if (!room || room.password !== data.password) {
        ws.send(
          JSON.stringify({
            type: "error",
            msg: "Wrong room or password",
          }),
        );
        return;
      }

      room.clients.push(ws);
      room.players[ws.id] = {
        x: 350,
        y: 200,
        role: "guest",
        color: give_color(),
      }; // assign guest role
      ws.roomId = data.roomId;

      ws.send(
        JSON.stringify({
          type: "joined",
          id: ws.id,
        }),
      );

      // broadcast updated state to everyone
      room.clients.forEach((c) => {
        c.send(
          JSON.stringify({
            type: "state",
            players: room.players,
          }),
        );
      });
    }

    // INPUT
    if (data.type === "input") {
      const room = rooms[ws.roomId];
      if (!room) return;
      const p = room.players[ws.id];
      if (!p) return;

      const keys = data.keys || {};
      if (keys.w) p.y -= SPEED;
      if (keys.s) p.y += SPEED;
      if (keys.a) p.x -= SPEED;
      if (keys.d) p.x += SPEED;

      // Clamp inside canvas
      p.x = Math.max(0, Math.min(580, p.x));
      p.y = Math.max(0, Math.min(380, p.y));

      // Broadcast updated positions
      room.clients.forEach((c) => {
        c.send(
          JSON.stringify({
            type: "state",
            players: room.players,
          }),
        );
      });
    }
  });

  ws.on("close", () => {
    const room = rooms[ws.roomId];
    if (!room) return;
    delete room.players[ws.id];
    room.clients = room.clients.filter((c) => c !== ws);
    if (room.clients.length === 0) delete rooms[ws.roomId];
    else {
      // update remaining clients
      room.clients.forEach((c) => {
        c.send(
          JSON.stringify({
            type: "state",
            players: room.players,
          }),
        );
      });
    }
  });
});

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

function give_color() {
  const letter = "0123456ABCDEF";
  return_v = "#";
  for (let i = 0; i < 6; i++) {
    return_v += letter.charAt(Math.floor(Math.random() * letter.length));
  }

  return return_v;
}

server.listen(8080, () => {
  console.log("Server running on port 8080");
});
