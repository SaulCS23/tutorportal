import type { KeyboardEvent, MouseEvent } from "react";

/**
 * Props to spread onto a non-semantic element (div/li/article) so it
 * behaves like a button for pointer + keyboard users, without wrapping it
 * in a real <button>/<a> — which would be invalid HTML once the card also
 * contains its own nested interactive controls (Join Meeting links, Edit
 * buttons, menus, etc). A plain function rather than a hook: safe to call
 * once per row inside a .map(), where a hook would violate the rules of
 * hooks.
 *
 * Nested interactive elements inside the card must call stopCardClick in
 * their own onClick so their action doesn't also trigger onActivate.
 */
export function clickableCardProps(onActivate: () => void, ariaLabel: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": ariaLabel,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/** Stops a nested interactive element's click from bubbling up to an
 *  ancestor made clickable via clickableCardProps. */
export function stopCardClick(e: MouseEvent) {
  e.stopPropagation();
}

/** Shared hover/focus affordance for elements using clickableCardProps. */
export const CLICKABLE_CARD_CLASSES =
  "cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";
