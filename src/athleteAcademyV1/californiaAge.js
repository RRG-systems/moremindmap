// Enrollment's date picker uses the same California calendar as server age checks.
export function latestBirthDate(minimumAge = 18, at = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(at)).map(({ type, value }) => [type, value]));
  const year = Number(parts.year) - minimumAge;
  const day = Math.min(Number(parts.day), new Date(Date.UTC(year, Number(parts.month), 0)).getUTCDate());
  return `${year}-${parts.month}-${String(day).padStart(2, '0')}`;
}
