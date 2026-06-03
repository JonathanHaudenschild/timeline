export function formatShortGermanDate(date: string) {
  const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!year || !month || !day) return date;

  const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  return `${weekday} ${day}.${month}`;
}

export function formatShortGermanDateRange(startDate: string, endDate?: string) {
  return endDate ? `${formatShortGermanDate(startDate)} - ${formatShortGermanDate(endDate)}` : formatShortGermanDate(startDate);
}
