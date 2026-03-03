export const isoDay = (date) => date.toISOString().slice(0, 10);

export function lastNDays(days) {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    result.push(isoDay(date));
  }

  return result;
}
