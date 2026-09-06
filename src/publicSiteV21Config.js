export const PUBLIC_V21_ROUTES = Object.freeze({
  home: '/',
  step1: '/step-1',
  step2: '/step-2',
  step3: '/step-3',
  step4: '/step-4',
});

export function resolveProductionAthleteDestination(value = import.meta.env.VITE_PUBLIC_ATHLETE_DESTINATION) {
  const destination = String(value || '').trim();
  if (/^https:\/\/[^\s]+$/u.test(destination) || /^\/[a-z0-9/_-]+$/iu.test(destination)) return destination;
  return '';
}
