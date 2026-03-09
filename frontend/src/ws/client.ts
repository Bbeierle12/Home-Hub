import { env } from "../config/env";

type Listener = (event: MessageEvent<string>) => void;

export class HouseholdWsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private attempts = 0;
  private listeners = new Set<Listener>();

  connect(token: string, householdId: string) {
    this.disconnect();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${protocol}//${window.location.host}${env.wsPath}?token=${token}&household_id=${householdId}`,
    );
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
    };

    socket.onmessage = (event) => {
      this.listeners.forEach((listener) => listener(event));
    };

    socket.onclose = () => {
      this.scheduleReconnect(token, householdId);
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private scheduleReconnect(token: string, householdId: string) {
    const delay = Math.min(1000 * 2 ** this.attempts, 10_000);
    this.attempts += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.connect(token, householdId);
    }, delay);
  }
}

export const householdWsClient = new HouseholdWsClient();
