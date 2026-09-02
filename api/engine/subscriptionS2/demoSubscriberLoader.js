import { loadProductionIntendedSyntheticSubscriber } from '../subscriptionV1/internalDevSubscriberLoader.js';
import { loadPatriciaDerivedDemoSubscriber } from './patriciaDemoSubscriberLoader.js';
import {
  PATRICIA_DEMO_RELATIONSHIP_KEY,
  PATRICIA_DEMO_SUBJECT_KEY,
  SYNTHETIC_DEMO_SUBJECT_KEY,
} from './demoSubjectAuthority.js';

export async function loadAuthorizedSubscriptionDemoSubscriber(args) {
  if (args?.subject_key === SYNTHETIC_DEMO_SUBJECT_KEY) {
    return loadProductionIntendedSyntheticSubscriber(args);
  }
  if (args?.subject_key === PATRICIA_DEMO_SUBJECT_KEY
    && args?.relationship_key === PATRICIA_DEMO_RELATIONSHIP_KEY) {
    return loadPatriciaDerivedDemoSubscriber(args);
  }
  throw new Error('SUBSCRIPTION_DEMO_SUBJECT_SCOPE_DENIED');
}
