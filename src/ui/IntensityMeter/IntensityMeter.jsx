import { useRef } from "react";
import { useTranslation } from "react-i18next";

export default function IntensityMeter({ value, compact = false, onSelect }) {
  const { t } = useTranslation();
  const meterRef = useRef(null);
  const dragLevelRef = useRef(null);

  if (compact) {
    return (
      <div className="history-meter" aria-label={t("meter.aria", { value })}>
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={index < value ? "active" : ""} />
        ))}
      </div>
    );
  }

  function levelAt(clientX) {
    const meter = meterRef.current;
    if (!meter) return null;
    const rect = meter.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(1, Math.min(10, Math.ceil(ratio * 10)));
  }

  function selectAt(clientX) {
    const level = levelAt(clientX);
    if (level === null || level === dragLevelRef.current) return;
    dragLevelRef.current = level;
    onSelect(level);
  }

  // Pointer events drive mouse/touch selection (press then slide across the
  // boxes); button onClick stays for keyboard activation only (detail === 0).
  const dragProps = onSelect
    ? {
        onPointerDown: (event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          dragLevelRef.current = null;
          selectAt(event.clientX);
        },
        onPointerMove: (event) => {
          if (!event.buttons) return;
          event.stopPropagation();
          selectAt(event.clientX);
        },
        onPointerUp: () => {
          dragLevelRef.current = null;
        },
        onPointerCancel: () => {
          dragLevelRef.current = null;
        },
        onTouchStart: (event) => event.stopPropagation(),
        onTouchMove: (event) => event.stopPropagation(),
      }
    : {};

  return (
    <div className="meter-wrap" aria-label={t("meter.ariaOutOfTen", { value })}>
      <div className="meter-label">
        <span>{t("meter.intensity")}</span>
        <span>{value}/10</span>
      </div>
      <div
        ref={meterRef}
        className={`meter${onSelect ? " selectable" : ""}`}
        aria-hidden={onSelect ? undefined : "true"}
        {...dragProps}
      >
        {Array.from({ length: 10 }, (_, index) =>
          onSelect ? (
            <button
              key={index}
              type="button"
              className={index < value ? "active" : ""}
              aria-label={t("meter.selectLevel", { level: index + 1 })}
              onClick={(event) => {
                if (event.detail === 0) onSelect(index + 1);
              }}
            />
          ) : (
            <span key={index} className={index < value ? "active" : ""} />
          ),
        )}
      </div>
    </div>
  );
}
