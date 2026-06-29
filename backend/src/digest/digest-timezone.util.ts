export function resolveDigestTimezone(configured?: string): string {
  const trimmed = configured?.trim();
  return trimmed || 'UTC';
}

export function getZonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const pick = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  };
}

/** UTC instant for 00:00:00 on a calendar day in the given IANA timezone */
export function startOfZonedDayUtc(
  timeZone: string,
  reference: Date = new Date(),
  dayOffset = 0,
): Date {
  let { year, month, day } = getZonedDateParts(reference, timeZone);

  if (dayOffset !== 0) {
    const anchor = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0));
    ({ year, month, day } = getZonedDateParts(anchor, timeZone));
  }

  let low = Date.UTC(year, month - 1, day - 1, 0, 0, 0);
  let high = Date.UTC(year, month - 1, day + 1, 23, 59, 59);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const parts = getZonedDateParts(new Date(mid), timeZone);
    const isBefore =
      parts.year < year ||
      (parts.year === year && parts.month < month) ||
      (parts.year === year && parts.month === month && parts.day < day);

    if (isBefore) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return new Date(low);
}

export function endOfZonedDayUtc(
  timeZone: string,
  reference: Date = new Date(),
): Date {
  const startTomorrow = startOfZonedDayUtc(timeZone, reference, 1);
  return new Date(startTomorrow.getTime() - 1);
}
