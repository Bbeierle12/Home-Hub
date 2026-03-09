import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth.js';

const clients = new Map<string, Set<WebSocket>>(); // householdId -> set of connections

export function setupWs(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    const payload = verifyToken(token);
    if (!payload || !payload.householdId) {
      ws.close(1008, 'Invalid token or no household');
      return;
    }

    const { householdId, userId } = payload;

    if (!clients.has(householdId)) {
      clients.set(householdId, new Set());
    }
    clients.get(householdId)!.add(ws);

    console.log(`User ${userId} connected to household ${householdId}`);

    ws.on('message', (message) => {
      // Broadcast to everyone in the household except sender
      const data = message.toString();
      clients.get(householdId)?.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    });

    ws.on('close', () => {
      clients.get(householdId)?.delete(ws);
      if (clients.get(householdId)?.size === 0) {
        clients.delete(householdId);
      }
      console.log(`User ${userId} disconnected from household ${householdId}`);
    });
  });
}

export function broadcastToHousehold(householdId: string, event: string, payload: any) {
  const data = JSON.stringify({ event, payload });
  clients.get(householdId)?.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
