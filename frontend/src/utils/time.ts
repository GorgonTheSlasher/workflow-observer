const HAS_TIMEZONE = /[zZ]|[+-]\d{2}:?\d{2}$/;

// Backend timestamps are UTC but serialized without a timezone marker,
// which makes `new Date(iso)` parse them as local time. Treat bare strings as UTC.
export function parseUtcDate(iso: string): Date {
  return new Date(HAS_TIMEZONE.test(iso) ? iso : `${iso}Z`);
}
