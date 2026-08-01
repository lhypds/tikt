import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DATE_LOCALES, dayKey, monthKey, startOfToday } from "./dates.js";

const DAY_SPAN = 30;
const MONTH_SPAN = 12;
const YEAR_SPAN = 10;
// the y-axis never scales below this, so one or two occurrences stay visually small
const MIN_SCALE = 10;

const MODES = ["day", "month", "year"];
const MODE_LABELS = { day: "byDay", month: "byMonth", year: "byYear" };
const RANGE_LABELS = { day: "last30Days", month: "last12Months", year: "last10Years" };

export default function StatsBarChart({ dayCounts, monthCounts, yearCounts, selected, onSelect }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALES[i18n.language] || "en-US";
  const [mode, setMode] = useState("day");
  const [active, setActive] = useState(null);

  const bands = useMemo(() => {
    const today = startOfToday();
    if (mode === "day") {
      const dayLabel = new Intl.DateTimeFormat(locale, { month: "2-digit", day: "2-digit" });
      return Array.from({ length: DAY_SPAN }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (DAY_SPAN - 1 - index));
        return {
          key: dayKey(date),
          label: dayLabel.format(date),
          count: dayCounts.get(dayKey(date)) ?? 0,
          // one tick per week, anchored to today
          showLabel: (DAY_SPAN - 1 - index) % 7 === 0,
        };
      });
    }
    if (mode === "month") {
      const shortMonth = new Intl.DateTimeFormat(locale, { month: "short" });
      const fullMonth = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
      return Array.from({ length: MONTH_SPAN }, (_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth() - (MONTH_SPAN - 1 - index), 1);
        return {
          key: monthKey(date),
          label: fullMonth.format(date),
          tick: shortMonth.format(date),
          count: monthCounts.get(monthKey(date)) ?? 0,
          showLabel: (MONTH_SPAN - 1 - index) % 2 === 0,
        };
      });
    }
    const fullYear = new Intl.DateTimeFormat(locale, { year: "numeric" });
    return Array.from({ length: YEAR_SPAN }, (_, index) => {
      const year = today.getFullYear() - (YEAR_SPAN - 1 - index);
      return {
        key: String(year),
        label: fullYear.format(new Date(year, 0, 1)),
        tick: String(year),
        count: yearCounts.get(String(year)) ?? 0,
        showLabel: (YEAR_SPAN - 1 - index) % 2 === 0,
      };
    });
  }, [mode, locale, dayCounts, monthCounts, yearCounts]);

  const { top, ticks } = useMemo(() => {
    const max = Math.max(MIN_SCALE, ...bands.map((band) => band.count));
    let step = 1;
    for (let scale = 1; Math.ceil(max / step) > 4; scale *= 10) {
      for (const base of [1, 2, 5]) {
        step = base * scale;
        if (Math.ceil(max / step) <= 4) break;
      }
    }
    const roundedTop = Math.ceil(max / step) * step;
    const lines = [];
    for (let value = step; value <= roundedTop; value += step) lines.push(value);
    return { top: roundedTop, ticks: lines };
  }, [bands]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setActive(null);
  }

  const activeBand = active === null ? null : bands[active];

  return (
    <section className="stats-block">
      <div className="chart-controls">
        <span className="chart-range">{t(`knotStats.${RANGE_LABELS[mode]}`)}</span>
        <span className="seg-toggle" role="group">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              className={mode === option ? "active" : ""}
              aria-pressed={mode === option}
              onClick={() => switchMode(option)}
            >
              {t(`knotStats.${MODE_LABELS[option]}`)}
            </button>
          ))}
        </span>
      </div>
      <div className="chart-plot" onMouseLeave={() => setActive(null)}>
        {ticks.map((value) => (
          <span key={value} className="chart-gridline" style={{ bottom: `${(value / top) * 100}%` }}>
            <span>{value}</span>
          </span>
        ))}
        <div className="chart-bars">
          {bands.map((band, index) => (
            <button
              key={index}
              type="button"
              className={`chart-band${active === index ? " active" : ""}${
                selected?.type === mode && selected.key === band.key ? " selected" : ""
              }`}
              aria-pressed={selected?.type === mode && selected.key === band.key}
              aria-label={`${band.label} ${t("knotStats.times", { count: band.count })}`}
              onClick={band.count > 0 ? () => onSelect(mode, band.key) : undefined}
              onPointerDown={() => setActive(index)}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive((current) => (current === index ? null : current))}
            >
              {band.count > 0 && (
                <span
                  className="chart-bar"
                  style={{ height: `max(2px, ${(band.count / top) * 100}%)` }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        {activeBand && (
          <div
            className="chart-tooltip"
            style={{
              left: `${((active + 0.5) / bands.length) * 100}%`,
              transform:
                active / bands.length < 0.2
                  ? "translateX(0)"
                  : active / bands.length > 0.8
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            <span>{t("knotStats.times", { count: activeBand.count })}</span>
            <span>{activeBand.label}</span>
          </div>
        )}
      </div>
      <div className="chart-x" aria-hidden="true">
        {bands.map((band, index) => (
          <span key={index}>{band.showLabel ? (band.tick ?? band.label) : ""}</span>
        ))}
      </div>
    </section>
  );
}
