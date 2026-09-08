import { next } from '@vercel/functions';

export function athleteConsultingRouteEnabled(env = globalThis.process?.env || {}) {
  return env.RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED === 'true'
    && env.SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED === 'true'
    && env.ATHLETE_CONSULTING_DARREN_DEMO_ENABLED === 'true';
}

export default function athleteConsultingDemoRouteGate() {
  if (!athleteConsultingRouteEnabled()) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'cache-control': 'no-store, private, max-age=0',
        'content-type': 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  return next();
}

export const config = {
  matcher: '/athlete-consulting-tool/demo/:path*',
};
