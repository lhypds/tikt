import { useTranslation } from "react-i18next";
import { useNavigate } from "../../ui/index.js";
import { useAuth } from "../AuthProvider/index.js";
import Header from "../Header/index.js";

function ageFromBirthdate(birthdate) {
  const [year, month, day] = birthdate.split("-").map(Number);
  const today = new Date();
  let years = today.getFullYear() - year;
  let months = today.getMonth() + 1 - month;
  if (today.getDate() < day) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

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
            {user.birthdate && (
              <>
                <div>
                  <dt>{t("account.birthdate")}</dt>
                  <dd>{user.birthdate}</dd>
                </div>
                <div>
                  <dt>{t("account.age")}</dt>
                  <dd>{t("account.ageValue", ageFromBirthdate(user.birthdate))}</dd>
                </div>
              </>
            )}
          </dl>
          <button className="outline-button" type="button" onClick={handleLogout}>
            {t("account.logout")}
          </button>
        </section>
      </main>
    </div>
  );
}
