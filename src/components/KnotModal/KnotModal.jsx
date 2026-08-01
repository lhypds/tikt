import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../ui/index.js";

export default function KnotModal({ isOpen, title, submitLabel, initialName = "", onClose, onSubmit }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError("");
      setSubmitting(false);
    }
  }, [isOpen, initialName]);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const normalized = name.trim().normalize("NFKC");
    if (!normalized) return setError(t("knots.nameRequired"));
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(normalized);
    } catch (requestError) {
      setError(requestError.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form className="joined-field knot-field" onSubmit={submit}>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          aria-label={t("knots.namePlaceholder")}
          maxLength={48}
          autoFocus
        />
        <button type="submit" disabled={submitting}>
          {submitLabel}
        </button>
      </form>
      {error && <p className="form-message error">{error}</p>}
    </Modal>
  );
}
