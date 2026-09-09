#!/bin/sh
# Validate a spec against live mainnet rules and get its price.
#
#   ./tools/verify.sh specs/ownllm-standard.json
#
# NOTE the text/plain content type: FluxOS reads the raw request body itself,
# and a POST with Content-Type: application/json hangs until the gateway 504s.
set -e
SPEC="${1:?usage: verify.sh <spec.json>}"
NODE="${FLUX_NODE:-https://162-55-245-240-16127.node.api.runonflux.io}"

echo "== validation"
curl -s -m 60 -X POST -H 'Content-Type: text/plain' --data-binary @"$SPEC" \
  "$NODE/apps/verifyappregistrationspecifications" | head -c 400
echo
echo "== price (UI/marketplace quote)"
curl -s -m 60 -X POST -H 'Content-Type: text/plain' --data-binary @"$SPEC" \
  "$NODE/apps/calculatefiatandfluxprice"
echo
