import { useState, type FormEvent } from "react";

interface AccountModalProps {
  onClose: () => void;
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string) => void;
  error: string | null;
}

/** Real accounts (name + password + settings, server-persisted) - opt-in, not
 * required to play. No "forgot password" flow - this is a small practice tool, not
 * something worth wiring email/reset infrastructure for. */
export function AccountModal({ onClose, onLogin, onRegister, error }: AccountModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "login") onLogin(username, password);
    else onRegister(username, password);
  };

  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === "login" ? "Log In" : "Create Account"}</h2>
        <form onSubmit={handleSubmit}>
          <label className="deck-entry-field">
            Username
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={14} autoFocus />
          </label>
          <label className="deck-entry-field">
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {error && <div className="deck-entry-error">{error}</div>}

          <div className="account-modal-actions">
            <button type="submit" disabled={!username.trim() || !password}>
              {mode === "login" ? "Log In" : "Create Account"}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>

        <button
          type="button"
          className="account-modal-switch"
          onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
        >
          {mode === "login" ? "Need an account? Create one" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
