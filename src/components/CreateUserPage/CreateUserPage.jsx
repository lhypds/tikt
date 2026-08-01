import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "../../ui/index.js";
import { useAuth } from "../AuthProvider/index.js";
import Header from "../Header/index.js";

export default function CreateUserPage() {
  const { t } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState(searchParams.get("username") || "");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function digitInput(setter) {
    return (event) => {
      setter(event.target.value.replace(/\D/g, ""));
      setError("");
    };
  }

  function isValidBirthdate() {
    const today = new Date();
    const year = Number(birthYear);
    const month = Number(birthMonth);
    const day = Number(birthDay);
    if (year < 1900 || year > today.getFullYear()) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > new Date(year, month, 0).getDate()) return false;
    return new Date(year, month - 1, day) <= today;
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!isValidBirthdate()) return setError(t("createUser.birthdateInvalid"));
    setSubmitting(true);
    setError("");
    const birthdate = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
    try {
      await register({ username: username.trim().normalize("NFKC").toLowerCase(), birthdate });
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
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
              }}
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={32}
              required
            />
          </label>
          <div className="field-group">
            <span>{t("createUser.birthdate")}</span>
            <div className="date-inputs">
              <input
                value={birthYear}
                placeholder={t("createUser.year")}
                aria-label={t("createUser.year")}
                inputMode="numeric"
                maxLength={4}
                onChange={digitInput(setBirthYear)}
                required
              />
              <input
                value={birthMonth}
                placeholder={t("createUser.month")}
                aria-label={t("createUser.month")}
                inputMode="numeric"
                maxLength={2}
                onChange={digitInput(setBirthMonth)}
                required
              />
              <input
                value={birthDay}
                placeholder={t("createUser.day")}
                aria-label={t("createUser.day")}
                inputMode="numeric"
                maxLength={2}
                onChange={digitInput(setBirthDay)}
                required
              />
            </div>
          </div>
          <button className="primary-button" type="submit" disabled={submitting}>
            {t("createUser.submit")}
          </button>
          {error && <p className="form-message error">{error}</p>}
        </form>
      </main>
    </div>
  );
}
