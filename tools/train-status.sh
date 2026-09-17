#!/bin/sh
# Progress, speed and finish estimate for an mlx-lm LoRA run.
#   sh tools/train-status.sh [log=/tmp/mac-tinyh-train.log] [total_iters=9700]
LOG=${1:-/tmp/mac-tinyh-train.log}; TOTAL=${2:-9700}
START=$(grep -m1 "run start" "$LOG" | sed -E 's/.*start ([0-9]{2}:[0-9]{2}:[0-9]{2}).*/\1/')
NOW=$(date +%s)
[ -n "$START" ] && S=$(date -j -f "%H:%M:%S" "$START" +%s 2>/dev/null) || S=$NOW
[ "$S" -gt "$NOW" ] && S=$((S-86400))
ELAPSED=$((NOW-S))
# mlx-lm 0.32 table rows: "<iter>  <train loss> ▼|▲  <tok/s>  <trained tokens>" and "<iter>  val <loss>  <secs>s"
LASTTRAIN=$(grep -E "^\s*[0-9]+\s+[0-9.]+ [▼▲]" "$LOG" | tail -1)
LASTVAL=$(grep -E "^\s*[0-9]+\s+val" "$LOG" | tail -1)
ITER=$(echo "$LASTTRAIN" | awk '{print $1}')
[ -z "$ITER" ] && ITER=$(echo "$LASTVAL" | awk '{print $1}')
[ -z "$ITER" ] && ITER=0
if [ "$ITER" -gt 0 ]; then
  SPI=$(echo "$ELAPSED $ITER" | awk '{printf "%.1f", $1/$2}')
  LEFT=$(echo "$ELAPSED $ITER $TOTAL" | awk '{printf "%d", ($1/$2)*($3-$2)}')
  ETA=$(date -v+${LEFT}S "+%a %H:%M" 2>/dev/null)
  printf "iter %s/%s (%d%%)  %s s/iter  elapsed %dh%02dm  remaining ~%dh%02dm  ETA %s\n" "$ITER" "$TOTAL" $((ITER*100/TOTAL)) "$SPI" $((ELAPSED/3600)) $(((ELAPSED%3600)/60)) $((LEFT/3600)) $(((LEFT%3600)/60)) "$ETA"
else
  printf "no iteration reported yet after %dm (first report comes at iteration 50)\n" $((ELAPSED/60))
fi
[ -n "$LASTTRAIN" ] && echo "last train: $(echo "$LASTTRAIN" | awk '{print "loss " $2 ", " $4 " tok/s, " $5 " tokens seen"}')"
[ -n "$LASTVAL" ] && echo "last val:   $(echo "$LASTVAL" | awk '{print "loss " $3}')"
ls -t "$(dirname "$LOG")" >/dev/null 2>&1
CK=$(ls -t ~/repos/flux-llm/runs/${3:-tinyh-mac-v1}/adapter/*.safetensors 2>/dev/null | head -1)
[ -n "$CK" ] && echo "last checkpoint: $(basename "$CK") $(date -r "$CK" +%H:%M)"

exit 0
