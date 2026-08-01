import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import { IntensityMeter, useNavigate, useSearchParams } from "../../ui/index.js";
import {
  createPressGestureState,
  createPressureSupport,
  observePressureReading,
  readReliablePointerPressure,
  readReliableTouchForce,
  resetPressGestureState,
  resetPressureSupportGesture,
} from "../../utils/pressure.js";
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
  const padRef = useRef(null);
  const activeRef = useRef(false);
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const intensityRef = useRef(1);
  const peakIntensityRef = useRef(1);
  const pressureDrivenRef = useRef(false);
  const gestureRef = useRef(createPressGestureState());
  const supportRef = useRef(createPressureSupport());
  const [pressureSupported, setPressureSupported] = useState(() => supportRef.current.confirmed);

  function updateIntensity(value) {
    const next = Math.max(1, Math.min(10, Math.ceil(value)));
    intensityRef.current = next;
    if (activeRef.current) peakIntensityRef.current = Math.max(peakIntensityRef.current, next);
    setIntensity(next);
  }

  // Intensity comes from the pressure sensor only once the device is
  // confirmed to have a real one; until then the hold-duration ramp stays
  // in control.
  function applyPressureValue(value) {
    if (value === null) return;
    if (!observePressureReading(supportRef.current, value)) return;
    setPressureSupported(true);
    pressureDrivenRef.current = true;
    const gesture = gestureRef.current;
    gesture.peak = Math.max(gesture.peak, value);
    updateIntensity(gesture.peak * 10);
  }

  function applyTouchForce(rawForce) {
    applyPressureValue(readReliableTouchForce(rawForce, gestureRef.current.touchForce));
  }

  function applyPointerPressure(rawPressure) {
    applyPressureValue(readReliablePointerPressure(rawPressure, gestureRef.current.pointerPressure));
  }

  function beginPress() {
    if (activeRef.current || saving) return;
    if (!name.trim()) {
      setMessage(t("record.nameRequired"));
      return;
    }
    activeRef.current = true;
    pressureDrivenRef.current = false;
    resetPressGestureState(gestureRef.current);
    resetPressureSupportGesture(supportRef.current);
    peakIntensityRef.current = 1;
    startRef.current = performance.now();
    updateIntensity(1);
    setPressed(true);
    setMessage("");
    timerRef.current = window.setInterval(() => {
      if (pressureDrivenRef.current) return;
      const elapsed = performance.now() - startRef.current;
      updateIntensity(1 + Math.floor(elapsed / 400));
    }, 60);
  }

  async function finishPress() {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearInterval(timerRef.current);
    setPressed(false);
    setSaving(true);
    try {
      await api.createKnot({
        name: name.trim().normalize("NFKC"),
        intensity: peakIntensityRef.current,
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
    setPressed(false);
    updateIntensity(1);
  }

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return undefined;
    const onForceChange = (event) => {
      if (!activeRef.current) return;
      event.preventDefault();
      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      applyTouchForce(touch?.force);
    };
    pad.addEventListener("touchforcechange", onForceChange, { passive: false });
    return () => {
      pad.removeEventListener("touchforcechange", onForceChange);
      window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="page-shell record-page">
      <Header back />
      <main className="record-main">
        <IntensityMeter value={intensity} />
        <div
          ref={padRef}
          className={`pressure-pad${pressed ? " pressed" : ""}${saving ? " saving" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={t("record.padAria")}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") event.currentTarget.setPointerCapture?.(event.pointerId);
            beginPress();
            if (event.pointerType === "pen" || event.pointerType === "touch") applyPointerPressure(event.pressure);
          }}
          onPointerMove={(event) => {
            if (!activeRef.current) return;
            if (event.pointerType === "pen" || event.pointerType === "touch") applyPointerPressure(event.pressure);
          }}
          onPointerUp={finishPress}
          onPointerCancel={cancelPress}
          onTouchStart={(event) => {
            beginPress();
            applyTouchForce(event.touches?.[0]?.force);
          }}
          onTouchMove={(event) => {
            if (typeof window.PointerEvent === "undefined") applyTouchForce(event.touches?.[0]?.force);
          }}
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
            placeholder={t("record.namePlaceholder")}
            maxLength={48}
          />
          <span>{pressed ? t("record.keepHolding") : saving ? t("record.saving") : t("record.holdToRecord")}</span>
        </div>
        <p className="record-message" aria-live="polite">
          {message || t(pressureSupported ? "record.hintPressure" : "record.hintDuration")}
        </p>
      </main>
    </div>
  );
}
