---
name: new-feature
description: 新機能の追加フロー。新しい機能を実装するとき、feature-plannerで設計→ユーザー承認→実装の順で進める。
allowed-tools: Read, Edit, Write, Grep, Glob, Agent
argument-hint: "[機能名]"
---

# 新機能追加フロー

機能名：$ARGUMENTS

## ステップ1: 仕様確認

`specs/` の関連ファイルを確認する：
- 仕様書に記載があるか
- `specs/undecided.md` に未決定事項がないか
- 仕様と矛盾する点がないか

仕様が不明・未決定の場合は**実装前にユーザーに確認する**。

## ステップ2: 設計（feature-planner）

Agent ツールで feature-planner エージェントを呼び出し：
- 実装方針・変更が必要なファイルを分析
- 既存モジュールの再利用方法を検討
- `specs/` に仕様書を作成または更新

## ステップ3: ユーザー承認

feature-planner が作成した設計をユーザーに提示し、承認を得てから実装に進む。
影響範囲が広い場合は特に慎重に確認する。

## ステップ4: 実装

`/implement $ARGUMENTS` に従って実装を進める：
1. project-explorer で関連コードを調査
2. プロジェクト規約を守って実装
3. code-reviewer でレビュー

## ステップ5: 仕様書・CLAUDE.md の更新

実装完了後：
- `specs/` の該当ファイルを更新
- `CLAUDE.md` の実装状況テーブルを更新

その後 `/session-end` を実行する。
