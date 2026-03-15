---
name: implement
description: スクリプトの実装フロー。新しいスクリプトを実装するときや、既存スクリプトに機能を追加するときに使う。project-explorerで調査してから実装し、code-reviewerでレビューする。
allowed-tools: Read, Edit, Write, Grep, Glob, Agent
argument-hint: "[実装したい機能名]"
---

# 実装フロー

実装対象：$ARGUMENTS

## ステップ1: 事前調査（project-explorer）

Agent ツールで project-explorer エージェントを呼び出し、以下を把握する：
- 関連する既存スクリプト
- 依存モジュール
- 実装場所（どのファイルに書くか）

## ステップ2: 仕様確認

実装前に以下を確認する：
- `specs/` の関連ファイルを Read して仕様と矛盾しないか確認
- `specs/undecided.md` で未決定事項がないか確認
- 不明点があればユーザーに確認してから進む

## ステップ3: 実装

プロジェクト規約を守って実装する：
- **禁止**：マジックナンバーの直接記述（定数化する）
- ファイル修正は **Edit ツールで差分編集**（フル書き換え禁止）
- 修正前に対象ファイルを Read して最新状態を確認

## ステップ4: レビュー（code-reviewer）

実装完了後、Agent ツールで code-reviewer エージェントを呼び出してレビューを受ける。
指摘があれば修正する。

## ステップ5: 完了報告

実装内容を簡潔に報告し、`/session-end` の実行を促す。
