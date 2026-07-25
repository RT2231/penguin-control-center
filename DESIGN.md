# Penguin Control Center (PCC) — アーキテクチャ設計書 v0.2

> v0.1（chronyのみのMVP）からの主な変化: プラグイン11個・プラグインストア（公式サイト+アプリ内導入）・
> 自動テスト・配布パッケージ(.deb/AppImage)・自動アップデートに対応。詳細は各章を参照。

## 1. 全体方針

PCCは「CLI管理ソフトをGUI化しつつCLIも学べる」統合管理ツール。GUI操作と対応するCLIコマンドを
常に並べて表示することを核とし、プラグインはストア経由で追加できる構成にしている。

## 2. 技術選定

| 領域 | 採用技術 | 理由 |
|---|---|---|
| GUIフレームワーク | **Electron**（素のNode.js、TypeScriptなし） | 開発者のスキルセットがJS/Web中心のため学習コストが低い。 |
| プロセス間通信 | `contextBridge` + `ipcMain`/`ipcRenderer` | `nodeIntegration: false` / `contextIsolation: true` / `sandbox: true` を徹底。 |
| コマンド実行 | `child_process.execFile`（配列引数） | シェル文字列結合によるコマンドインジェクションを防ぐため必ず配列で渡す。 |
| 特権操作 | `pkexec`経由 | sudoのパスワードをGUIに保持しない。実行前に確認ダイアログも表示。 |
| プラグイン形式 | `plugin.json`（宣言的） + 任意`handler.js` | JSONだけで大半の機能を定義可能。複雑な処理が必要な場合のみJSを書く。 |
| プラグイン配布 | 公式サイト(GitHub Pages)の`catalog.json` + zip | アプリ内「＋ ストアから追加」でダウンロード・展開・検証まで自動化。 |
| 設定ファイル編集 | 直接ファイルI/O + 自動バックアップ + 差分表示 + Undo | `core/diffLines.js`によるLCS差分、バックアップからの復元に対応。 |
| ログ表示 | `journalctl -u <unit> --no-pager` | 追加ミドルウェア不要でsystemd環境に統一的対応。 |
| パッケージング | `electron-builder`（.deb / AppImage） | GitHub Actionsでタグpush時に自動ビルド・Release添付。 |
| 自動アップデート | `electron-updater`（AppImageのみ） | GitHub Releasesを更新元として使用。debはパッケージマネージャでの更新を想定し対象外。 |
| 自動テスト | Node標準 `node:test` | 追加パッケージ不要。CIで`npm test`として実行。 |

## 3. ディレクトリ構造

```
penguin-control-center/
├── main.js                # Electronメインプロセス（ウィンドウ生成・IPCハンドラ登録・自動アップデート）
├── preload.js              # contextBridgeで安全なAPIのみレンダラーに公開
├── core/
│   ├── pluginLoader.js      # plugins/配下をスキャンしマニフェストを読み込む
│   ├── pluginsPath.js       # プラグイン保存先の解決（後述4.1）
│   ├── cliRunner.js         # execFileラッパー。実行ログを記録
│   ├── configManager.js     # 設定ファイルの読み書き・自動バックアップ・復元
│   ├── diffLines.js         # 行単位のLCS差分アルゴリズム(純粋関数、テスト対象)
│   ├── logReader.js         # journalctl読み出し
│   └── storeClient.js       # ストアからのカタログ取得・ダウンロード・検証・展開
├── plugins/                # 開発中(npm start)に読み込まれるプラグイン群(配布物には含まれない)
│   └── <id>/
│       ├── plugin.json
│       ├── docs.md
│       └── handler.js      # (任意)
├── renderer/                # UI(GUI設定/CLI/ログ/設定ファイル/ドキュメント/ストア/ダッシュボード)
├── docs/                    # GitHub Pages公開サイト(公式サイト・ストア・プラグイン詳細ページ)
│   ├── index.html / store.html / plugin.html
│   ├── catalog.json         # プラグインストアのカタログ(公開情報)
│   ├── downloads/*.zip      # プラグイン本体のzip
│   └── plugin-docs/*.md     # 各プラグインのdocs.mdのコピー(サイト表示用)
├── tools/publish-gui/       # メンテナ専用: プラグインをストアに公開するローカルツール
├── tests/                   # node:testによる単体テスト
└── .github/workflows/       # CI・CodeQL・Release Build
```

### 4.1 プラグインの保存先（重要な設計変更）

配布パッケージ(.deb/AppImage)には`plugins/`を含めない。パッケージのインストール先は
読み取り専用領域（またはroot所有）であり、ストアからのプラグインを書き込めないため。

`core/pluginsPath.js`が保存先を動的に決定する:

- **パッケージ化されたアプリ** (`app.isPackaged === true`): `app.getPath('userData')/plugins`
  （ユーザーごとの書き込み可能領域。初回は空＝ゼロプラグイン状態）
- **開発中**(`npm start`、未パッケージ) / **Electron外**(単体テスト等): リポジトリ内の`plugins/`

## 5. プラグインマニフェスト仕様（v0.2）

```jsonc
{
  "id": "chrony",
  "name": "chrony (NTP時刻同期)",
  "version": "0.1.0",
  "description": "...",
  "service": {
    "systemdUnit": "chrony.service",
    "configPath": "/etc/chrony/chrony.conf"
  },
  "conflictsWith": ["ntp"],  // (任意) 同時稼働させるべきでないプラグインID
  "actions": [
    { "id": "status", "label": "状態確認", "cli": ["chronyc", "tracking"], "privileged": false },
    { "id": "restart", "label": "再起動", "cli": ["systemctl", "restart", "chrony.service"], "privileged": true }
  ],
  "docs": "docs.md"
}
```

- `cli`は必ず配列（プログラム名 + 引数）。文字列結合は禁止。
- `privileged: true`のアクションは実行前に確認ダイアログを出し、`pkexec`を前置して実行。
- `conflictsWith`に列挙されたプラグインが稼働中の状態で`start`/`enable`/`restart`系アクションを
  実行しようとすると、警告ダイアログを表示する（例: Apache稼働中にNginxを起動しようとした場合）。
- `cli`配列内の要素が`"{{paramId}}"`という形式(トークン全体が一致)の場合、それは`actions[].params`
  で宣言された入力値に対応する。実行時にGUIで入力フォームを表示し、値を配列の1要素として
  そのまま置換する（文字列結合はしない）。`params[]`の各項目は`id`/`label`/`type`(text/email)/
  `required`/`pattern`(検証用正規表現、任意)/`placeholder`/`errorMessage`を持つ。
  例: Certbotの証明書発行アクション（`plugins/certbot/plugin.json`参照）。
  パスワード等の機密情報の入力には現時点で対応していない（実行結果・CLI履歴に平文で
  残ってしまうため、別途マスキング機構が必要）。

## 5.1 パラメータ付きアクションの安全性

`{{paramId}}`は必ず「配列の要素全体」としてのみ許可される（例: `"-d {{domain}}"`のような
文字列内埋め込みは対象外）。これにより、置換後も各要素は独立した1つの引数のままであり、
入力値にスペースやシェル記号(`;`, `&&`, `|`等)が含まれていても、コマンドの引数構造
（要素の数や区切り）自体を変えることはできない。検証は`core/paramSubstitution.js`に
実装し、単体テスト（`tests/paramSubstitution.test.js`）で「危険な文字列を含む値でも
配列の要素数が変わらないこと」を確認している。

## 6. データフロー

```
[Renderer(UI)] --ipcRenderer.invoke--> [preload.js] --contextBridge--> [main.js]
      |                                                                     |
      | 表示更新 <--- IPC結果 <--- [core/cliRunner.js] --execFile--> [OSコマンド]
```

各タブの対応：

| タブ/画面 | データソース |
|---|---|
| ホーム(ダッシュボード) | 導入済み全プラグインの`systemctl is-active`結果（5秒キャッシュ） |
| GUI設定 | `plugin.json`の`actions`をボタン化、対応CLIを常に併記 |
| CLI | `cliRunner`が保持する実行履歴 |
| ログ | `logReader` → `journalctl` |
| 設定ファイル | `configManager` → 読み書き・`diffLines`による差分表示・バックアップ一覧・Undo |
| ドキュメント | プラグインの`docs.md`をレンダリング |
| ストア | `storeClient` → 公式サイトの`catalog.json`取得・導入・アンインストール |

## 7. セキュリティ方針

1. レンダラーはNode APIに直接触れない（`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`）。
2. 実行可能コマンドはプラグインマニフェストで宣言されたものだけに制限（任意文字列実行は不可）。
3. 特権操作は`pkexec`経由でOS側の認証UIに委譲し、アプリ内にパスワードを持たない。
4. 設定ファイル書き込みは必ずバックアップを作成してから行う。
5. ストアからのダウンロードは、ダウンロード元オリジンの検証・SHA256によるファイル整合性検証・
   zip展開前のパストラバーサル検査（絶対パス/`..`を含むエントリの拒否）を行う。
6. プラグインIDは正規表現で安全な文字種のみに制限し、ファイルパス操作に使う前に必ず検証する。
7. `handler.js`を含むプラグインは、メインプロセスで無制限のNode.jsコードとして実行される
   （事実上フル権限）。そのためプラグインストアへの掲載は、誰でもマージできるPR方式ではなく、
   提案Issueを経由した公式審査制としている（詳細は[CONTRIBUTING.md](./CONTRIBUTING.md)参照）。

## 7.5 ライセンス方針

- 本体: GPL-3.0（クローズドソース化された改変版の無断販売を防ぐため）
- プラグイン: GPLv3第7条に基づく追加的許可条項により、本体のコピーレフトに縛られず
  任意のライセンスで提供可能（プラグインは`handler.js`が本体プロセス内に`require()`される
  設計のため、この明示的な許可がないとGPLの「派生物」解釈上グレーゾーンになりうる）
- 公式に同梱されるプラグイン(`plugins/`配下)はデフォルトでMIT
- 詳細は[LICENSE](../LICENSE)および[plugins/LICENSE](../plugins/LICENSE)を参照

## 8. CI/CD

- **CI**: push/PR時に`npm test`・JS構文チェック・JSON構文チェック・プラグインマニフェスト検証・
  catalog.jsonとzipの整合性(SHA256)検証を実行
- **CodeQL**: JavaScriptの静的セキュリティスキャン（push時・週次・PR時）
- **Release Build**: `vX.Y.Z`タグのpushで`.deb`/`AppImage`を自動ビルドし、`package.json`のバージョンを
  タグに同期した上でSHA256SUMS・アップデート用メタデータ(`latest-linux.yml`)とともにGitHub Releaseへ添付
- **Dependabot**: npm依存関係・GitHub Actionsのバージョンを週次チェック、セキュリティアラートも有効化

## 9. 今後の検討事項（未着手）

- Fedora/Arch等ディストリビューション差異の吸収（`systemdUnit`名の違い等）
- 設定ファイルの構文チェック（プラグイン単位でのバリデーションスキーマ）
- Flatpak/Snap形式での配布
- プラグイン間の依存関係宣言（`dependencies`フィールド）
