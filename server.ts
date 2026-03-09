import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cookieParser from "cookie-parser";
import { initDb } from "./src/lib/db.js";
import { setupWs } from "./src/lib/ws.js";
import authRoutes from "./src/routes/auth.js";
import householdRoutes from "./src/routes/household.js";
import tasksRoutes from "./src/routes/tasks.js";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = createServer(app);

  // Initialize DB
  initDb();

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/household", householdRoutes);
  app.use("/api/tasks", tasksRoutes);

  // WebSocket Setup
  const wss = new WebSocketServer({ noServer: true });
  setupWs(wss);

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
