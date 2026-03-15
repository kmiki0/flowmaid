---
name: bug-fix
description: バグ・エラー・予期しない動作の修正フロー。エラーメッセージやバグ報告を受けたとき、bug-detectiveで原因調査してから修正する。
allowed-tools: Read, Edit, Grep, Glob, Agent
argument-hint: "[バグ・エラーの概要]"
---

# バグ修正フロー

バグ概要：$ARGUMENTS

## ステップ1: 原因調査（bug-detective）

Agent ツールで bug-detective エージェントを呼び出し、以下を特定する：
- エラーメッセージのトレース
- NullReference・未初期化変数の原因
- 初期化順序の問題
- モジュール間の依存関係エラー

## ステップ2: 修正方針の確認

bug-detective の調査結果をユーザーに報告し、修正方針を確認する。
影響範囲が広い場合は特に確認が必要。

## ステップ3: 修正実装

プロジェクト規約を守って修正する：
- **ファイル修正は Edit ツールで差分編集**（フル書き換え禁止）
- 修正前に対象ファイルを Read して最新状態を確認
- 禁止パターンを混入しないこと

## ステップ4: レビュー（code-reviewer）

修正後、Agent ツールで code-reviewer エージェントを呼び出してレビューを受ける。

## ステップ5: 完了報告

修正内容と根本原因を簡潔に報告する。
必要に応じて `specs/undecided.md` に関連する未決定事項を追記する。
