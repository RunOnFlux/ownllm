# Flux application specification v8

## Resource limits
Maximum per application: 15 CPU cores, 59000 MB RAM, 820 GB SSD. These are the
stratus tier totals minus the resources FluxOS locks for the system.
A NIMBUS node offers applications only 7.0 cores and 28000 MB, so an app larger
than that can only be placed on STRATUS nodes.

`cpu` must be a multiple of 0.1 and at least 0.1.
`ram` must be a multiple of 100 and at least 100.
`hdd` must be a whole number of GB and at least 1.
The container image must be 5 GB or smaller, and the container root filesystem
is capped at 10 GB. Persistent data belongs in the volume mounted at
`containerData`, which is created at exactly the `hdd` size.

## Naming
Application names and component names may contain only letters and digits, and
must not start with `flux` or `zel`. Component names may be up to 63 characters.

## Instances and lifetime
An application may have between 1 and 100 instances. The minimum lifetime is
1 block and the maximum is 1056000 blocks. Since the PON fork the chain produces
a block roughly every 30 seconds, so 88000 blocks is about one month.

## Ports
Ports 0-1023 and ports 8080, 8081, 8443 and 6667 carry an additional fee.
Ports 16100-16299, 26100-26299, 30000-30099, 8384, 27017, 22, 23, 25, 3389,
5900, 5800, 161, 512, 513, 5901, 3388, 4444, 123 and 53 are banned.
`ports`, `containerPorts` and `domains` must all be the same length, maximum 5.

## Enterprise applications
Setting the `enterprise` field to an encrypted blob encrypts the whole compose
section, including environment variables and private registry credentials, so
secrets never appear on the public chain. Enterprise applications can only be
validated and run on nodes running ArcaneOS, and every component must support
the amd64 architecture. Only enterprise applications may use node targeting.

## Networking between components
Every application gets its own docker network. A component reaches another
component of the same application at `flux<component>_<appname>` on its
container port, without publishing anything.
