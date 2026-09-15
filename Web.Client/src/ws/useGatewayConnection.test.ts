import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMockWebSocket, MockWebSocket } from "../test/mockWebSocket";
import { useGatewayConnection } from "./useGatewayConnection";

describe("useGatewayConnection", () => {
  let restoreWebSocket: () => void;

  beforeEach(() => {
    restoreWebSocket = installMockWebSocket();
  });

  afterEach(() => {
    restoreWebSocket();
    vi.restoreAllMocks();
  });

  it("stays idle and opens no socket when url is null", () => {
    const { result } = renderHook(() => useGatewayConnection(null));
    expect(result.current.state.connectionStatus).toBe("idle");
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("moves to connecting then connected as the socket opens", () => {
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    expect(result.current.state.connectionStatus).toBe("connecting");

    act(() => MockWebSocket.instances[0].triggerOpen());
    expect(result.current.state.connectionStatus).toBe("connected");
  });

  it("dispatches disconnected/error status on close/error", () => {
    const { result, rerender } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => MockWebSocket.instances[0].triggerClose());
    expect(result.current.state.connectionStatus).toBe("disconnected");

    rerender();
    act(() => MockWebSocket.instances[0].triggerError());
    expect(result.current.state.connectionStatus).toBe("error");
  });

  it("parses incoming envelopes into game state", () => {
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    const gameView = { turn: 3 };
    act(() => MockWebSocket.instances[0].triggerMessage({ type: "GAME_UPDATE", objectId: null, data: gameView }));
    expect(result.current.state.game).toEqual(gameView);
  });

  it("logs and survives a malformed frame without crashing", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => MockWebSocket.instances[0].triggerRawMessage("not json"));
    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.state.game).toBeNull();
  });

  it("sends JSON-encoded calls once the socket is open", () => {
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => MockWebSocket.instances[0].triggerOpen());
    act(() => result.current.send("send_uuid", ["card-1"]));
    expect(MockWebSocket.instances[0].sent).toEqual([JSON.stringify({ call: "send_uuid", args: ["card-1"] })]);
  });

  it("warns and drops the call instead of throwing when the socket isn't open", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => result.current.send("send_uuid", ["card-1"]));
    expect(warnSpy).toHaveBeenCalled();
    expect(MockWebSocket.instances[0].sent).toEqual([]);
  });

  it("auto-answers a plain priority window with nothing playable, instead of surfacing it as a dialog", () => {
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => MockWebSocket.instances[0].triggerOpen());
    act(() =>
      MockWebSocket.instances[0].triggerMessage({
        type: "GAME_SELECT",
        objectId: null,
        data: { gameView: { canPlayObjects: { objects: {} } }, message: "Play spells and abilities", options: {} },
      }),
    );

    expect(MockWebSocket.instances[0].sent).toEqual([JSON.stringify({ call: "send_boolean", args: [false] })]);
    expect(result.current.state.pendingDialog).toBeNull();
  });

  it("still surfaces a plain priority window as a dialog when something is actually playable", () => {
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => MockWebSocket.instances[0].triggerOpen());
    act(() =>
      MockWebSocket.instances[0].triggerMessage({
        type: "GAME_SELECT",
        objectId: null,
        data: {
          gameView: { canPlayObjects: { objects: { "card-1": {} } } },
          message: "Play spells and abilities",
          options: {},
        },
      }),
    );

    expect(MockWebSocket.instances[0].sent).toEqual([]);
    expect(result.current.state.pendingDialog?.type).toBe("GAME_SELECT");
  });

  it("closes the socket on unmount", () => {
    const { unmount } = renderHook(() => useGatewayConnection("ws://test"));
    const socket = MockWebSocket.instances[0];
    unmount();
    expect(socket.closed).toBe(true);
  });

  it("closes the old socket and opens a new one when the url changes", () => {
    const { rerender } = renderHook(({ url }) => useGatewayConnection(url), {
      initialProps: { url: "ws://first" },
    });
    const first = MockWebSocket.instances[0];

    rerender({ url: "ws://second" });
    expect(first.closed).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].url).toBe("ws://second");
  });
});
