const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};
const SPEED = 5;

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
          [ws.id]: { x: 200, y: 200, role: "host" }, // assign host role
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
      room.players[ws.id] = { x: 350, y: 200, role: "guest" }; // assign guest role
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

      if (data.dir === "w") p.y -= SPEED;
      if (data.dir === "s") p.y += SPEED;
      if (data.dir === "a") p.x -= SPEED;
      if (data.dir === "d") p.x += SPEED;

      p.x = Math.max(0, Math.min(580, p.x));
      p.y = Math.max(0, Math.min(380, p.y));

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

server.listen(8080, () => {
  console.log("Server running on port 8080");
});
