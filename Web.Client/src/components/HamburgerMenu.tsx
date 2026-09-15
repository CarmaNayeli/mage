import { useEffect, useRef, useState } from "react";

export interface HamburgerMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface HamburgerMenuProps {
  items: HamburgerMenuItem[];
}

export function HamburgerMenu({ items }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
      <button className="hamburger-button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ☰
      </button>
      {open && (
        <div className="hamburger-dropdown">
          {items.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
