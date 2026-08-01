import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import { IntensityMeter, useNavigate, useSearchParams } from "../../ui/index.js";
import { startPressTone, stopPressTone, updatePressTone } from "../../utils/sound.js";
import Header from "../Header/index.js";

export default function RecordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(searchParams.get("name")?.slice(0, 48) || "");
  const [intensity, setIntensity] = useState(1);
  const [pressed, setPressed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const activeRef = useRef(false);
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const intensityRef = useRef(1);

  function updateIntensity(value) {
    const next = Math.max(1, Math.min(10, Math.ceil(value)));
    intensityRef.current = next;
    if (activeRef.current) updatePressTone(next);
    setIntensity(next);
  }

  function beginPress() {
    if (activeRef.current || saving) return;
    if (!name.trim()) {
      setMessage(t("record.nameRequired"));
      return;
    }
    activeRef.current = true;
    startRef.current = performance.now();
    updateIntensity(1);
    startPressTone(intensityRef.current);
    setPressed(true);
    setMessage("");
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      updateIntensity(1 + Math.floor(elapsed / 400));
    }, 60);
  }

  async function finishPress() {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearInterval(timerRef.current);
    stopPressTone();
    setPressed(false);
    setSaving(true);
    try {
      await api.createKnot({
        name: name.trim().normalize("NFKC"),
        intensity: intensityRef.current,
        time: new Date().toISOString(),
      });
      if (navigator.vibrate) navigator.vibrate(20);
      setMessage(t("record.saved"));
      window.setTimeout(() => navigate("/", { replace: true }), 550);
    } catch (requestError) {
      setMessage(requestError.message);
      setSaving(false);
    }
  }

  function cancelPress() {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearInterval(timerRef.current);
    stopPressTone();
    setPressed(false);
    updateIntensity(1);
  }

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      stopPressTone();
    };
  }, []);

  return (
    <div className="page-shell record-page">
      <Header back />
      <main className="record-main">
        <IntensityMeter value={intensity} />
        <div
          className={`press-pad${pressed ? " pressed" : ""}${saving ? " saving" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={t("record.padAria")}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") event.currentTarget.setPointerCapture?.(event.pointerId);
            beginPress();
          }}
          onPointerUp={finishPress}
          onPointerCancel={cancelPress}
          onTouchStart={beginPress}
          onTouchEnd={finishPress}
          onTouchCancel={cancelPress}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !activeRef.current) {
              event.preventDefault();
              beginPress();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") finishPress();
          }}
        >
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setMessage("");
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={t("record.namePlaceholder")}
            maxLength={48}
          />
          <span>{pressed ? t("record.keepHolding") : saving ? t("record.saving") : t("record.holdToRecord")}</span>
        </div>
        <p className="record-message" aria-live="polite">
          {message || t("record.hintDuration")}
        </p>
      </main>
    </div>
  );
}
