import { useEffect, useState } from "react";
import "./App.css";
import logo from "./assets/xeffigy-logo.png";
import { Board } from "./components/Board";
import { DialogPrompt } from "./components/DialogPrompt";
import { GameOverBanner } from "./components/GameOverBanner";
import { DeckEntry } from "./preGame/DeckEntry";
import type { CardView } from "./types/gameView";
import { useGatewayConnection } from "./ws/useGatewayConnection";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:8080";

interface PendingJoin {
  playerName: string;
  decklistText: string;
}

function App() {
  const [connect, setConnect] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null);
  const { state, send, reset } = useGatewayConnection(connect ? GATEWAY_URL : null);

  // The socket only actually opens after useGatewayConnection's own effect runs,
  // so a join sent synchronously from handleDeckSubmit would race an unopened
  // socket and get silently dropped - wait for "connected" instead.
  useEffect(() => {
    if (pendingJoin && state.connectionStatus === "connected") {
      send("join_practice_table", [pendingJoin.playerName, pendingJoin.decklistText]);
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

  const handleDeckSubmit = (decklistText: string, playerName: string) => {
    setPendingJoin({ playerName, decklistText });
    setConnect(true);
  };

  const handleDialogChoice = (index: number) => {
    send("answer_dialog", [index]);
  };

  const handlePlayCard = (card: CardView) => {
    send("play_card", [card.id]);
  };

  const handlePlayAgain = () => {
    setConnect(false);
    reset();
  };

  const joining = connect && !state.game && !connectionFailed;

  return (
    <div className="app">
      <header className="app-header">
        <img src={logo} alt="XEffigy" className="app-logo" />
        <span className="app-subtitle">Practice Magic: The Gathering against an LLM bot</span>
        {connect && <span className={`connection-status ${state.connectionStatus}`}>{state.connectionStatus}</span>}
      </header>

      {!state.game ? (
        <DeckEntry
          onSubmit={handleDeckSubmit}
          disabled={joining}
          error={connectionFailed ? "Couldn't reach the server - check the gateway is running and try again." : state.lastError}
        />
      ) : (
        <Board game={state.game} onPlayCard={handlePlayCard} />
      )}

      {state.gameOver && <GameOverBanner message={state.gameOver} onPlayAgain={handlePlayAgain} />}

      {state.pendingDialog && (
        <DialogPrompt
          type={state.pendingDialog.type}
          payload={state.pendingDialog.payload}
          onChoose={handleDialogChoice}
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
