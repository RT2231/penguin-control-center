# Contributing to Penguin Control Center

PCCへの貢献に興味を持っていただきありがとうございます。
本体（コア機能）へのPRと、プラグインの公開（追加）で流れが少し異なるため、それぞれ説明します。

## 共通の準備

```bash
gh repo fork RT2231/penguin-control-center --clone
cd penguin-control-center
npm install
```

ブランチはプレフィックスで種別を分けてください。

| プレフィックス | 用途 |
|---|---|
| `feat/` | 新機能 |
| `fix/` | バグ修正 |
| `plugin/` | プラグイン追加・更新 |
| `docs/` | ドキュメントのみの変更 |

コミットメッセージは `feat: xxxを追加` のように種別を先頭に書いてください。

---

## 1. 本体（コア）へのPR

対象: `main.js` / `preload.js` / `core/` / `renderer/` など。

### コーディング規約

- コマンド実行は必ず `child_process.execFile` に**配列**で渡す。シェル文字列の組み立て（`exec`）は禁止。
- レンダラーからNode APIやOSへ直接アクセスするコードを追加しない（`contextIsolation: true` を維持）。
- 新しいIPCチャネルを追加する場合、`main.js`側で「宣言されたプラグイン・アクションのみ実行可能」という制約を必ず維持する。

### PR前のチェック

```bash
# 単体テスト
npm test

# 全JS/JSONファイルの構文チェック
for f in main.js preload.js core/*.js renderer/*.js plugins/*/*.js; do node --check "$f" || echo "NG: $f"; done
```

### PR作成

```bash
git checkout -b feat/xxx
# 変更...
git add -A && git commit -m "feat: xxxを追加"
git push -u origin feat/xxx
gh pr create --title "feat: xxx" --body "## 変更内容\n...\n## 動作確認\n..." --base main
```

PR本文には「何を」「なぜ」変更したか、UIに関わる変更ならスクリーンショットを添えてください。

---

## 2. プラグインの公開（追加）

プラグインストア（公式サイト）への掲載は、**誰でも自由にPRでマージできる形ではなく、
[プラグイン提案Issue](https://github.com/RT2231/penguin-control-center/issues/new?template=plugin-proposal.md)
での提案 → PCC公式（メンテナ）による審査・採用** という流れで行っています。
提案が採用されると、メンテナが `plugins/` に追加し、公式サイトの
[プラグインストア](https://rt2231.github.io/penguin-control-center/store.html) に掲載されます。

以下は「どんな内容を用意すればよいか」の仕様です。Issueにこの形式で貼っていただくとスムーズです。

```
plugins/<id>/
├── plugin.json   # 必須: マニフェスト
├── docs.md       # 推奨: ドキュメントタブに表示される
└── handler.js    # 任意: 複雑な処理が必要な場合のみ
```

### plugin.json 必須項目

| フィールド | 説明 |
|---|---|
| `id` | 一意な識別子（ディレクトリ名と一致させる） |
| `name` | GUI表示名 |
| `version` | セマンティックバージョン |
| `description` | 1〜2文の説明 |
| `actions[]` | 各アクション。`id` / `label` / `cli`(配列) / `privileged`(bool) |
| `service.systemdUnit` | ログタブ・状態確認に使う場合は指定 |
| `service.configPath` | 設定ファイルタブに使う場合は指定 |

### セキュリティレビュー基準（レビュー時に確認します）

1. `cli` が配列であり、シェル文字列を含まないこと（パイプ `|` やリダイレクト `>` を1つの文字列に埋め込んでいないこと）
2. システムを破壊しうる操作（`rm -rf`、ディスクフォーマット等）を含まないこと
3. `privileged: true` が本当に特権が必要な操作にのみ付与されていること
4. `docs.md` に最低限「概要」「主なCLIコマンド」「よくあるトラブル」があること

### 提案方法

コードを書ける方は、上記の `plugin.json` / `docs.md` を実際に作成してから
[プラグイン提案Issue](https://github.com/RT2231/penguin-control-center/issues/new?template=plugin-proposal.md)
に貼り付けてください。コードを書けない方も、対応してほしいソフトウェア名と欲しい操作を書くだけでOKです。

採用されると、メンテナが `plugins/` への追加・公式サイトのプラグインストアへの掲載までを行います。

---

## Issue報告

バグ報告・機能要望は [Issues](https://github.com/RT2231/penguin-control-center/issues) へお願いします。
バグ報告の場合は以下を含めてください: ディストリビューション名/バージョン、Node.jsバージョン、再現手順、期待した動作と実際の動作。
