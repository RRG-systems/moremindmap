export const RECRUITING_ADMIN_LANDING_PATH = '/recruiting/master-control';
export const RECRUITING_MANAGER_WORKSPACE_PATH = '/recruiting/home';

export function resolveAuthenticatedRecruitingLanding({ pathname, manager } = {}) {
  if (pathname !== '/recruiting/home') return null;
  // The old workspace query is no longer a third administration destination.
  return manager?.capabilities?.master_control === true
    ? RECRUITING_ADMIN_LANDING_PATH
    : null;
}

export function resolveRecruitingWorkspaceRoute(pathname, manager) {
  const admin = manager?.capabilities?.master_control === true;
  if (pathname === '/recruiting/invite') return null;
  if (pathname === '/recruiting/master-control' && admin) return null;
  if (pathname === '/recruiting/home' && !admin) return null;
  if (pathname === '/recruiting/consulting' && !admin) return null;
  return admin ? RECRUITING_ADMIN_LANDING_PATH : RECRUITING_MANAGER_WORKSPACE_PATH;
}
