import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../ui/index.js";
import { isLocationEnabled, setLocationEnabled, subscribeLocationEnabled } from "../../utils/location.js";
import styles from "./loc.module.css";

const OPTIONS = [
  { value: true, label: "on" },
  { value: false, label: "off" },
];

export default function LocationSwitcher() {
  const { t } = useTranslation();
  const enabled = useSyncExternalStore(subscribeLocationEnabled, isLocationEnabled);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  async function choose(value) {
    setOpen(false);
    if (busy) return;
    setBusy(true);
    const result = await setLocationEnabled(value);
    setBusy(false);
    if (result === "denied") showToast(t("location.denied"), 2400);
    if (result === "unsupported") showToast(t("location.unsupported"), 2400);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open}>
      <button
        type="button"
        className={`${styles.trigger} ${enabled ? styles.active : ""}`}
        title={t("location.title")}
        aria-label={t("location.title")}
        aria-pressed={enabled}
        onClick={() => setOpen((v) => !v)}
      >
        lo
      </button>
      <div className={styles.dropdown}>
        {OPTIONS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            className={`${styles.option} ${enabled === value ? styles.active : ""}`}
            aria-label={t(value ? "location.on" : "location.off")}
            onClick={() => choose(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
