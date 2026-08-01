import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DATE_LOCALES, dayKey, firstDayOfWeek, startOfToday } from "./dates.js";

export default function StatsCalendar({ dayCounts, selectedDay, onSelectDay }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALES[i18n.language] || "en-US";
  const today = startOfToday();
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const firstWeekday = useMemo(() => firstDayOfWeek(locale), [locale]);

  const weekdayLabels = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // 2023-01-01 was a Sunday; offset from it to label each column.
    return Array.from({ length: 7 }, (_, column) =>
      format.format(new Date(2023, 0, 1 + ((firstWeekday + column) % 7))),
    );
  }, [locale, firstWeekday]);

  const monthTitle = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(view);
  const cellFormat = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" });

  const cells = useMemo(() => {
    const leading = (view.getDay() - firstWeekday + 7) % 7;
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const list = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) list.push(day);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [view, firstWeekday]);

  const canGoNext =
    view.getFullYear() * 12 + view.getMonth() < today.getFullYear() * 12 + today.getMonth();

  function shiftMonth(delta) {
    setView((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <section className="stats-block">
      <div className="cal-head">
        <span className="cal-title">{monthTitle}</span>
        <span className="cal-nav">
          <button type="button" aria-label={t("knotStats.prevMonth")} onClick={() => shiftMonth(-1)}>
            <svg viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button type="button" aria-label={t("knotStats.nextMonth")} disabled={!canGoNext} onClick={() => shiftMonth(1)}>
            <svg viewBox="0 0 24 24">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </span>
      </div>
      <div className="cal-weekdays" aria-hidden="true">
        {weekdayLabels.map((label, column) => (
          <span key={column}>{label}</span>
        ))}
      </div>
      <div className="cal-days">
        {cells.map((day, index) => {
          if (!day) return <span key={index} className="cal-cell empty" aria-hidden="true" />;
          const date = new Date(view.getFullYear(), view.getMonth(), day);
          const key = dayKey(date);
          const count = dayCounts.get(key) ?? 0;
          const selectable = count > 0;
          const classNames = [
            "cal-cell",
            selectable && "selectable",
            selectedDay === key && "selected",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <span
              key={index}
              className={classNames}
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
              aria-pressed={selectable ? selectedDay === key : undefined}
              aria-label={`${cellFormat.format(date)} ${t("knotStats.times", { count })}`}
              onClick={selectable ? () => onSelectDay(key) : undefined}
              onKeyDown={
                selectable
                  ? (event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onSelectDay(key);
                    }
                  : undefined
              }
            >
              <span className="cal-daynum" aria-hidden="true">
                {day}
              </span>
              {count > 0 && (
                <span className="cal-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}
