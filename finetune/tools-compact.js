/**
 * The tool surface the fine-tuned agent is trained on and served with.
 *
 * Derived from the Flux Cloud MCP (mcp.runonflux.com) with two changes that
 * are the point of the exercise: no key parameters - the app holds the keys
 * and injects them - and one-line descriptions with only the properties the
 * agent uses, so the schema costs ~700 tokens instead of ~6,700. The model
 * learns the conventions (MB for ram, GB for hdd, 0.1-core steps, quote
 * before deploy) from the training data, not from prose in the schema.
 */
const COMPONENT = {
  type: 'object',
  required: ['image', 'cpu', 'ram', 'hdd'],
  properties: {
    name: { type: 'string' },
    image: { type: 'string', description: 'Docker image with tag' },
    ports: { type: 'array', items: { type: 'integer' }, description: 'container ports to publish' },
    env: { type: 'array', items: { type: 'string' }, description: 'KEY=value' },
    cpu: { type: 'number', description: 'cores, 0.1 steps' },
    ram: { type: 'integer', description: 'MB, multiple of 100' },
    hdd: { type: 'integer', description: 'GB' },
  },
};
const SPEC = { type: 'object', description: 'the spec returned by flux_build_spec' };

module.exports = [
  { type: 'function', function: { name: 'flux_get_pricing', description: 'Current USD rate card and FLUX/USD rate.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'flux_build_spec', description: 'Build a valid app specification from images, ports and resources.', parameters: { type: 'object', required: ['name', 'components'], properties: {
    name: { type: 'string', description: 'letters, digits, inner hyphens; not starting with flux or zel' },
    description: { type: 'string' },
    components: { type: 'array', items: COMPONENT },
    instances: { type: 'integer', description: '1-100, default 3' },
    months: { type: 'number', description: 'term, default 1' },
    contacts: { type: 'array', items: { type: 'string' }, description: 'email addresses notified about the app' },
    geolocation: { type: 'array', items: { type: 'string' }, description: 'e.g. acEU, acNA, acAS' },
    staticip: { type: 'boolean' },
  } } } },
  { type: 'function', function: { name: 'flux_quote_app', description: 'USD price per term for a spec. Always before deploying.', parameters: { type: 'object', required: ['spec'], properties: { spec: SPEC } } } },
  { type: 'function', function: { name: 'flux_deploy_app', description: 'Register the app and pay. Spends FLUX only with confirm=true, after the user agreed to the quote.', parameters: { type: 'object', required: ['spec'], properties: { spec: SPEC, confirm: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'flux_wait_for_app', description: 'Wait until the app is running and return its URL.', parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, timeoutSeconds: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'flux_list_my_apps', description: "The user's apps with expiry and instance counts.", parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'flux_get_app', description: 'Spec and running instances of any app by name.', parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } },
  { type: 'function', function: { name: 'flux_get_app_logs', description: 'Last lines of an app log.', parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, component: { type: 'string' }, lines: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'flux_control_app', description: 'restart, redeploy (pull image again), stop or start an app.', parameters: { type: 'object', required: ['name', 'action'], properties: { name: { type: 'string' }, action: { type: 'string', enum: ['restart', 'redeploy', 'stop', 'start'] } } } } },
  { type: 'function', function: { name: 'flux_cancel_app', description: 'End an app early. Only with confirm=true after the user agreed.', parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, confirm: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'flux_search_docs', description: 'Search the Flux, Zelcore and SSP documentation. Use it for any factual question about how Flux works and answer from what it returns; never from memory.', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } } } },
  { type: 'function', function: { name: 'web_search', description: 'Search the public web for things outside the Flux docs: what a piece of software is, which image to use.', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } } } },
  { type: 'function', function: { name: 'flux_get_network_info', description: 'Node counts by tier, block height, FLUX/USD rate.', parameters: { type: 'object', properties: {} } } },
];
