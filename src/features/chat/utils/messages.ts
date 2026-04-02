import type { ChatMessage } from "../types";

export function getCurrentTime(): string {
  return new Date().toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createSystemMessage(text: string, id = Date.now()): ChatMessage {
  return {
    id,
    system: true,
    text,
    time: getCurrentTime(),
  };
}
