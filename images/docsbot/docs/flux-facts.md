# Flux application limits and pricing (generated from FluxOS source)

Generated from `ZelBack/config/default.js` and `appValidator.js`. These are the
values FluxOS enforces, not a description of them.

## Maximum resources an application can use, by node tier <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components>

An application (all of its components together) may use at most:

| node tier | CPU cores | RAM (MB) | SSD (GB) |
|---|---|---|---|
| cumulus | 3 | 5000 | 160 |
| nimbus | 7 | 28000 | 380 |
| stratus | 15 | 59000 | 820 |

An application needing more than **7 cores or 28000 MB RAM** can only run on stratus nodes, which reduces the number of machines that can host it.

## Validation rules <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/general>

- `cpu` must be a multiple of 0.1, minimum 0.1.
- `ram` must be a multiple of 100, minimum 100.
- `hdd` must be a whole number of GB, minimum 1.
- The container image must be 5 GB or smaller.
- The container root filesystem is capped at 10 GB; persistent data belongs on the mounted volume.
- Application and component names may contain only letters and digits, and must not start with `flux` or `zel`.
- `ports`, `containerPorts` and `domains` must be the same length, maximum 5 each.
- Maximum 20 environment variables and 20 commands per component, each at most 400 characters.
- `containerData` must be 2 to 200 characters.

## Instances and lifetime <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/general>

- An application may have between 1 and 100 instances (v8 or later).
- Minimum lifetime is 1 block; maximum is 1,056,000 blocks.
- A block takes about 30 seconds since the PON fork, so:
  - 1 block is about **1 minute**
  - 100 blocks are about **50 minutes**
  - 2,000 blocks are about **16.7 hours**
  - 22,000 blocks are about **7.6 days**
  - 88,000 blocks are about **30.6 days**
  - 264,000 blocks are about **3.0 months**
  - 1,056,000 blocks are about **12.0 months**
- 88,000 blocks is the figure pricing treats as one month.

## Ports <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components>

- Allowed range: 1 to 65535.
- Banned entirely: 16100-16299, 26100-26299, 30000-30099, 8384, 27017, 22, 23, 25, 3389, 5900, 5800, 161, 512, 513, 5901, 3388, 4444, 123, 53.
- Charged an extra fee: 0-1023, 8080, 8081, 8443, 6667.

## Pricing <https://docs.runonflux.com/fluxcloud/cost-calculator>

Applications are priced per month from the resources each component declares, in USD (Flux Cloud shows the exact quote before you sign; paying in FLUX applies a 5% discount):

- $1.50 per CPU core (0.15 per 0.1 core)
- $0.50 per GB of RAM (0.05 per 100 MB)
- $0.02 per GB of SSD
- $4.00 extra per month for an enterprise application (private images, secrets, targeting specific nodes)
- $2.00 extra for a static IP, $2.00 per surcharged port
- minimum $0.99 per month; the total is divided by 3, then multiplied by the number of instances

Worked example — 9.5 cores, 28000 MB RAM, 67 GB SSD, enterprise, 1 instance, one month:

- about $11.20 per month

## Enterprise applications <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/general>

- Setting `enterprise` to an encrypted blob encrypts the whole compose section, so environment variables and private registry credentials never appear on the public chain.
- Enterprise applications can only be validated and run on nodes running ArcaneOS.
- Every component must support the amd64 architecture.
- Only enterprise applications may target specific nodes.

## Networking between components <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components>

Every application gets its own docker network. A component reaches another component of the same application at `flux<component>_<appname>` on its container port, with nothing published.

_Generated 2026-09-14 from FluxOS config; regenerate when the source changes._
