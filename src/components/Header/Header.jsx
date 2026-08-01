import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../api.js";
import { ActionButton, Link, useNavigate } from "../../ui/index.js";
import { isSoundMuted, setSoundMuted, subscribeSoundMuted } from "../../utils/sound.js";
import { useAuth } from "../AuthProvider/index.js";
import KnotModal from "../KnotModal/index.js";
import LanguageSwitcher from "../LanguageSwitcher/index.js";

export default function Header({ back = false }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const muted = useSyncExternalStore(subscribeSoundMuted, isSoundMuted);

  async function handleCreate(name) {
    await api.createKnotName(name);
    window.dispatchEvent(new Event("tikt:knots-changed"));
    setCreating(false);
  }

  return (
    <header className="topbar">
      <span className="topbar-brand">
        {back ? (
          <ActionButton tooltip={t("header.backHome")} onClick={() => navigate("/")}>
            <svg viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </ActionButton>
        ) : (
          <Link className="wordmark" to="/">
            tikt
          </Link>
        )}
      </span>
      <span className="topbar-action-slot topbar-action-slot-right">
        {user && (
          <>
            <ActionButton tooltip={t("knots.createTitle")} onClick={() => setCreating(true)}>
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </ActionButton>
            <ActionButton tooltip={t("knots.title")} onClick={() => navigate("/knots")}>
              <svg viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" />
                <path d="M12 4v16M4 12h16" />
              </svg>
            </ActionButton>
            <ActionButton tooltip={t("header.history")} onClick={() => navigate("/history")}>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </ActionButton>
          </>
        )}
        <ActionButton
          tooltip={t(muted ? "header.unmute" : "header.mute")}
          aria-pressed={muted}
          onClick={() => setSoundMuted(!muted)}
        >
          {muted ? (
            <svg viewBox="0 0 24 24">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="m16 9 5 6" />
              <path d="m21 9-5 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 6a9 9 0 0 1 0 12" />
            </svg>
          )}
        </ActionButton>
        {user && (
          <ActionButton tooltip={t("header.account")} onClick={() => navigate("/account")}>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
          </ActionButton>
        )}
        <LanguageSwitcher />
      </span>
      {user && (
        <KnotModal
          isOpen={creating}
          title={t("knots.createTitle")}
          submitLabel={t("knots.create")}
          onClose={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}
    </header>
  );
}
