import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import { IntensityMeter } from "../../ui/index.js";
import { playIntensityBlip, startPressTone, stopPressTone, updatePressTone } from "../../utils/sound.js";
import Header from "../Header/index.js";

const TILE_TARGET = 140;
const MAX_COLS = 8;

function computeGrid(width, height, columnGap, rowGap) {
  let cols = Math.max(3, Math.min(MAX_COLS, Math.floor((width + columnGap) / (TILE_TARGET + columnGap))));
  let tile = (width - (cols - 1) * columnGap) / cols;
  while (tile > height && cols < MAX_COLS) {
    cols += 1;
    tile = (width - (cols - 1) * columnGap) / cols;
  }
  const rows = Math.max(1, Math.floor((height + rowGap) / (tile + rowGap)));
  return { cols, rows };
}

export default function HomePage() {
  const { t } = useTranslation();
  const [names, setNames] = useState([]);
  const [page, setPage] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [armedIntensity, setArmedIntensity] = useState(null);
  const [pressedName, setPressedName] = useState("");
  const [savingName, setSavingName] = useState("");
  const [message, setMessage] = useState("");
  const activeRef = useRef(false);
  const activeNameRef = useRef("");
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const messageTimerRef = useRef(null);
  const intensityRef = useRef(1);
  const swipeStartRef = useRef(null);
  const gridRef = useRef(null);
  const trackRef = useRef(null);
  const [grid, setGrid] = useState({ cols: 3, rows: 3 });

  useLayoutEffect(() => {
    const element = gridRef.current;
    function measure() {
      const style = getComputedStyle(element);
      const pad = parseFloat(style.getPropertyValue("--tile-pad")) || 0;
      const gap = parseFloat(style.getPropertyValue("--tile-gap")) || 0;
      const width = element.clientWidth - pad * 2;
      const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width <= 0 || height <= 0) return;
      const next = computeGrid(width, height, gap, gap);
      setGrid((current) => (current.cols === next.cols && current.rows === next.rows ? current : next));
      setPage(0);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api
        .getKnotNames(90)
        .then((data) => !cancelled && setNames(data.names))
        .catch(() => {});
    }
    function handleKnotsChanged() {
      load();
      setArmedIntensity(null);
      updateIntensity(1);
    }
    load();
    window.addEventListener("tikt:knots-changed", handleKnotsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("tikt:knots-changed", handleKnotsChanged);
    };
  }, []);

  function updateIntensity(value) {
    const next = Math.max(1, Math.min(10, Math.ceil(value)));
    intensityRef.current = next;
    if (activeRef.current) updatePressTone(next);
    setIntensity(next);
  }

  // Tapping a meter box pre-arms that intensity: the next tap on a knot tile
  // records with it directly instead of ramping by hold duration.
  function selectIntensity(level) {
    if (activeRef.current || savingName) return;
    setArmedIntensity(level);
    updateIntensity(level);
    playIntensityBlip(level);
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
    startRef.current = performance.now();
    updateIntensity(armedIntensity ?? 1);
    setPressedName(recordName);
    setMessage("");
    if (armedIntensity === null) {
      startPressTone(intensityRef.current);
      timerRef.current = window.setInterval(() => {
        updateIntensity(1 + Math.floor((performance.now() - startRef.current) / 400));
      }, 60);
    }
  }

  async function finishRecord() {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearInterval(timerRef.current);
    stopPressTone();
    const recordName = activeNameRef.current;
    const recordedIntensity = intensityRef.current;
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
        const updated = existing
          ? current.map((item) =>
              item.name === recordName ? { ...item, count: item.count + 1, lastUsed: knot.time } : item,
            )
          : [{ name: recordName, count: 1, lastUsed: knot.time }, ...current];
        return updated.sort(
          (a, b) => b.count - a.count || new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0),
        );
      });
      if (navigator.vibrate) navigator.vibrate(20);
      setMessage(t("record.saved"));
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setArmedIntensity(null);
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
    stopPressTone();
    setPressedName("");
    updateIntensity(armedIntensity ?? 1);
  }

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      window.clearTimeout(messageTimerRef.current);
      stopPressTone();
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

  function pressProps(recordName) {
    return {
      onContextMenu: (event) => event.preventDefault(),
      onPointerDown: () => beginRecord(recordName),
      onPointerUp: (event) => {
        if (event.pointerType !== "touch") finishRecord();
      },
      onPointerLeave: (event) => {
        if (event.pointerType !== "touch") cancelRecord();
      },
      onPointerCancel: cancelRecord,
      onTouchStart: () => beginRecord(recordName),
      onTouchMove: (event) => {
        const touch = event.touches?.[0];
        if (touch && !pointInside(touch.clientX, touch.clientY, event.currentTarget)) cancelRecord();
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

  const pageSize = grid.cols * grid.rows;
  const pageCount = Math.max(1, Math.ceil(names.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);

  function beginSwipe(x, y) {
    swipeStartRef.current = { x, y, axis: null };
  }

  function moveSwipe(x, y) {
    const start = swipeStartRef.current;
    const track = trackRef.current;
    if (!start || !track) return;
    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (!start.axis) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      start.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
    }
    if (start.axis !== "x") return;
    const atEdge = (currentPage === 0 && deltaX > 0) || (currentPage === pageCount - 1 && deltaX < 0);
    const offset = atEdge ? deltaX / 3 : deltaX;
    track.style.transition = "none";
    track.style.transform = `translateX(calc(${-currentPage * 100}% + ${offset}px))`;
  }

  function endSwipe(x, y) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const track = trackRef.current;
    if (!start || !track) return;
    const deltaX = x - start.x;
    let nextPage = currentPage;
    if (start.axis === "x" && Math.abs(deltaX) >= 48) {
      nextPage = deltaX < 0 ? Math.min(currentPage + 1, pageCount - 1) : Math.max(currentPage - 1, 0);
    }
    track.style.transition = "";
    track.style.transform = `translateX(${-nextPage * 100}%)`;
    if (nextPage !== currentPage) setPage(nextPage);
  }

  function cancelSwipe() {
    const track = trackRef.current;
    if (!swipeStartRef.current || !track) return;
    swipeStartRef.current = null;
    track.style.transition = "";
    track.style.transform = `translateX(${-currentPage * 100}%)`;
  }

  return (
    <div className="page-shell home-page">
      <Header />
      <main
        className="home-main"
        aria-label={t("home.title")}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch") beginSwipe(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch" && event.buttons === 1) moveSwipe(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "touch") endSwipe(event.clientX, event.clientY);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") cancelSwipe();
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch) beginSwipe(touch.clientX, touch.clientY);
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) moveSwipe(touch.clientX, touch.clientY);
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          if (touch) endSwipe(touch.clientX, touch.clientY);
        }}
        onTouchCancel={cancelSwipe}
      >
        <div className="home-meter">
          <IntensityMeter value={intensity} onSelect={selectIntensity} />
          <p className="home-record-message" aria-live="polite">
            {message || t("record.hintDuration")}
          </p>
        </div>

        <div ref={gridRef} className="tile-carousel">
          <div
            ref={trackRef}
            className="tile-track"
            style={{ transform: `translateX(${-currentPage * 100}%)` }}
          >
            {Array.from({ length: pageCount }, (_, pageIndex) => (
              <div
                key={pageIndex}
                className="tile-grid"
                style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}
              >
                {names.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize).map((item) => (
                  <button
                    key={item.name}
                    className={`square-tile recent-tile${pressedName === item.name ? " recording" : ""}`}
                    type="button"
                    disabled={Boolean(savingName)}
                    aria-label={`${t("record.holdToRecord")} ${item.name}`}
                    {...pressProps(item.name)}
                  >
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="tile-pager">
          {names.length > 0 && (
            <div className="pager-dots" aria-label={t("home.pageOf", { current: currentPage + 1, total: pageCount })}>
              {Array.from({ length: pageCount }, (_, index) => (
                <span key={index} className={`pager-dot${index === currentPage ? " active" : ""}`} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
