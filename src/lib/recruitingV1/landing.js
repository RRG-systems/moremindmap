export const RECRUITING_ADMIN_LANDING_PATH = '/recruiting/master-control';
export const RECRUITING_MANAGER_WORKSPACE_PATH = '/recruiting/home?view=workspace';

export function resolveAuthenticatedRecruitingLanding({ pathname, search = '', manager } = {}) {
  if (pathname !== '/recruiting/home') return null;
  if (new URLSearchParams(search).get('view') === 'workspace') return null;
  return manager?.capabilities?.master_control === true
    ? RECRUITING_ADMIN_LANDING_PATH
    : null;
}
