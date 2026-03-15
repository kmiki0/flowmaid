---
name: permissions-review
description: セッション中のツール使用履歴と現在の権限設定を分析し、settings.local.json に追加すべき許可ルールを提案する。
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash(wc:*), Bash(jq:*)
---

# 権限レビューワークフロー

以下を順に実施すること：

## 1. 現在の権限設定を読み取る

`.claude/settings.local.json` を Read で開き、`permissions.allow` の一覧を整理して表示する。

出力形式：
```
📋 現在の許可済みルール:
- Bash(python3:*) ... Python3 の実行
- Skill(implement) ... /implement スキル
  ...
```

## 2. ツール使用ログを分析する（存在する場合）

`.claude/tool-log.jsonl` が存在すれば Read で読み取り、以下を集計する：

- ツール別の呼び出し回数
- Bash ツールのコマンド別集計（コマンド名でグルーピング）
- 今回のセッションで使われたが `permissions.allow` に含まれていないツール/コマンド

出力形式：
```
📊 ツール使用統計:
| ツール | 回数 | 例 |
|--------|------|------|
| Bash   | 15   | git status, npm test, ... |
| Edit   | 8    | src/main.ts, ... |
  ...

⚠️ 許可未設定のコマンド:
- Bash(git:*) ... 5回使用
- Bash(npm:*) ... 3回使用
```

## 3. 追加すべき許可ルールを提案する

ログ分析結果を踏まえ、`settings.local.json` に追加すべきルールを提案する。

提案基準：
- セッション中に3回以上使用されたコマンドは許可候補
- セキュリティリスクの高いコマンド（rm, chmod, chown, sudo 等）は除外し、注意喚起する
- Bash コマンドは `Bash(コマンド名:*)` 形式で提案する

出力形式：
```
💡 追加推奨:
  "Bash(git:*)"     ... git コマンド全般（N回使用）
  "Bash(npm:*)"     ... npm コマンド全般（N回使用）

⚠️ 注意（自動追加しません）:
  "Bash(rm:*)"      ... ファイル削除（リスク高）
```

## 4. ユーザーに確認する

提案したルールをユーザーに提示し、どれを追加するか確認する。
ユーザーが承認したルールのみ `settings.local.json` に Edit で追加する。

## 5. ログのクリア確認

ツール使用ログ `.claude/tool-log.jsonl` をクリアするかユーザーに確認する。
承認された場合、ファイルの内容を空にする。
