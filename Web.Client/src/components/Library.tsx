interface LibraryProps {
  count: number;
}

/** The face-down draw pile - there's nothing to show but a count (the cards themselves
 * are hidden information, same as an opponent's hand), but a library existing at all
 * wasn't visually represented anywhere before this, which read as "missing" rather
 * than "empty." */
export function Library({ count }: LibraryProps) {
  return (
    <div className="library">
      <span className="zone-label">Library ({count})</span>
      <div className="library-pile" title={`${count} card${count === 1 ? "" : "s"} left in library`}>
        <span className="library-count">{count}</span>
      </div>
    </div>
  );
}
