// Loads events.json and sorts every event into upcoming or past by comparing its end time with "now".
// Recurring events (the monthly prayer meeting) always resolve to their next occurrence, so they stay upcoming.
import eventsData from '../data/events.json';
import site from '../data/site.json';
import { firstFriday, formatDateRange, formatLongDate, formatTime, todayInZone, zonedToUtc } from './dates';

export interface EventRecord {
  slug: string;
  title: string;
  tagline?: string;
  kind: 'conference' | 'monthly';
  recurrence?: 'first-friday';
  startDate?: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  agenda?: { label: string; start: string; end: string }[];
  location: { address: string; city: string; region: string; postalCode: string };
  cost: string;
  speakers?: string[];
  flyer: string;
  description: string[];
  scripture?: boolean;
}

export interface Occurrence {
  event: EventRecord;
  startDate: string;
  endDate: string;
  start: Date;
  end: Date;
  isRecurring: boolean;
  /** "Friday, October 2, 2026" or "October 24 to 26, 2024" */
  dateLabel: string;
  /** "6:00 PM to 9:00 PM" */
  timeLabel: string;
}

const tz = site.timezone;
const events = eventsData.events as EventRecord[];

function timeLabel(e: EventRecord): string {
  return `${formatTime(e.startTime)} to ${formatTime(e.endTime)}`;
}

function nextFirstFriday(e: EventRecord, now: Date): { startDate: string; endDate: string } {
  const [y, m] = todayInZone(now, tz).split('-').map(Number);
  // Look at this month and the next few; the first occurrence that has not ended is the next one.
  for (let i = 0; i < 4; i++) {
    const year = y + Math.floor((m - 1 + i) / 12);
    const month = ((m - 1 + i) % 12) + 1;
    const date = firstFriday(year, month);
    if (zonedToUtc(date, e.endTime, tz) >= now) return { startDate: date, endDate: date };
  }
  throw new Error(`No upcoming occurrence found for ${e.slug}`);
}

export function occurrenceFor(e: EventRecord, now = new Date()): Occurrence {
  const recurring = e.recurrence === 'first-friday';
  const { startDate, endDate } = recurring
    ? nextFirstFriday(e, now)
    : { startDate: e.startDate!, endDate: e.endDate ?? e.startDate! };
  return {
    event: e,
    startDate,
    endDate,
    start: zonedToUtc(startDate, e.startTime, tz),
    end: zonedToUtc(endDate, e.endTime, tz),
    isRecurring: recurring,
    dateLabel: recurring ? formatLongDate(startDate) : formatDateRange(startDate, endDate),
    timeLabel: timeLabel(e),
  };
}

/** Upcoming events, soonest first. Empty when nothing is scheduled. */
export function getUpcoming(now = new Date()): Occurrence[] {
  return events
    .map((e) => occurrenceFor(e, now))
    .filter((o) => o.end >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Past events, most recent first. */
export function getPast(now = new Date()): Occurrence[] {
  return events
    .map((e) => occurrenceFor(e, now))
    .filter((o) => o.end < now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function getAllEvents(): EventRecord[] {
  return events;
}

export function getEvent(slug: string): EventRecord | undefined {
  return events.find((e) => e.slug === slug);
}

export function formatLocation(loc: EventRecord['location']): string {
  return `${loc.address}, ${loc.city}, ${loc.region} ${loc.postalCode}`;
}

/** Link that pre-fills Google Calendar. Recurring events get a monthly rule. */
export function googleCalendarUrl(o: Occurrence): string {
  const fmt = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: o.event.title,
    dates: `${fmt(o.startDate, o.event.startTime)}/${fmt(o.endDate, o.event.endTime)}`,
    ctz: tz,
    location: formatLocation(o.event.location),
    details: o.event.tagline ?? '',
  });
  if (o.isRecurring) params.set('recur', 'RRULE:FREQ=MONTHLY;BYDAY=1FR');
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
