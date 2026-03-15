#!/bin/bash
input=$(cat)

# jqなしでJSONからフィールドを抽出する関数
get_field() {
  echo "$input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\?\([^,\"}\n]*\)\"\?.*/\1/p" | head -1
}

MODEL=$(get_field "display_name")
MODEL_ID=$(get_field "id")
PCT=$(get_field "used_percentage")
COST=$(get_field "total_cost_usd")
DURATION_MS=$(get_field "total_duration_ms")
CTX_SIZE=$(get_field "context_window_size")
AGENT=$(get_field "name")

# デフォルト値
PCT=${PCT:-0}
PCT=${PCT%%.*}
COST=${COST:-0}
DURATION_MS=${DURATION_MS:-0}
CTX_SIZE=${CTX_SIZE:-0}

# モデル名から最大出力トークンを判定
case "$MODEL_ID" in
  *opus*)   MAX_OUTPUT="32K" ;;
  *sonnet*) MAX_OUTPUT="16K" ;;
  *haiku*)  MAX_OUTPUT="8K" ;;
  *)        MAX_OUTPUT="??" ;;
esac

# コンテキストウィンドウサイズを整形 (例: 200000 -> 200K)
if [ "$CTX_SIZE" -gt 0 ] 2>/dev/null; then
  CTX_FMT="$((CTX_SIZE / 1000))K"
else
  CTX_FMT="--"
fi

# カラー
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
GRAY='\033[90m'
RESET='\033[0m'

# コンテキスト使用率に応じた色
if [ "$PCT" -ge 80 ] 2>/dev/null; then
  BAR_COLOR="$RED"
elif [ "$PCT" -ge 50 ] 2>/dev/null; then
  BAR_COLOR="$YELLOW"
else
  BAR_COLOR="$GREEN"
fi

# プログレスバー (幅15)
BAR_WIDTH=15
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
for ((i=0; i<FILLED; i++)); do BAR="${BAR}█"; done
for ((i=0; i<EMPTY; i++)); do BAR="${BAR}░"; done

# コスト整形
COST_FMT=$(printf '$%.2f' "$COST" 2>/dev/null || echo '$0.00')

# 経過時間
SECS=$((DURATION_MS / 1000))
MINS=$((SECS / 60))
SECS=$((SECS % 60))

# エージェント名（空なら非表示）
AGENT_FMT=""
if [ -n "$AGENT" ]; then
  AGENT_FMT=" ${GREEN}${AGENT}${RESET} "
fi

# 現在時刻
NOW=$(date '+%H:%M')

echo -e "${CYAN}${MODEL}${RESET}${AGENT_FMT} ${BAR_COLOR}${BAR}${RESET} ${PCT}% ${GRAY}In:${CTX_FMT} Out:${MAX_OUTPUT}${RESET} ${YELLOW}${COST_FMT}${RESET} ${GRAY}${MINS}m${SECS}s ${NOW}${RESET}"
