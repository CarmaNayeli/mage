import { useEffect, useState } from "react";
import "./App.css";
import logo from "./assets/xeffigy-logo.png";
import { Board } from "./components/Board";
import { DialogPrompt } from "./components/DialogPrompt";
import { GameOverBanner } from "./components/GameOverBanner";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { DeckEntry, type JoinRequest } from "./preGame/DeckEntry";
import type { CardView } from "./types/gameView";
import { getCombatSelection } from "./utils/combat";
import { useGatewayConnection } from "./ws/useGatewayConnection";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:8080";

function App() {
  const [connect, setConnect] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<JoinRequest | null>(null);
  const { state, send, reset, answerDialog } = useGatewayConnection(connect ? GATEWAY_URL : null);

  // The socket only actually opens after useGatewayConnection's own effect runs,
  // so a join sent synchronously from handleDeckSubmit would race an unopened
  // socket and get silently dropped - wait for "connected" instead.
  useEffect(() => {
    if (pendingJoin && state.connectionStatus === "connected") {
      send("join_practice_table", [pendingJoin]);
      setPendingJoin(null);
    }
  }, [pendingJoin, state.connectionStatus, send]);

  const connectionFailed = (state.connectionStatus === "error" || state.connectionStatus === "disconnected") && !state.game;

  // Drop the dead socket once a connection attempt fails, so the next "Start game"
  // click (same url) actually triggers useGatewayConnection's effect to reconnect
  // instead of being a no-op because `connect` was already true.
  useEffect(() => {
    if (connectionFailed) {
      setConnect(false);
    }
  }, [connectionFailed]);

  const handleDeckSubmit = (request: JoinRequest) => {
    setPendingJoin(request);
    setConnect(true);
  };

  const handleDialogRespond = (call: "send_uuid" | "send_boolean" | "send_integer" | "send_string" | "send_mana_type", args: unknown[]) => {
    send(call, args);
    answerDialog();
  };

  const handlePlayCard = (card: CardView) => {
    // Confirmed against a real local game: the card's own id is what actually plays
    // it (verified: a Mountain landed on the battlefield). An earlier attempt to
    // resolve a separate "ability id" out of canPlayObjects was a wrong guess that
    // silently did nothing - canPlayObjects is still useful for knowing what's
    // playable, just not for this.
    send("send_uuid", [card.id]);
  };

  const handlePlayAgain = () => {
    setConnect(false);
    reset();
  };

  // Concede is the one action that's always meaningful regardless of screen - a
  // dedicated "Restart" WS call would just be a concede followed by the client
  // dropping its own connection, so there's no separate server-side "restart".
  const handleRestart = () => {
    if (connect) {
      send("concede", []);
    }
    setConnect(false);
    reset();
  };

  const joining = connect && !state.game && !connectionFailed;

  // Every card that's currently legal to click: whatever the server says is playable
  // right now, plus (if a declare-attackers/blockers prompt is up) the human's own
  // permanents that are legal to toggle - both answered the same way, send_uuid.
  const combatSelection = getCombatSelection(state.pendingDialog);
  const playableIds = new Set([...Object.keys(state.game?.canPlayObjects?.objects ?? {}), ...(combatSelection?.ids ?? [])]);

  return (
    <div className="app">
      <header className="app-header">
        <img src={logo} alt="XEffigy" className="app-logo" />
        <span className="app-subtitle">Practice Magic: The Gathering against an LLM bot</span>
        {connect && <span className={`connection-status ${state.connectionStatus}`}>{state.connectionStatus}</span>}
        <HamburgerMenu
          items={[{ label: "Restart", onClick: handleRestart, disabled: !connect }]}
        />
      </header>

      {!state.game ? (
        <>
          <p className="app-intro">
            XEffigy is a free place to practice Magic: The Gathering against an AI opponent. It's built on{" "}
            <strong>XMage</strong>, the open-source Magic engine that runs the actual rules and game state, with{" "}
            <strong>Claude</strong> (Anthropic's AI) making every decision for the bot you're playing against - so
            it can bluff, block, and sequence its turns like a real, if occasionally weird, opponent.
          </p>
          <DeckEntry
            onSubmit={handleDeckSubmit}
            disabled={joining}
            error={connectionFailed ? "Couldn't reach the server - check the gateway is running and try again." : state.lastError}
            progress={joining ? state.joinProgress : null}
          />
        </>
      ) : (
        <Board game={state.game} onPlayCard={handlePlayCard} playableIds={playableIds} />
      )}

      {state.gameOver && <GameOverBanner message={state.gameOver} onPlayAgain={handlePlayAgain} />}

      {state.pendingDialog && (
        <DialogPrompt
          type={state.pendingDialog.type}
          payload={state.pendingDialog.payload}
          game={state.game}
          onRespond={handleDialogRespond}
        />
      )}

      {state.messages.length > 0 && (
        <div className="message-log">
          {state.messages.slice(-10).map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
