import { Children, cloneElement } from "react";
import styles from "./action.module.css";

const EDGE_GAP = 6;

// The tooltip is centered under the button; shift it sideways when that would
// push it past the edge of the page.
function keepTooltipInPage(button) {
  const tipWidth = parseFloat(getComputedStyle(button, "::after").width);
  if (!tipWidth) return;
  const rect = button.getBoundingClientRect();
  const pageWidth = document.documentElement.clientWidth;
  const left = rect.left + rect.width / 2 - tipWidth / 2;
  const maxLeft = pageWidth - EDGE_GAP - tipWidth;
  const clamped = Math.max(EDGE_GAP, Math.min(left, maxLeft));
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
