import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECRUITING_ADMIN_LANDING_PATH,
  RECRUITING_MANAGER_WORKSPACE_PATH,
  resolveAuthenticatedRecruitingLanding,
} from '../src/lib/recruitingV1/landing.js';

const admin = { capabilities: { master_control: true } };
const manager = { capabilities: { master_control: false } };

test('server-resolved Recruiting Admin capability lands on Master Control', () => {
  assert.equal(resolveAuthenticatedRecruitingLanding({
    pathname: '/recruiting/home',
    manager: admin,
  }), RECRUITING_ADMIN_LANDING_PATH);
});

test('explicit Admin workspace entry remains on the manager journey', () => {
  assert.equal(resolveAuthenticatedRecruitingLanding({
    pathname: '/recruiting/home',
    search: '?view=workspace',
    manager: admin,
  }), null);
  assert.equal(RECRUITING_MANAGER_WORKSPACE_PATH, '/recruiting/home?view=workspace');
});

test('standard managers and unauthenticated state never receive an Admin landing', () => {
  assert.equal(resolveAuthenticatedRecruitingLanding({
    pathname: '/recruiting/home',
    manager,
  }), null);
  assert.equal(resolveAuthenticatedRecruitingLanding({
    pathname: '/recruiting/home',
  }), null);
});

test('the capability does not redirect arbitrary Recruiting routes', () => {
  for (const pathname of ['/recruiting/invite', '/recruiting/demo', '/recruiting/master-control']) {
    assert.equal(resolveAuthenticatedRecruitingLanding({ pathname, manager: admin }), null);
  }
});
