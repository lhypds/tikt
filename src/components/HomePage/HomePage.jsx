import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import { IntensityMeter } from "../../ui/index.js";
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

export default function HomePage() {
  const { t } = useTranslation();
  const [names, setNames] = useState([]);
  const [intensity, setIntensity] = useState(1);
  const [pressedName, setPressedName] = useState("");
  const [savingName, setSavingName] = useState("");
  const [message, setMessage] = useState("");
  const activeRef = useRef(false);
  const activeNameRef = useRef("");
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const messageTimerRef = useRef(null);
  const intensityRef = useRef(1);
  const peakIntensityRef = useRef(1);
  const pressureDrivenRef = useRef(false);
  const gestureRef = useRef(createPressGestureState());
  const supportRef = useRef(createPressureSupport());
  const [pressureSupported, setPressureSupported] = useState(() => supportRef.current.confirmed);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api
        .getKnotNames()
        .then((data) => !cancelled && setNames(data.names))
        .catch(() => {});
    }
    load();
    window.addEventListener("tikt:knots-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("tikt:knots-changed", load);
    };
  }, []);

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

  function beginRecord(rawName) {
    const recordName = rawName.trim().normalize("NFKC");
    if (!recordName) {
      setMessage(t("record.nameRequired"));
      return;
    }
    if (activeRef.current || savingName) return;

    window.clearTimeout(messageTimerRef.current);
    activeRef.current = true;
    activeNameRef.current = recordName;
    pressureDrivenRef.current = false;
    resetPressGestureState(gestureRef.current);
    resetPressureSupportGesture(supportRef.current);
    peakIntensityRef.current = 1;
    startRef.current = performance.now();
    updateIntensity(1);
    setPressedName(recordName);
    setMessage("");
    timerRef.current = window.setInterval(() => {
      if (pressureDrivenRef.current) return;
      updateIntensity(1 + Math.floor((performance.now() - startRef.current) / 400));
    }, 60);
  }

  async function finishRecord() {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearInterval(timerRef.current);
    const recordName = activeNameRef.current;
    const recordedIntensity = peakIntensityRef.current;
    setPressedName("");
    setSavingName(recordName);

    try {
      const { knot } = await api.createKnot({
        name: recordName,
        intensity: recordedIntensity,
        time: new Date().toISOString(),
      });
      setNames((current) => {
        const existing = current.find((item) => item.name === recordName);
        return [
          { name: recordName, count: (existing?.count || 0) + 1, lastUsed: knot.time },
          ...current.filter((item) => item.name !== recordName),
        ].slice(0, 8);
      });
      if (navigator.vibrate) navigator.vibrate(20);
      setMessage(t("record.saved"));
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setSavingName("");
      messageTimerRef.current = window.setTimeout(() => {
        setMessage("");
        updateIntensity(1);
      }, 900);
    }
  }

  function cancelRecord() {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearInterval(timerRef.current);
    setPressedName("");
    updateIntensity(1);
  }

  useEffect(() => {
    const onForceChange = (event) => {
      if (!activeRef.current) return;
      event.preventDefault();
      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      applyTouchForce(touch?.force);
    };
    window.addEventListener("touchforcechange", onForceChange, { passive: false });
    return () => {
      window.removeEventListener("touchforcechange", onForceChange);
      window.clearInterval(timerRef.current);
      window.clearTimeout(messageTimerRef.current);
    };
  }, []);

  function pointInside(clientX, clientY, target) {
    const rect = target.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function releaseRecord(clientX, clientY, target) {
    if (!activeRef.current) return;
    if (pointInside(clientX, clientY, target)) finishRecord();
    else cancelRecord();
  }

  function pressureProps(recordName) {
    return {
      onContextMenu: (event) => event.preventDefault(),
      onPointerDown: (event) => {
        beginRecord(recordName);
        if (event.pointerType === "pen" || event.pointerType === "touch") applyPointerPressure(event.pressure);
      },
      onPointerMove: (event) => {
        if (!activeRef.current) return;
        if (event.pointerType === "pen" || event.pointerType === "touch") applyPointerPressure(event.pressure);
      },
      onPointerUp: (event) => {
        if (event.pointerType !== "touch") finishRecord();
      },
      onPointerLeave: (event) => {
        if (event.pointerType !== "touch") cancelRecord();
      },
      onPointerCancel: cancelRecord,
      onTouchStart: (event) => {
        beginRecord(recordName);
        applyTouchForce(event.touches?.[0]?.force);
      },
      onTouchMove: (event) => {
        const touch = event.touches?.[0];
        if (touch && !pointInside(touch.clientX, touch.clientY, event.currentTarget)) return cancelRecord();
        if (typeof window.PointerEvent === "undefined") applyTouchForce(touch?.force);
      },
      onTouchEnd: (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return finishRecord();
        releaseRecord(touch.clientX, touch.clientY, event.currentTarget);
      },
      onTouchCancel: cancelRecord,
      onKeyDown: (event) => {
        if ((event.key === " " || event.key === "Enter") && !activeRef.current) {
          event.preventDefault();
          beginRecord(recordName);
        }
      },
      onKeyUp: (event) => {
        if (event.key === " " || event.key === "Enter") finishRecord();
      },
    };
  }

  return (
    <div className="page-shell home-page">
      <Header />
      <main className="home-main" aria-label={t("home.title")}>
        <div className="home-meter">
          <IntensityMeter value={intensity} />
          <p className="home-record-message" aria-live="polite">
            {message || t(pressureSupported ? "record.hintPressure" : "record.hintDuration")}
          </p>
        </div>

        <div className="tile-grid">
          {names.slice(0, 8).map((item) => (
            <button
              key={item.name}
              className={`square-tile recent-tile${pressedName === item.name ? " recording" : ""}`}
              type="button"
              disabled={Boolean(savingName)}
              aria-label={`${t("record.holdToRecord")} ${item.name}`}
              {...pressureProps(item.name)}
            >
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
