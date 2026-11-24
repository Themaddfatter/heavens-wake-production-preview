// Set only by the production deployment after provisioning a verified HTTPS relay.
// Never accept a relay endpoint from an operator or query parameter: Firebase
// authentication tokens and stream keys must only go to this trusted service.
export const HOSTED_RELAY_ENDPOINT = null;
