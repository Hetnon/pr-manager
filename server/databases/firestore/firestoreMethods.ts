import * as userMethods from './users/userMethods.js';
import * as userSessionMethods from './sessions/sessionMethods.js';
import * as observabilityMethods from './observability/observabilityMethods.js';

const firestoreMethods = {
    ...userMethods,
    ...userSessionMethods,
    ...observabilityMethods,
};

export default firestoreMethods;
