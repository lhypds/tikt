import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const DELETE_WIDTH = 84;
const DELETE_GUTTER = 12;
const REVEAL_WIDTH = DELETE_WIDTH + DELETE_GUTTER;
const LONG_PRESS_MS = 500;

export default function KnotItem({ knot, formattedTime, deleting = false, onDelete, onEdit }) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const dragRef = useRef(null);
  const pressTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(pressTimerRef.current), []);

  function moveTo(nextOffset) {
    const next = Math.max(-REVEAL_WIDTH, Math.min(0, nextOffset));
    offsetRef.current = next;
    setOffset(next);
  }

  function startSwipe(event) {
    if (event.button !== 0) return;
    dragRef.current = {
      active: true,
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetRef.current,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      const drag = dragRef.current;
      if (!drag?.active || drag.dragging) return;
      drag.active = false;
      moveTo(0);
      if (navigator.vibrate) navigator.vibrate(10);
      onEdit(knot);
    }, LONG_PRESS_MS);
  }

  function moveSwipe(event) {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.abs(deltaX) >= 6 || Math.abs(deltaY) >= 6) window.clearTimeout(pressTimerRef.current);
      if (Math.abs(deltaX) < 6) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      drag.dragging = true;
    }
    moveTo(drag.startOffset + deltaX);
  }

  function finishSwipe() {
    window.clearTimeout(pressTimerRef.current);
    const drag = dragRef.current;
    if (!drag?.active) return;
    drag.active = false;
    moveTo(offsetRef.current <= -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0);
  }

  return (
    <li className="history-knot-item">
      <button
        className="history-delete"
        type="button"
        disabled={deleting}
        style={{ opacity: offset === 0 ? 0 : 1 }}
        onFocus={() => moveTo(-REVEAL_WIDTH)}
        onClick={() => onDelete(knot)}
        aria-label={`${t("knots.delete")} ${knot.name}`}
      >
        {deleting ? t("knots.deleting") : t("knots.delete")}
      </button>
      <div
        className="history-knot-row knot-name-row"
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="knot-copy">
          <strong>{knot.name}</strong>
          {knot.lastUsed ? (
            <time dateTime={knot.lastUsed}>{formattedTime}</time>
          ) : (
            <span className="knot-time-empty" aria-hidden="true">&nbsp;</span>
          )}
        </div>
        <small className="knot-count">{knot.count}</small>
      </div>
    </li>
  );
}
