// Lightweight timezone helpers. Avoid pulling in luxon for a few operations.

export function getHouseholdHMInTz(date: Date, timezone: string): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

/**
 * Build a Date representing the wall-clock time {hour, minute} on the given
 * day (anchor) in `timezone`. Returns a UTC Date instant.
 *
 * Algorithm: take the calendar date in `timezone` from `anchor`, then compute
 * the UTC instant whose tz-local clock equals that calendar date at H:M.
 */
export function dateAtTimeInTz(anchor: Date, hour: number, minute: number, timezone: string): Date {
  const datePartsFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = datePartsFmt.formatToParts(anchor);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  // Construct an instant as if H:M were UTC; figure out the tz offset at that point;
  // then shift back. Two iterations handle DST boundaries within 1 ms.
  let guess = new Date(Date.UTC(y, m - 1, d, hour, minute, 0, 0));
  for (let i = 0; i < 2; i++) {
    const tzNow = getHouseholdHMInTz(guess, timezone);
    const tzDiffMin = (tzNow.hour - hour) * 60 + (tzNow.minute - minute);
    if (tzDiffMin === 0) break;
    guess = new Date(guess.getTime() - tzDiffMin * 60_000);
  }
  return guess;
}
