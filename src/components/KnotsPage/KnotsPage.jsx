import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import { Modal } from "../../ui/index.js";
import Header from "../Header/index.js";
import KnotItem from "../KnotItem/index.js";
import KnotModal from "../KnotModal/index.js";

const DATE_LOCALES = { zh: "zh-CN", ja: "ja-JP", en: "en-US" };

export default function KnotsPage() {
  const { t, i18n } = useTranslation();
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    function load() {
      api
        .getKnotNames(200)
        .then((data) => !cancelled && setNames(data.names))
        .catch((requestError) => !cancelled && setError(requestError.message))
        .finally(() => !cancelled && setLoading(false));
    }
    load();
    window.addEventListener("tikt:knots-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("tikt:knots-changed", load);
    };
  }, []);

  function requestDelete(knot) {
    setDeleteError("");
    setConfirming(knot);
  }

  async function confirmDelete() {
    if (!confirming || deletingId) return;
    setDeletingId(confirming.id);
    setDeleteError("");
    try {
      await api.deleteKnotName(confirming.id);
      setNames((current) => current.filter((item) => item.id !== confirming.id));
      setConfirming(null);
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRename(newName) {
    const data = await api.renameKnotName(editing.id, newName);
    setNames((current) => current.map((item) => (item.id === editing.id ? data.name : item)));
    setEditing(null);
  }

  return (
    <div className="page-shell">
      <Header back />
      <main className="list-page">
        <div className="section-heading">
          <h1>{t("knots.title")}</h1>
          <span>{names.length}</span>
        </div>
        {loading ? null : error ? (
          <p className="empty-state">{error}</p>
        ) : names.length === 0 ? (
          <p className="empty-state">{t("knots.empty")}</p>
        ) : (
          <ol className="knot-list">
            {names.map((item) => {
              const formattedTime = item.lastUsed
                ? new Intl.DateTimeFormat(DATE_LOCALES[i18n.language] || "en-US", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(item.lastUsed))
                : "";
              return (
                <KnotItem
                  key={item.id}
                  knot={item}
                  formattedTime={formattedTime}
                  deleting={deletingId === item.id}
                  onDelete={requestDelete}
                  onEdit={setEditing}
                />
              );
            })}
          </ol>
        )}
      </main>
      <KnotModal
        isOpen={Boolean(editing)}
        title={t("knots.editTitle")}
        submitLabel={t("knots.save")}
        initialName={editing?.name || ""}
        onClose={() => setEditing(null)}
        onSubmit={handleRename}
      />
      <Modal isOpen={Boolean(confirming)} onClose={() => setConfirming(null)} title={t("knots.deleteTitle")}>
        <p className="modal-text">{t("knots.deleteConfirm", { name: confirming?.name })}</p>
        {deleteError && <p className="form-message error">{deleteError}</p>}
        <div className="modal-actions">
          <button className="outline-button" type="button" onClick={() => setConfirming(null)}>
            {t("knots.cancel")}
          </button>
          <button className="primary-button" type="button" disabled={Boolean(deletingId)} onClick={confirmDelete}>
            {deletingId ? t("knots.deleting") : t("knots.delete")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
