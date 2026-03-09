import { useState, useEffect, useCallback } from 'react';

type WsMessage = {
  event: string;
  payload: any;
};

export function useWebSocket(token: string | null) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    
    setWs(socket);

    return () => {
      socket.close();
    };
  }, [token]);

  const sendMessage = useCallback((event: string, payload: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    }
  }, [ws]);

  return { ws, isConnected, sendMessage };
}
