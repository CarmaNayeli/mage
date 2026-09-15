import { useEffect, useReducer, useRef, useCallback } from "react";
import { gameReducer, initialGameState, type GameState } from "../state/gameReducer";
import type { DialogPayload, GatewayEnvelope } from "../types/envelope";
import { getAutoPassResponse } from "../utils/autoPass";

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
        // A plain priority window with nothing legal to do but pass, or a declare-
        // attackers/blockers prompt with zero legal attackers/blockers, isn't a real
        // question - answer it immediately instead of making the player click by hand
        // every time (gameReducer mirrors this same check so the dialog never actually
        // renders in this case either - no click-then-flicker, just nothing shown).
        const autoResponse = getAutoPassResponse(envelope.type, envelope.data as DialogPayload);
        if (autoResponse !== null) {
          socket.send(JSON.stringify({ call: "send_boolean", args: [autoResponse] }));
        }
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
  const consumeAccountDeck = useCallback(() => dispatch({ kind: "account-deck-consumed" }), []);
  const clearAccountError = useCallback(() => dispatch({ kind: "account-error-cleared" }), []);

  return { state, send, reset, answerDialog, consumeAccountDeck, clearAccountError } satisfies {
    state: GameState;
    send: (call: string, args?: unknown[]) => void;
    reset: () => void;
    answerDialog: () => void;
    consumeAccountDeck: () => void;
    clearAccountError: () => void;
  };
}
