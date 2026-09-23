/**
 * The tool surface the assistant gets when it runs INSIDE the FluxCloud web UI
 * (fluxcloud-web), rather than talking to the network on its own.
 *
 * Two things make this surface different from tools-compact.js, and both come
 * from the UI's own rules (fluxcloud-web/CLAUDE.md):
 *
 *   1. "the assistant can never sign" - anything that spends goes through the
 *      UI's signMessage and payment helpers. So there is no deploy tool here.
 *      The assistant prepares a specification and hands it to the page with
 *      ui_prefill_deploy; the person reviews the quote and signs.
 *   2. The assistant can move the user around the app, because the page can
 *      navigate itself. The routes below are the real ones in src/routes.
 *
 * Everything else it does here is read-only: price something, look an app up,
 * read logs, report network facts.
 */
const ROUTES = [
  '/', '/deploy', '/deploy/git', '/templates', '/templates/games', '/templates/wordpress',
  '/deployments', '/apps', '/account', '/balance', '/drive', '/storage', '/gpu', '/agents',
  '/network', '/network/nodes', '/node', '/node/apps', '/node/logs', '/node/sessions',
  '/node/share', '/node/system', '/governance', '/compare', '/cost-calculator', '/help',
];

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

module.exports = [
  { type: 'function',
    function: {
      name: 'ui_navigate',
      description: 'Move the user to a page of the app.',
      parameters: { type: 'object', required: ['to'], properties: { to: { type: 'string', enum: ROUTES } } },
    } },
  { type: 'function',
    function: {
      name: 'ui_open_app',
      description: "Open one of the user's deployed applications.",
      parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    } },
  { type: 'function',
    function: {
      name: 'ui_open_template',
      description: 'Open a marketplace template by its slug.',
      parameters: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
    } },
  { type: 'function',
    function: {
      name: 'flux_get_template',
      description: 'Look up a marketplace template and return its exact specification: image, ports, environment, resources, instance count and containerData. Use this before deploying anything from the marketplace instead of recalling the values, and build the spec from what it returns.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'exact template name, e.g. Minecraft9GB or Palworld8Slots' },
          search: { type: 'string', description: 'free text when the exact name is unknown, e.g. "minecraft" - returns the matching templates and their sizes' },
          category: { type: 'string', description: 'list a whole category: Games, NewGames, Blockchain, Productivity, Masternode, Front-end, Hosting' },
        },
      },
    } },
  { type: 'function',
    function: {
      name: 'ui_prefill_deploy',
      description: 'Open the deploy page with the form filled in from this specification. The user reviews the quote and signs; you never deploy or pay.',
      parameters: {
        type: 'object',
        required: ['name', 'components'],
        properties: {
          name: { type: 'string', description: 'letters, digits, inner hyphens; not starting with flux or zel' },
          description: { type: 'string' },
          components: { type: 'array', items: COMPONENT, description: 'one entry per component, up to 10' },
          instances: { type: 'integer', description: '1-100, default 3' },
          months: { type: 'number', description: 'term, default 1' },
          contacts: { type: 'array', items: { type: 'string' }, description: 'email addresses notified about the app, e.g. expiry warnings' },
          geolocation: { type: 'array', items: { type: 'string' }, description: 'e.g. acEU, acNA, acAS' },
        },
      },
    } },
  { type: 'function',
    function: {
      name: 'flux_validate_spec',
      description: 'Ask a FluxOS node to check a specification exactly as it would at registration: image reachable and the right architecture, ports usable, name available. Run it before handing anything to the deploy form, so a bad image or a taken name is caught here rather than after the user signs.',
      parameters: {
        type: 'object',
        required: ['components'],
        properties: {
          name: { type: 'string' },
          components: { type: 'array', items: COMPONENT },
          instances: { type: 'integer' },
        },
      },
    } },
  { type: 'function',
    function: {
      name: 'flux_check_image',
      description: 'Check that a Docker image and tag exist and expose a linux/amd64 build, and report its size. Use it whenever an image was not taken from a template or given by the user verbatim.',
      parameters: { type: 'object', required: ['repotag'], properties: { repotag: { type: 'string', description: 'image with tag, e.g. nginx:1.27' } } },
    } },
  { type: 'function',
    function: {
      name: 'flux_get_app_stats',
      description: "Live CPU, memory and network use of a running app's containers. Use it before advising on size rather than guessing whether an app is over- or under-provisioned.",
      parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, component: { type: 'string' } } },
    } },
  { type: 'function',
    function: {
      name: 'flux_get_pricing',
      description: 'Current USD rate card and FLUX/USD rate.',
      parameters: { type: 'object', properties: {} },
    } },
  { type: 'function',
    function: {
      name: 'flux_quote_app',
      description: 'USD price per term for a set of components, without deploying anything.',
      parameters: {
        type: 'object',
        required: ['components'],
        properties: {
          components: { type: 'array', items: COMPONENT },
          instances: { type: 'integer' },
          months: { type: 'number' },
        },
      },
    } },
  { type: 'function',
    function: {
      name: 'flux_list_my_apps',
      description: "The user's apps with expiry and instance counts.",
      parameters: { type: 'object', properties: {} },
    } },
  { type: 'function',
    function: {
      name: 'flux_get_app',
      description: 'Spec and running instances of any app by name.',
      parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    } },
  { type: 'function',
    function: {
      name: 'flux_get_app_logs',
      description: 'Last lines of an app log.',
      parameters: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, component: { type: 'string' }, lines: { type: 'integer' } },
      },
    } },
  { type: 'function',
    function: {
      name: 'flux_search_docs',
      description: 'Search the Flux, Zelcore and SSP documentation. Use this for any factual question about how Flux works - products, limits, prices, features - and answer from what it returns, with citations. Do not answer such questions from memory.',
      parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
    } },
  { type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the public web for things outside the Flux documentation: what a piece of software does, which image to use, current events.',
      parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
    } },
  { type: 'function',
    function: {
      name: 'flux_get_network_info',
      description: 'Node counts by tier, block height, FLUX/USD rate.',
      parameters: { type: 'object', properties: {} },
    } },
];

module.exports.ROUTES = ROUTES;
