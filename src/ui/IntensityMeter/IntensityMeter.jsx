import { useTranslation } from "react-i18next";

export default function IntensityMeter({ value, compact = false }) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <div className="history-meter" aria-label={t("meter.aria", { value })}>
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={index < value ? "active" : ""} />
        ))}
      </div>
    );
  }

  return (
    <div className="meter-wrap" aria-label={t("meter.ariaOutOfTen", { value })}>
      <div className="meter-label">
        <span>{t("meter.intensity")}</span>
        <span>{value}/10</span>
      </div>
      <div className="meter" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={index < value ? "active" : ""} />
        ))}
      </div>
    </div>
  );
}
