#!/bin/bash
# ツール呼び出しをログファイルに記録するフック
# PreToolUse イベントで stdin から JSON を受け取り、ツール名と入力を記録する

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude"
LOG_FILE="${LOG_DIR}/tool-log.jsonl"

INPUT=$(cat)

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# ツール固有の要約を生成
case "$TOOL_NAME" in
  Bash)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.command // ""' | head -c 200)
    ;;
  Edit|Write|Read)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
    ;;
  Glob)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
    ;;
  Grep)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
    ;;
  WebFetch)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.url // ""')
    ;;
  WebSearch)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.query // ""')
    ;;
  Agent)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.description // .tool_input.agent_name // ""')
    ;;
  Skill)
    SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.skill // ""')
    ;;
  *)
    SUMMARY=$(echo "$INPUT" | jq -c '.tool_input // {}' | head -c 200)
    ;;
esac

# JSONL 形式で追記
jq -n \
  --arg ts "$TIMESTAMP" \
  --arg tool "$TOOL_NAME" \
  --arg summary "$SUMMARY" \
  --arg session "$SESSION_ID" \
  '{timestamp: $ts, tool: $tool, summary: $summary, session: $session}' \
  >> "$LOG_FILE"

exit 0
