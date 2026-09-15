interface GameOverBannerProps {
  message: string;
  onPlayAgain: () => void;
}

export function GameOverBanner({ message, onPlayAgain }: GameOverBannerProps) {
  return (
    <div className="game-over-banner">
      <div className="game-over-message">{message}</div>
      <button onClick={onPlayAgain}>Play again</button>
    </div>
  );
}
