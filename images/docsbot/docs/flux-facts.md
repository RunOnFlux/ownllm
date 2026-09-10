# Flux application limits and pricing (generated from FluxOS source)

Generated from `ZelBack/config/default.js` and `appValidator.js`. These are the
values FluxOS enforces, not a description of them.

## Resources available to an application, by node tier

A node reserves some of its capacity for the system, so an application can use
the tier total minus what is locked.

| tier | CPU cores | RAM (MB) | SSD (GB) | collateral (FLUX) |
|---|---|---|---|---|
| cumulus | 3 | 5000 | 160 | 1,000 |
| nimbus | 7 | 28000 | 380 | 12,500 |
| stratus | 15 | 59000 | 820 | 40,000 |

An application larger than **7 cores or 28000 MB** cannot be placed on a nimbus node and is restricted to stratus nodes, which reduces the number of machines that can host it.

## Validation rules

- `cpu` must be a multiple of 0.1, minimum 0.1.
- `ram` must be a multiple of 100, minimum 100.
- `hdd` must be a whole number of GB, minimum 1.
- The container image must be 5 GB or smaller.
- The container root filesystem is capped at 10 GB; persistent data belongs on the mounted volume.
- Application and component names may contain only letters and digits, and must not start with `flux` or `zel`.
- `ports`, `containerPorts` and `domains` must be the same length, maximum 5 each.
- Maximum 20 environment variables and 20 commands per component, each at most 400 characters.
- `containerData` must be 2 to 200 characters.

## Instances and lifetime

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

## Ports

- Allowed range: 1 to 65535.
- Banned entirely: 16100-16299, 26100-26299, 30000-30099, 8384, 27017, 22, 23, 25, 3389, 5900, 5800, 161, 512, 513, 5901, 3388, 4444, 123, 53.
- Charged an extra fee: 0-1023, 8080, 8081, 8443, 6667.

## Pricing

Two prices exist and they are not the same number.

**Consensus price** — what nodes verify a payment against, in FLUX per month:

- 0.03 per 0.1 CPU core
- 0.01 per 100 MB RAM
- 0.004 per GB SSD
- 0.8 extra for an enterprise application or one targeting specific nodes
- 0.4 extra for a static IP, 0.4 per surcharged port
- minimum 0.01 FLUX
- the total is divided by 3, then multiplied by the number of instances

**Marketplace price** — what Flux Home quotes, in USD per month:

- 0.15 per 0.1 CPU core, 0.05 per 100 MB RAM, 0.02 per GB SSD
- 4 extra for enterprise, 2 for static IP, 2 per surcharged port
- minimum $0.99; paying in FLUX applies a 5% discount

Worked example — 9.5 cores, 28000 MB, 67 GB, enterprise, 1 instance, one month:

- consensus: 2.24 FLUX
- marketplace: $11.20

## Enterprise applications

- Setting `enterprise` to an encrypted blob encrypts the whole compose section, so environment variables and private registry credentials never appear on the public chain.
- Enterprise applications can only be validated and run on nodes running ArcaneOS.
- Every component must support the amd64 architecture.
- Only enterprise applications may target specific nodes.

## Networking between components

Every application gets its own docker network. A component reaches another component of the same application at `flux<component>_<appname>` on its container port, with nothing published.

_Generated 2026-09-10 from FluxOS config; regenerate when the source changes._
