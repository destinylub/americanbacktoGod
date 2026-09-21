// Date helpers. Event times are stored as local wall-clock strings in the mission's time zone
// (see site.json), then converted to real instants so past and upcoming split correctly.

/** Offset of `tz` from UTC in minutes at the given instant (negative for the US). */
function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - date.getTime()) / 60000;
}

/** Converts "YYYY-MM-DD" plus "HH:mm" in `tz` to a UTC instant. */
export function zonedToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = naive - tzOffsetMinutes(new Date(naive), tz) * 60000;
  // Second pass corrects the offset when the guess lands on the other side of a DST change.
  return new Date(naive - tzOffsetMinutes(new Date(first), tz) * 60000);
}

/** ISO 8601 string with the zone's offset, e.g. 2026-10-02T18:00:00-04:00 (used in structured data). */
export function toZonedIso(dateStr: string, timeStr: string, tz: string): string {
  const utc = zonedToUtc(dateStr, timeStr, tz);
  const off = tzOffsetMinutes(utc, tz);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
}

/** Today's calendar date ("YYYY-MM-DD") in `tz`. */
export function todayInZone(now: Date, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** The first Friday of a month (month is 1 to 12) as "YYYY-MM-DD". */
export function firstFriday(year: number, month: number): string {
  for (let day = 1; day <= 7; day++) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 5) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  throw new Error('unreachable');
}

const utcNoon = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** "Friday, October 2, 2026" */
export function formatLongDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(utcNoon(dateStr));
}

/** "October 24, 2024" */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(utcNoon(dateStr));
}

/** Day range such as "October 24 to 26, 2024" or "November 9 to 11, 2023". */
export function formatDateRange(startStr: string, endStr: string): string {
  if (startStr === endStr) return formatDate(startStr);
  const s = utcNoon(startStr);
  const e = utcNoon(endStr);
  const month = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' }).format(d);
  if (s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) {
    return `${month(s)} ${s.getUTCDate()} to ${e.getUTCDate()}, ${s.getUTCFullYear()}`;
  }
  return `${formatDate(startStr)} to ${formatDate(endStr)}`;
}

/** "6:00 PM" from "18:00". */
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "October 2026" style badge parts for cards. */
export function dateBadge(dateStr: string): { month: string; day: string; year: string } {
  const d = utcNoon(dateStr);
  return {
    month: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(d),
    day: String(d.getUTCDate()),
    year: String(d.getUTCFullYear()),
  };
}
