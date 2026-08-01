import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import Header from "../Header/index.js";
import HistoryKnotItem from "../HistoryKnotItem/index.js";
import StatsBarChart from "./StatsBarChart.jsx";
import StatsCalendar from "./StatsCalendar.jsx";
import { DATE_LOCALES, dayKey, monthKey } from "./dates.js";

const FILTER_LABEL_FORMATS = {
  day: { year: "numeric", month: "long", day: "numeric" },
  month: { year: "numeric", month: "long" },
  year: { year: "numeric" },
};

function knotFilterKey(knot, type) {
  const date = new Date(knot.time);
  if (type === "day") return dayKey(date);
  if (type === "month") return monthKey(date);
  return String(date.getFullYear());
}

function filterLabel(filter, locale) {
  const [year, month = 1, day = 1] = filter.key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(locale, FILTER_LABEL_FORMATS[filter.type]).format(date);
}

export default function KnotStatsPage({ nameId }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALES[i18n.language] || "en-US";
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getKnotNameStats(nameId)
      .then((data) => !cancelled && setStats(data))
      .catch((requestError) => !cancelled && setError(requestError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nameId]);

  const { dayCounts, monthCounts, yearCounts } = useMemo(() => {
    const days = new Map();
    const months = new Map();
    const years = new Map();
    for (const knot of stats?.knots ?? []) {
      const date = new Date(knot.time);
      const day = dayKey(date);
      const month = monthKey(date);
      const year = String(date.getFullYear());
      days.set(day, (days.get(day) ?? 0) + 1);
      months.set(month, (months.get(month) ?? 0) + 1);
      years.set(year, (years.get(year) ?? 0) + 1);
    }
    return { dayCounts: days, monthCounts: months, yearCounts: years };
  }, [stats]);

  const visibleKnots = useMemo(() => {
    const knots = stats?.knots ?? [];
    if (!filter) return knots;
    return knots.filter((knot) => knotFilterKey(knot, filter.type) === filter.key);
  }, [stats, filter]);

  function toggleFilter(next) {
    setFilter((current) =>
      current && current.type === next.type && current.key === next.key ? null : next,
    );
  }

  async function handleDelete(knotId) {
    setDeleteError("");
    try {
      await api.deleteKnot(knotId);
      setStats((current) => ({
        ...current,
        knots: current.knots.filter((knot) => knot.id !== knotId),
      }));
    } catch (requestError) {
      setDeleteError(requestError.message);
      throw requestError;
    }
  }

  return (
    <div className="page-shell">
      <Header back backTo="/knots" />
      <main className="list-page stats-page">
        <div className="section-heading">
          <h1>{stats?.name.name ?? " "}</h1>
          <span>{stats ? stats.knots.length : ""}</span>
        </div>
        {loading ? null : error ? (
          <p className="empty-state">{error}</p>
        ) : stats.knots.length === 0 ? (
          <p className="empty-state">{t("history.empty")}</p>
        ) : (
          <>
            <StatsCalendar
              dayCounts={dayCounts}
              selectedDay={filter?.type === "day" ? filter.key : null}
              onSelectDay={(key) => toggleFilter({ type: "day", key })}
            />
            <StatsBarChart
              dayCounts={dayCounts}
              monthCounts={monthCounts}
              yearCounts={yearCounts}
              selected={filter}
              onSelect={(type, key) => toggleFilter({ type, key })}
            />
            <section className="stats-list">
              {deleteError && (
                <p className="history-error" role="alert">
                  {deleteError}
                </p>
              )}
              {filter && (
                <div className="stats-filter">
                  <span>
                    {filterLabel(filter, locale)} · {t("knotStats.times", { count: visibleKnots.length })}
                  </span>
                  <button type="button" aria-label={t("knotStats.clearFilter")} onClick={() => setFilter(null)}>
                    <svg viewBox="0 0 24 24">
                      <path d="m6 6 12 12" />
                      <path d="m18 6-12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <ol className="knot-list">
                {visibleKnots.map((knot) => {
                  const formattedTime = new Intl.DateTimeFormat(locale, {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(knot.time));
                  return (
                    <HistoryKnotItem
                      key={knot.id}
                      knot={knot}
                      formattedTime={formattedTime}
                      onDelete={handleDelete}
                    />
                  );
                })}
              </ol>
              {filter && visibleKnots.length === 0 && <p className="empty-state">{t("history.empty")}</p>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
