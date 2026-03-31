import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Use process.env.PORT for Render/Production compatibility, default to 3000 for AIS
  const PORT = process.env.PORT || 3000;

  // Store connected clients
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("New client connected to local stream server");

    // Send initial status
    ws.send(JSON.stringify({ type: "STATUS", data: { isServerLive: true, viewers: clients.size } }));

    // Broadcast viewer count update
    broadcast({ type: "VIEWERS", data: clients.size });

    ws.on("message", (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === "CHAT") {
          // Broadcast chat messages to all clients
          broadcast({ type: "CHAT", data: payload.data });
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      broadcast({ type: "VIEWERS", data: clients.size });
    });
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // API Routes
  app.get("/api/server-status", (req, res) => {
    res.json({
      status: "online",
      uptime: process.uptime(),
      activeStreams: 1,
      serverLocation: "Local (Cloud Run Container)"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`StreamFlow Local Server running on http://localhost:${PORT}`);
  });
}

startServer();
