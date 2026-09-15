import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGatewayConnection } from "./useGatewayConnection";

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  closed = false;

  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = MockWebSocket.CLOSED;
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  triggerRawMessage(data: string) {
    this.onmessage?.({ data });
  }

  triggerClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  triggerError() {
    this.onerror?.();
  }
}

describe("useGatewayConnection", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-expect-error - test double, not a full WebSocket implementation
    globalThis.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
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
    act(() => result.current.send("play_card", ["card-1"]));
    expect(MockWebSocket.instances[0].sent).toEqual([JSON.stringify({ call: "play_card", args: ["card-1"] })]);
  });

  it("warns and drops the call instead of throwing when the socket isn't open", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useGatewayConnection("ws://test"));
    act(() => result.current.send("play_card", ["card-1"]));
    expect(warnSpy).toHaveBeenCalled();
    expect(MockWebSocket.instances[0].sent).toEqual([]);
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
