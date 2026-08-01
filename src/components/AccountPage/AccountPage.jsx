import { useTranslation } from "react-i18next";
import { useNavigate } from "../../ui/index.js";
import { useAuth } from "../AuthProvider/index.js";
import Header from "../Header/index.js";

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="page-shell">
      <Header back />
      <main className="form-page">
        <section className="account-card">
          <h1>{t("account.title")}</h1>
          <dl>
            <div>
              <dt>{t("account.username")}</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>{t("account.age")}</dt>
              <dd>{user.age}</dd>
            </div>
            <div>
              <dt>{t("account.email")}</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <button className="outline-button" type="button" onClick={handleLogout}>
            logout
          </button>
        </section>
      </main>
    </div>
  );
}
