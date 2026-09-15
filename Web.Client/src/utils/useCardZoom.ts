import { useEffect, useState } from "react";
import type { CardView } from "../types/gameView";

/**
 * Shared "hold Z to zoom in on whatever card the mouse is over" state - lives at the
 * App level (not inside Board, where it used to be) so it also works for cards
 * rendered outside Board entirely, e.g. a GAME_TARGET/GAME_PLAY_MANA dialog's target
 * list (DialogPrompt is a sibling of Board, not a child - Board's own local hover
 * state had no way to see those cards at all, which is exactly why zoom silently did
 * nothing over them).
 */
export function useCardZoom() {
  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null);
  const [zoomKeyHeld, setZoomKeyHeld] = useState(false);
  // Zoom tracks the held key, not a toggle - it's only up while Z is actually held
  // down (and follows whatever card the mouse is over meanwhile), and disappears the
  // instant it's released.
  const zoomedCard = zoomKeyHeld ? hoveredCard : null;

  useEffect(() => {
    const isTypingTarget = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      return !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (e.key === "z" || e.key === "Z") {
        setZoomKeyHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "z" || e.key === "Z") {
        setZoomKeyHeld(false);
      }
    };
    // If focus/the window itself is lost while Z is held (alt-tab, etc.), the keyup
    // never fires - drop the zoom rather than leave it stuck open.
    const onBlur = () => setZoomKeyHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return { hoveredCard, setHoveredCard, zoomedCard };
}
