const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const utcParts = (iso: string) => {
  const date = new Date(iso);
  return {
    day: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()],
    year: date.getUTCFullYear(),
  };
};

/** "16 JUL 2026" — print metadata on evidence pieces. */
export function stampDate(iso: string): string {
  const { day, month, year } = utcParts(iso);
  return `${day} ${month} ${year}`;
}

/** "16 JUL" — terse galley dates. */
export function galleyDate(iso: string): string {
  const { day, month } = utcParts(iso);
  return `${day} ${month}`;
}

/** "15 Jul 2026" — release register dates. */
export function registerDate(iso: string): string {
  const { day, month, year } = utcParts(iso);
  return `${day} ${month.charAt(0)}${month.slice(1).toLowerCase()} ${year}`;
}
