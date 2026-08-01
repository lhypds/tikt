import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "../../ui/index.js";
import { useAuth } from "../AuthProvider/index.js";
import Header from "../Header/index.js";

export default function CreateUserPage() {
  const { t } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", age: "", email: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await register({
        ...form,
        username: form.username.trim().normalize("NFKC").toLowerCase(),
        age: Number(form.age),
      });
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <Header back />
      <main className="form-page">
        <form className="plain-form" onSubmit={submit}>
          <h1>{t("createUser.title")}</h1>
          <label>
            <span>{t("createUser.username")}</span>
            <input
              value={form.username}
              onChange={(event) => update("username", event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={32}
              required
            />
          </label>
          <label>
            <span>{t("createUser.age")}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="130"
              value={form.age}
              onChange={(event) => update("age", event.target.value)}
              required
            />
          </label>
          <label>
            <span>{t("createUser.email")}</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
            />
          </label>
          {error && <p className="form-message error">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {t("createUser.submit")}
          </button>
        </form>
      </main>
    </div>
  );
}
