interface ManaPoolProps {
  pool: Record<string, number>;
}

export function ManaPool({ pool }: ManaPoolProps) {
  const entries = Object.entries(pool).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return null;
  }

  return (
    <span className="mana-pool">
      {entries.map(([color, count]) => (
        <span key={color} className="mana-pip">
          {count}
          {color[0]?.toUpperCase()}
        </span>
      ))}
    </span>
  );
}
