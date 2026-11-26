import React, { useEffect, useId, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "./Button";

export interface OverflowItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** The "⋯" menu (spec 4.5): a labelled 44 px button, arrow keys inside, Escape closes. */
export const OverflowMenu: React.FC<{ label: string; items: OverflowItem[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (items.length === 0) return null;

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div
      className="relative shrink-0"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        icon={Ellipsis}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={move}
          className="absolute right-0 z-20 mt-1 min-w-[240px] rounded-card border border-border bg-bg-secondary py-1 shadow-dropdown"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                // Focus back on "⋯" first: a dialog opened by the item returns focus here when it closes.
                buttonRef.current?.focus();
                item.onSelect();
              }}
              className={`flex min-h-[44px] w-full items-center px-4 text-left text-body hover:bg-bg-surface focus:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                item.danger ? "text-error" : "text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
