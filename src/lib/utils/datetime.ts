const RELATIVE_TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year',   60 * 60 * 24 * 365],
  ['month',  60 * 60 * 24 * 30],
  ['week',   60 * 60 * 24 * 7],
  ['day',    60 * 60 * 24],
  ['hour',   60 * 60],
  ['minute', 60],
  ['second', 1],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absoluteFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

export const formatRelativeTime = (
  value: string | number | Date,
  base: Date = new Date()
): string => {
  const target = new Date(value);
  if (!isValidDate(target) || !isValidDate(base)) return '';

  const diffSeconds = Math.round((target.getTime() - base.getTime()) / 1000);

  // Clamp any future time to "Just now"
  if (diffSeconds >= 0) return 'Just now';

  const absSeconds = Math.abs(diffSeconds);
  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (absSeconds >= unitSeconds || unit === 'second') {
      const valueInUnits = Math.round(diffSeconds / unitSeconds);
      return relativeTimeFormatter.format(valueInUnits, unit);
    }
  }
  return '';
};

export const formatAbsoluteTime = (value: string | number | Date): string => {
  const target = new Date(value);
  return isValidDate(target) ? absoluteFormatter.format(target) : '';
};
