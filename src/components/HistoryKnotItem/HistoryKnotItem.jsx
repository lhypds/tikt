import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IntensityMeter } from "../../ui/index.js";

const DELETE_WIDTH = 84;
const DELETE_GUTTER = 12;
const REVEAL_WIDTH = DELETE_WIDTH + DELETE_GUTTER;

export default function HistoryKnotItem({ knot, formattedTime, onDelete }) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const offsetRef = useRef(0);
  const dragRef = useRef(null);

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
  }

  function moveSwipe(event) {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.abs(deltaX) < 6) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      drag.dragging = true;
    }
    moveTo(drag.startOffset + deltaX);
  }

  function finishSwipe() {
    const drag = dragRef.current;
    if (!drag?.active) return;
    drag.active = false;
    moveTo(offsetRef.current <= -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(knot.id);
    } catch {
      setDeleting(false);
      moveTo(-REVEAL_WIDTH);
    }
  }

  return (
    <li className="history-knot-item">
      <button
        className="history-delete"
        type="button"
        disabled={deleting}
        style={{ opacity: offset === 0 ? 0 : 1 }}
        onFocus={() => moveTo(-REVEAL_WIDTH)}
        onClick={handleDelete}
        aria-label={`${t("history.delete")} ${knot.name}`}
      >
        {deleting ? t("history.deleting") : t("history.delete")}
      </button>
      <div
        className="history-knot-row"
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        <div className="knot-copy">
          <strong>{knot.name}</strong>
          <time dateTime={knot.time}>{formattedTime}</time>
        </div>
        <IntensityMeter value={knot.intensity} compact />
      </div>
    </li>
  );
}
