export const DATE_LOCALES = { zh: "zh-CN", ja: "ja-JP", en: "en-US" };

const pad = (value) => String(value).padStart(2, "0");

export function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// 1 = Monday … 7 = Sunday, converted to JS getDay() numbering (0 = Sunday).
export function firstDayOfWeek(locale) {
  try {
    const intlLocale = new Intl.Locale(locale);
    const weekInfo = intlLocale.weekInfo ?? intlLocale.getWeekInfo?.();
    if (weekInfo?.firstDay) return weekInfo.firstDay % 7;
  } catch {
    // fall through to the default below
  }
  return 1;
}
