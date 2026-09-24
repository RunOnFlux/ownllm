/**
 * The real marketplace catalogue, and what the sync flags on it mean.
 *
 * `data/marketplace.json` is fetched from the live API by
 * `tools/fetch-marketplace.js`. Nothing in here is written from memory, because
 * writing marketplace specs from memory is exactly what went wrong: the model
 * was trained to deploy Palworld as `runonflux/palworld-server-flux` at 4 cores
 * and 16 GB on one instance, and the marketplace actually runs
 * `thijsvanloef/palworld-server-docker` at 2.5 cores and 6300 MB on three
 * instances with `containerData: "g:/palworld/Pal/Saved"`.
 *
 * The flag is the important part and it had been missing entirely. Every game
 * in the marketplace carries `g:`, and a game deployed without it loses its
 * world the first time the network reschedules an instance.
 */
const fs = require('node:fs');
const path = require('node:path');

const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'marketplace.json'), 'utf8'));
// Only offer people things the marketplace is actually offering.
const APPS = ALL.filter((a) => a.visible && a.enabled);
const byName = Object.fromEntries(ALL.map((a) => [a.name.toLowerCase(), a]));
const inCategory = (c) => APPS.filter((a) => a.category === c);
const syncMode = (cd) => (/^([rgs]+):/.exec(cd || '') || [])[1] || null;
const synced = APPS.filter((a) => a.compose.some((c) => syncMode(c.containerData)));

// Ladders: the marketplace sells one app at several sizes, and picking the right
// rung is most of the work. Grouped by the image so the model learns "Minecraft
// comes in sizes" rather than "Minecraft8GB is a thing that exists".
const LADDERS = (() => {
  const g = {};
  for (const a of APPS) {
    if (a.compose.length !== 1) continue;
    // Keyed by image AND category: the NewGames MinecraftServer shares an image
    // with the Games Minecraft ladder but is a different product (two instances,
    // asks for the server type), and mixing them produced two 2000 MB rungs.
    const key = `${a.compose[0].repotag}|${a.category}`;
    (g[key] = g[key] || []).push(a);
  }
  return Object.values(g)
    .filter((v) => v.length > 2)
    .map((v) => v.sort((x, y) => x.compose[0].ram - y.compose[0].ram));
})();

// Straight from ZelBack/src/services/utils/mountParser.js and appSpecHelpers.js.
// parseMountFlags knows exactly three: r, g and s. appSpecHelpers gives a g: app
// a 20% price reduction, which is a real and entirely non-obvious fact.
const SYNC_FLAGS = {
  g: { name: 'primary/standby', what: 'One instance is the primary and actually serves; the others hold a synchronised copy of the directory and take over if the primary goes away. Writes happen in one place, so there is one authoritative copy of the data.' },
  r: { name: 'replicated', what: 'Every instance runs and the directory is replicated between all of them. Suited to data that is appended or read far more than it is rewritten, because simultaneous writes on two nodes have to be reconciled.' },
  s: { name: 'Syncthing folder', what: 'Sets the directory up as a Syncthing folder without the primary/standby election.' },
};

const SYNC_QA = [
  { k: 'sync modes', query: 'containerData sync flags g r s master slave',
    q: ['what does the g in containerData mean', 'whats the difference between g: and r:', 'how does data sync between instances'],
    url: 'https://docs.runonflux.com/fluxcloud/register-new-app',
    doc: 'The primary mount in containerData may carry flags. The parser recognises exactly three: r for replication, g for primary/standby master-slave operation, and s for Syncthing folder setup. A component with g: has one primary instance that serves while the others hold a synchronised copy and stand by to take over. Applications using the g: flag receive a 20 percent reduction in price.',
    a: 'They are sync flags on the primary mount, and FluxOS recognises exactly three [1]:\n\n- **`g:`** primary/standby. One instance serves, the others hold a synchronised copy of that directory and take over if the primary goes away. One authoritative copy, so no write conflicts.\n- **`r:`** replicated. Every instance runs and the directory is synchronised between all of them.\n- **`s:`** sets the directory up as a Syncthing folder without the primary/standby election.\n\nSo `g:/data` means "replicate /data, run one at a time". `r:/app` means "replicate /app, run them all".\n\nTwo things worth knowing. Without a flag the directory is local to each instance, so a rescheduled instance comes back empty. And a `g:` app is **20% cheaper**, because only one copy is doing the work.',
    fu: [
      { u: 'which one do i want for a game server', a: '`g:` every time, and it is what the whole marketplace games catalogue uses. A game world is a single authoritative save. Replicating it to three instances that are all running would give you three divergent worlds and a reconciliation problem no game server is built for.\n\nWith `g:` you get three instances, one playing host, the save synchronised. When the node running it goes away, another picks the world up. That is the migration story, and it is the reason a game deployed as one plain instance eventually loses everything.' },
      { u: 'so do i still pay for three instances', a: 'You pay for three, and the `g:` flag takes 20% off the total [1], so it is not three times a single instance.\n\nWhat you are buying is that the world survives a node disappearing. On one instance with no flag, a reschedule is a wipe.' },
      { u: 'can i add the flag to an app i already deployed', a: 'Yes, it is a field on the specification, so it goes out as an update you sign. The catch is that the flag only starts replicating from the point it is applied. It does not retroactively rescue data that is already on one node.\n\nSo: take a backup first, then apply the change, then confirm the standby instances have the directory before you trust it.' },
    ] },
  { k: 'instance migration', query: 'what happens when an instance moves to another node',
    q: ['what happens to my data when an instance moves', 'will i lose my world if a node goes offline', 'does my app data survive a reschedule'],
    url: 'https://docs.runonflux.com/fluxcloud/register-new-app',
    doc: 'Applications run on multiple instances across independent nodes. If a node hosting an instance goes offline the application is rescheduled onto another eligible node. A component whose primary mount carries no sync flag keeps its data local to each instance, so a rescheduled instance starts with an empty volume. The g flag makes one instance primary with the others holding a synchronised copy.',
    a: 'It depends entirely on one character in your specification [1].\n\n**No flag on containerData.** The volume is local to each instance. A rescheduled instance is a fresh container with an empty directory, and whatever was on the old node is gone. Fine for something stateless, fatal for a database or a game save.\n\n**`g:` on containerData.** The directory is synchronised to the standby instances, so when the primary disappears another one already has the data and takes over.\n\nThat is the single most important line in a marketplace game specification, and it is why they all carry it.',
    fu: [
      { u: 'how do i check if my app has it', a: 'Open the app and look at the Specifications tab, at the component\'s `containerData`. If it reads `g:/data` you are covered. If it reads `/data` you are not.\n\nI can read it for you if you tell me the app name.' },
    ] },
];

module.exports = { ALL, APPS, byName, inCategory, syncMode, synced, LADDERS, SYNC_FLAGS, SYNC_QA };
