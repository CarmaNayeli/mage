import { useEffect, useReducer, useRef, useCallback } from "react";
import { gameReducer, initialGameState, type GameState } from "../state/gameReducer";
import type { GatewayEnvelope } from "../types/envelope";

/**
 * Connects to Web.Gateway's WebSocket endpoint (mage.web.gateway.GatewayServer).
 * Each server push is a GatewayEnvelope (see types/envelope.ts); `send` mirrors the
 * real Session API back - "send_uuid"/"send_boolean"/"send_integer"/"send_string"/
 * "send_mana_type", plus "join_practice_table" to start a match.
 */
export function useGatewayConnection(url: string | null) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) {
      return;
    }

    dispatch({ kind: "connection-status", status: "connecting" });
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => dispatch({ kind: "connection-status", status: "connected" });
    socket.onclose = () => dispatch({ kind: "connection-status", status: "disconnected" });
    socket.onerror = () => dispatch({ kind: "connection-status", status: "error" });
    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const envelope = JSON.parse(event.data) as GatewayEnvelope;
        dispatch({ kind: "envelope", envelope });
      } catch (e) {
        // A malformed frame shouldn't take the whole connection down - log and move on.
        console.error("Failed to parse gateway message", e, event.data);
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [url]);

  const send = useCallback((call: string, args: unknown[] = []) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send "${call}" - socket not open`);
      return;
    }
    socket.send(JSON.stringify({ call, args }));
  }, []);

  const reset = useCallback(() => dispatch({ kind: "reset" }), []);
  const answerDialog = useCallback(() => dispatch({ kind: "dialog-answered" }), []);

  return { state, send, reset, answerDialog } satisfies {
    state: GameState;
    send: (call: string, args?: unknown[]) => void;
    reset: () => void;
    answerDialog: () => void;
  };
}
