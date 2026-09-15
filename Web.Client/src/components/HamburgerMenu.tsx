import { useEffect, useRef, useState } from "react";

export interface HamburgerMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** A nested list shown indented below this item when it's clicked (e.g. "Load
   * Deck" expanding into each saved deck) - the item itself doesn't close the menu or
   * fire onClick when it has one; only picking a submenu entry does. */
  submenu?: HamburgerMenuItem[];
}

interface HamburgerMenuProps {
  items: HamburgerMenuItem[];
}

export function HamburgerMenu({ items }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(null);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setExpanded(null);
      }
    };
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="hamburger-menu" ref={ref}>
      <button
        className="hamburger-button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setExpanded(null);
        }}
      >
        ☰
      </button>
      {open && (
        <div className="hamburger-dropdown">
          {items.map((item) =>
            item.submenu ? (
              <div className="hamburger-submenu" key={item.label}>
                <button
                  disabled={item.disabled}
                  aria-expanded={expanded === item.label}
                  onClick={() => setExpanded((e) => (e === item.label ? null : item.label))}
                >
                  {item.label} {expanded === item.label ? "▾" : "▸"}
                </button>
                {expanded === item.label && (
                  <div className="hamburger-submenu-items">
                    {item.submenu.length === 0 ? (
                      <span className="hamburger-submenu-empty">Nothing saved yet</span>
                    ) : (
                      item.submenu.map((sub) => (
                        <button
                          key={sub.label}
                          disabled={sub.disabled}
                          onClick={() => {
                            setOpen(false);
                            sub.onClick?.();
                          }}
                        >
                          {sub.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
