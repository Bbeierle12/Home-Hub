import type { WsEnvelope } from "../types/api";
import { useCalendarStore } from "../stores/calendar";
import { useKindredStore } from "../stores/kindred";
import { usePantryStore } from "../stores/pantry";
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

  if (envelope.module === "pantry") {
    usePantryStore.getState().ingestPantryEvent(envelope.type, envelope.payload);
  }

  if (envelope.module === "calendar") {
    useCalendarStore.getState().ingestCalendarEvent(envelope.type, envelope.payload);
  }

  if (envelope.module === "kindred") {
    useKindredStore.getState().ingestKindredEvent(envelope.type, envelope.payload);
  }
}
