---
name: release
description: リリースフロー。CHANGELOG.md更新 + gitタグ + GitHub Release作成 + 関連Issueへコメント&クローズを一括実行する。
allowed-tools: Read, Edit, Write, Bash, Agent
argument-hint: "[バージョン番号 例: 0.2.0]"
---

# リリースフロー

リリースバージョン：$ARGUMENTS

## ステップ1: リリース対象の確認

以下を実行して、前回リリースからの変更内容を把握する：

1. `git tag --list --sort=-v:refname` で最新タグを確認
2. 最新タグがなければ初回リリース、あれば `git log <最新タグ>..HEAD --oneline` で差分コミットを取得
3. `gh issue list --state all --limit 50` で関連Issueを確認
4. コミットメッセージから関連Issue番号（`#XX`）を抽出

ユーザーにリリース内容の一覧を表示し、確認を取る。

## ステップ2: CHANGELOG.md 更新

`CHANGELOG.md` を Read し、`[Unreleased]` セクションの内容を新バージョンセクションに移動する：

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- 新機能の説明 (#Issue番号)

### Fixed
- バグ修正の説明 (#Issue番号)

### Changed
- 変更の説明 (#Issue番号)
```

ルール：
- `[Unreleased]` セクションは空にして残す
- 各項目にはIssue番号を `(#XX)` 形式で付与
- カテゴリは Keep a Changelog 準拠: Added, Fixed, Changed, Deprecated, Removed, Security

Edit ツールで差分編集する（フル書き換え禁止）。

## ステップ3: コミット & タグ作成

```bash
git add CHANGELOG.md
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main --follow-tags
```

## ステップ4: GitHub Release 作成

CHANGELOG.md の該当バージョンセクションの内容をボディに使って GitHub Release を作成する：

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(cat <<'EOF'
## What's Changed

（CHANGELOG.mdの該当セクション内容をここに貼る）

**Full Changelog**: https://github.com/kmiki0/flowmaid/compare/前タグ...vX.Y.Z
EOF
)"
```

## ステップ5: 関連Issueへのコメント & クローズ

リリースに含まれる各Issueに対して、以下を実行する：

### 5a. Issueにコメント

各関連Issueに対して `gh issue comment` でリリース情報をコメントする：

```bash
gh issue comment <Issue番号> --body "$(cat <<'EOF'
## ✅ Released in vX.Y.Z

**リリース**: [vX.Y.Z](https://github.com/kmiki0/flowmaid/releases/tag/vX.Y.Z)

### 修正内容
- （このIssueに関連する修正の簡潔な説明）

### 関連コミット
- [`<短縮SHA>`](https://github.com/kmiki0/flowmaid/commit/<フルSHA>) <コミットメッセージ>

---
🚀 Cloudflare Pages に自動デプロイ済み
EOF
)"
```

### 5b. Issueクローズ

コミットメッセージで `Fixes #XX` していない場合は手動クローズする：

```bash
gh issue close <Issue番号> --reason completed
```

※ 既にクローズ済みのIssueはスキップする。

## ステップ6: 完了報告

リリース内容をサマリとして報告する：
- バージョン番号
- 変更内容一覧
- クローズしたIssue一覧
- GitHub Release URL
- 注意事項があれば追記
