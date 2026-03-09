import type { WsEnvelope } from "../types/api";
import { useShoppingStore } from "../stores/shopping";
import { useTasksStore } from "../stores/tasks";

export function handleWsMessage(event: MessageEvent<string>) {
  const envelope = JSON.parse(event.data) as WsEnvelope;

  if (envelope.module === "tasks") {
    useTasksStore.getState().ingestTaskEvent(envelope.type, envelope.payload);
  }

  if (envelope.module === "shopping") {
    useShoppingStore.getState().ingestShoppingEvent(envelope.type, envelope.payload);
  }
}
