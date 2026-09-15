import { useEffect, useRef, useState, type FormEvent } from "react";
import "./App.css";
import logo from "./assets/xeffigy-logo.png";
import { Board } from "./components/Board";
import { DialogPrompt } from "./components/DialogPrompt";
import { GameOverBanner } from "./components/GameOverBanner";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { DeckEntry, type DeckEntryHandle, type JoinRequest } from "./preGame/DeckEntry";
import type { CardView } from "./types/gameView";
import { getCombatSelection } from "./utils/combat";
import { listSavedDecks, saveDeck, type SavedDeck } from "./utils/savedDecks";
import { loadTableTalk, saveTableTalk } from "./utils/settings";
import { useGatewayConnection } from "./ws/useGatewayConnection";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:8080";

function App() {
  const [connect, setConnect] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<JoinRequest | null>(null);
  const [lastJoinRequest, setLastJoinRequest] = useState<JoinRequest | null>(null);
  const [tableTalk, setTableTalk] = useState(() => loadTableTalk());
  const [chatDraft, setChatDraft] = useState("");
  // Bumped on every reconnect attempt so the url passed to useGatewayConnection always
  // changes, even when `connect` was already true (a mid-game disconnect doesn't flip
  // it back to false) - its effect is keyed on the url string, so without this a
  // reconnect click after a mid-game drop would be a no-op.
  const [connectAttempt, setConnectAttempt] = useState(0);
  const wsUrl = connect ? `${GATEWAY_URL}?attempt=${connectAttempt}` : null;
  const { state, send, reset, answerDialog } = useGatewayConnection(wsUrl);

  // The saved-decks *list* lives here (not inside DeckEntry) so the hamburger menu's
  // "Load Deck" submenu and DeckEntry's own inline "My Decks" panel always show the
  // same thing - DeckEntry still owns the actual in-progress form fields, reached via
  // this ref for "Load"/"Save" triggered from the menu instead of a click inside the
  // form itself.
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => listSavedDecks());
  const deckEntryRef = useRef<DeckEntryHandle>(null);

  const handleMenuSaveDeck = () => {
    const current = deckEntryRef.current?.getCurrentDeck();
    if (!current || !current.playerDeck.trim()) return;
    const name = window.prompt("Name this deck:")?.trim();
    if (!name) return;
    setSavedDecks(saveDeck({ name, ...current }));
  };

  const handleMenuLoadDeck = (deck: SavedDeck) => {
    deckEntryRef.current?.loadDeck(deck);
  };

  const toggleTableTalk = () => {
    setTableTalk((current) => {
      const next = !current;
      saveTableTalk(next);
      return next;
    });
  };

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
    setLastJoinRequest(request);
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

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    send("chat", [text]);
    setChatDraft("");
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

  // There's no real session-resume wired up (a fresh GatewaySession on the gateway has
  // no memory of the old game) - so "reconnect" honestly means a new connection, and
  // if we know what deck they were playing, jump straight back into a fresh table with
  // it rather than dumping them on a blank form.
  const handleReconnect = () => {
    reset();
    setConnectAttempt((n) => n + 1);
    if (lastJoinRequest) {
      setPendingJoin(lastJoinRequest);
    }
    setConnect(true);
  };

  const joining = connect && !state.game && !connectionFailed;

  // Every card that's currently legal to click: whatever the server says is playable
  // right now, plus (if a declare-attackers/blockers prompt is up) the human's own
  // permanents that are legal to toggle - both answered the same way, send_uuid.
  const combatSelection = getCombatSelection(state.pendingDialog);
  const playableIds = new Set([...Object.keys(state.game?.canPlayObjects?.objects ?? {}), ...(combatSelection?.ids ?? [])]);

  const visibleMessages = tableTalk ? state.messages : state.messages.filter((m) => !m.isTalk);

  return (
    <div className="app">
      <header className="app-header">
        <img src={logo} alt="XEffigy" className="app-logo" />
        <span className="app-subtitle">Practice Magic: The Gathering against an LLM bot</span>
        {connect &&
          (state.connectionStatus === "disconnected" || state.connectionStatus === "error" ? (
            <button className="connection-status reconnect" onClick={handleReconnect}>
              Reconnect
            </button>
          ) : (
            <span className={`connection-status ${state.connectionStatus}`}>{state.connectionStatus}</span>
          ))}
        <HamburgerMenu
          items={[
            { label: "Restart", onClick: handleRestart, disabled: !connect },
            { label: tableTalk ? "Table Talk: On" : "Table Talk: Off", onClick: toggleTableTalk },
            // Only meaningful pre-game (DeckEntry, and the ref that reaches it, only
            // exist then) - mid-game there's no deck form left to save from or load into.
            ...(!state.game
              ? [
                  { label: "Save Deck", onClick: handleMenuSaveDeck },
                  {
                    label: "Load Deck",
                    submenu: savedDecks.map((deck) => ({
                      label: `${deck.name} (${deck.format})`,
                      onClick: () => handleMenuLoadDeck(deck),
                    })),
                  },
                ]
              : []),
          ]}
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
            ref={deckEntryRef}
            onSubmit={handleDeckSubmit}
            disabled={joining}
            error={connectionFailed ? "Couldn't reach the server - check the gateway is running and try again." : state.lastError}
            progress={joining ? state.joinProgress : null}
            savedDecks={savedDecks}
            onSavedDecksChange={setSavedDecks}
          />
        </>
      ) : (
        <div className="game-layout">
          <div className="game-main">
            <Board game={state.game} onPlayCard={handlePlayCard} playableIds={playableIds} />
          </div>

          {(state.pendingDialog || visibleMessages.length > 0 || tableTalk) && (
            <div className="game-sidebar">
              {state.pendingDialog && (
                <DialogPrompt
                  type={state.pendingDialog.type}
                  payload={state.pendingDialog.payload}
                  game={state.game}
                  onRespond={handleDialogRespond}
                />
              )}

              {(visibleMessages.length > 0 || tableTalk) && (
                <div className="message-log">
                  <div className="message-log-title">Game Log</div>
                  {visibleMessages.length > 0 && (
                    <div className="message-log-entries">
                      {visibleMessages.slice(-30).map((msg, i) => (
                        <div key={i} className={`message-log-entry${msg.isTalk ? " talk" : ""}${msg.text.startsWith("⚠ ") ? " error" : ""}`}>
                          {msg.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {tableTalk && (
                    <form className="chat-input" onSubmit={handleSendChat}>
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder="Say something…"
                        maxLength={280}
                      />
                      <button type="submit" disabled={!chatDraft.trim()}>
                        Send
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {state.gameOver && <GameOverBanner message={state.gameOver} onPlayAgain={handlePlayAgain} />}
    </div>
  );
}

export default App;
