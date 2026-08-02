import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import Header from "../Header/index.js";
import HistoryKnotItem from "../HistoryKnotItem/index.js";

const DATE_LOCALES = { zh: "zh-CN", ja: "ja-JP", en: "en-US" };

export default function HistoryPage() {
  const { t, i18n } = useTranslation();
  const [knots, setKnots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getKnots(200)
      .then((data) => !cancelled && setKnots(data.knots))
      .catch((requestError) => !cancelled && setError(requestError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(knotId) {
    setDeleteError("");
    try {
      await api.deleteKnot(knotId);
      setKnots((current) => current.filter((knot) => knot.id !== knotId));
    } catch (requestError) {
      setDeleteError(requestError.message);
      throw requestError;
    }
  }

  return (
    <div className="page-shell">
      <Header back />
      <main className="list-page">
        <div className="section-heading">
          <div className="section-heading-titles">
            <h1>{t("history.title")}</h1>
            <p className="section-subtitle">{t("history.subtitle")}</p>
          </div>
          <span>{knots.length}</span>
        </div>
        {deleteError && (
          <p className="history-error" role="alert">
            {deleteError}
          </p>
        )}
        {loading ? null : error ? (
          <p className="empty-state">{error}</p>
        ) : knots.length === 0 ? (
          <p className="empty-state">{t("history.empty")}</p>
        ) : (
          <ol className="knot-list">
            {knots.map((knot) => {
              const formattedTime = new Intl.DateTimeFormat(DATE_LOCALES[i18n.language] || "en-US", {
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
        )}
      </main>
    </div>
  );
}
