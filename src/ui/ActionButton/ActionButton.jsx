import { Children, cloneElement } from "react";
import styles from "./action.module.css";

const FALLBACK_GAP = 16;

// Inner left/right edges of the nearest padded container (e.g. the topbar), so
// a tooltip keeps the same distance from the page edge as the buttons do.
function contentBounds(button) {
  const pageWidth = document.documentElement.clientWidth;
  let left = null;
  let right = null;
  for (let node = button.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const padLeft = parseFloat(style.paddingLeft);
    const padRight = parseFloat(style.paddingRight);
    if (left === null && padLeft > 0) left = rect.left + padLeft;
    if (right === null && padRight > 0) right = rect.right - padRight;
    if (left !== null && right !== null) break;
  }
  return {
    left: Math.max(left ?? FALLBACK_GAP, 0),
    right: Math.min(right ?? pageWidth - FALLBACK_GAP, pageWidth),
  };
}

// The tooltip is centered under the button; shift it sideways when that would
// push it past the edge of the page content.
function keepTooltipInPage(button) {
  const tipWidth = parseFloat(getComputedStyle(button, "::after").width);
  if (!tipWidth) return;
  const rect = button.getBoundingClientRect();
  const bounds = contentBounds(button);
  const left = rect.left + rect.width / 2 - tipWidth / 2;
  const clamped = Math.max(bounds.left, Math.min(left, bounds.right - tipWidth));
  button.style.setProperty("--tooltip-shift", `${Math.round(clamped - left)}px`);
}

export default function ActionButton({
  tooltip,
  children,
  type = "button",
  onPointerEnter,
  ...props
}) {
  const icon = Children.only(children);
  return (
    <button
      {...props}
      type={type}
      className={styles.actionButton}
      data-tooltip={tooltip}
      aria-label={props["aria-label"] || tooltip}
      onPointerEnter={(event) => {
        if (tooltip) keepTooltipInPage(event.currentTarget);
        onPointerEnter?.(event);
      }}
    >
      {cloneElement(icon, { className: styles.icon })}
    </button>
  );
}
