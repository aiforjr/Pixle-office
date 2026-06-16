import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer, Socket } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

type PresencePayload = {
  name: string;
  c: number;
  r: number;
  facing: string;
  sitting: boolean;
};

type PositionPayload = {
  name: string;
  c: number;
  r: number;
  x: number;
  y: number;
  facing: string;
  sitting: boolean;
  moving: boolean;
  status?: string;
};

// Server-side presence store: username → last known presence
const presence = new Map<string, PresencePayload>();

const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
    // Faster ghost detection: ~15s instead of default ~45s
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket: Socket) => {
    let myName: string | null = null;

    // Client registers on connect (and on every reconnect)
    socket.on("join", (payload: PresencePayload) => {
      myName = payload.name;
      presence.set(myName, payload);
      socket.join("pixle-office");

      // Send the full current presence state to the new user
      socket.emit("sync", Object.fromEntries(presence));

      // Notify everyone else
      socket.to("pixle-office").emit("join", { key: myName, pres: payload });
    });

    // High-frequency position relay (~10 Hz) — just forward, don't broadcast back to sender
    socket.on("pos", (payload: PositionPayload) => {
      if (myName) {
        const existing = presence.get(myName);
        if (existing) {
          existing.c = payload.c;
          existing.r = payload.r;
          existing.facing = payload.facing;
          existing.sitting = payload.sitting;
        }
      }
      socket.to("pixle-office").emit("pos", payload);
    });

    // Low-frequency presence refresh (~1 Hz)
    socket.on("update-presence", (payload: PresencePayload) => {
      if (myName) presence.set(myName, payload);
    });

    // Broadcast events — relay to room, skip sender
    socket.on("wave", (payload: { from: string }) => {
      socket.to("pixle-office").emit("wave", payload);
    });

    socket.on("chime", (payload: { from: string }) => {
      socket.to("pixle-office").emit("chime", payload);
    });

    socket.on("meet-invite", (payload: { from: string; room: string }) => {
      socket.to("pixle-office").emit("meet-invite", payload);
    });

    // Ghost-user cleanup: fires automatically on TCP drop / tab close / crash
    socket.on("disconnect", () => {
      if (!myName) return;
      presence.delete(myName);
      io.to("pixle-office").emit("leave", { key: myName, name: myName });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
