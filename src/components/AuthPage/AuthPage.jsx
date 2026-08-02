import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "../../ui/index.js";
import { useAuth } from "../AuthProvider/index.js";
import LanguageSwitcher from "../LanguageSwitcher/index.js";

export default function AuthPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const name = username.trim().normalize("NFKC").toLowerCase();
    if (!name) return setError(t("auth.usernameRequired"));
    setSubmitting(true);
    setError("");
    try {
      await login(name);
      navigate("/", { replace: true });
    } catch (requestError) {
      if (requestError.code === "USER_NOT_FOUND") {
        navigate(`/create-user?username=${encodeURIComponent(name)}`);
        return;
      }
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <span className="auth-lang">
        <LanguageSwitcher />
      </span>
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title" className="auth-logo">
          tikt
        </h1>
        <p className="tagline">{t("auth.tagline")}</p>
        <form className="login-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="login-username">
            {t("auth.username")}
          </label>
          <div className="joined-field">
            <input
              id="login-username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
              }}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              enterKeyHint="go"
              placeholder={t("auth.username")}
              maxLength={32}
            />
            <button type="submit" disabled={submitting}>
              {t("auth.login")}
            </button>
          </div>
          <p className={error ? "form-message error" : "form-message"}>{error || t("auth.usernameHint")}</p>
        </form>
      </section>
    </main>
  );
}
