# Penguin Control Center (PCC) — アーキテクチャ設計書 v0.1

## 1. 全体方針

PCCは「CLI管理ソフトをGUI化しつつCLIも学べる」統合管理ツール。
本設計書ではMVP（chronyプラグイン1本で全機能フローを実証する版）の技術選定と構造を定める。

## 2. 技術選定

| 領域 | 採用技術 | 理由 |
|---|---|---|
| GUIフレームワーク | **Electron**（素のNode.js、TypeScriptなし） | 開発者のスキルセットがJS/Web中心（React, Cloudflare Workers等）のため学習コストが低く、プラグイン開発者を将来的にコミュニティから募る上でもJSは参入障壁が低い。Tauri(Rust)は将来的な軽量化オプションとして残す。 |
| プロセス間通信 | `contextBridge` + `ipcMain`/`ipcRenderer` | `nodeIntegration: false` / `contextIsolation: true` を徹底し、レンダラーからOSへの直接アクセスを禁止。 |
| コマンド実行 | `child_process.execFile`（配列引数） | `exec`のシェル文字列結合はコマンドインジェクションの温床のため禁止。必ず配列で渡す。 |
| 特権操作 | `pkexec`経由 | sudoのパスワードをGUIに保持しない。PolicyKitのGUIプロンプトに委譲。 |
| プラグイン形式 | `plugin.json`（宣言的） + 任意`handler.js` | JSONだけで「表示ラベル・対応CLI・systemdユニット名・設定ファイルパス」を定義可能。複雑な処理が必要な場合のみJSを書く。 |
| 設定ファイル編集 | 直接ファイルI/O + 自動バックアップ | 書込み前に`<path>.bak.<timestamp>`を作成。将来的にdiff表示・構文チェックをプラグイン単位で追加可能な設計。 |
| ログ表示 | `journalctl -u <unit> --no-pager` | 追加ミドルウェア不要でsystemd環境に統一的対応。 |

## 3. ディレクトリ構造

```
pcc/
├── main.js              # Electronメインプロセス（ウィンドウ生成・IPCハンドラ登録）
├── preload.js            # contextBridgeで安全なAPIのみレンダラーに公開
├── core/
│   ├── pluginLoader.js    # plugins/配下をスキャンしマニフェストを読み込む
│   ├── cliRunner.js       # execFileラッパー。実行ログを記録
│   ├── configManager.js   # 設定ファイルの読み書き・自動バックアップ
│   └── logReader.js       # journalctl読み出し
├── plugins/
│   └── chrony/
│       ├── plugin.json    # マニフェスト（対応CLI・アクション定義）
│       ├── docs.md        # ドキュメントタブ表示用
│       └── handler.js     # (任意)状態解析など複雑な処理
├── renderer/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── package.json
```

## 4. プラグインマニフェスト仕様（v0.1）

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
  "actions": [
    { "id": "status", "label": "状態確認", "cli": ["chronyc", "tracking"], "privileged": false },
    { "id": "restart", "label": "再起動", "cli": ["systemctl", "restart", "chrony.service"], "privileged": true }
  ],
  "docs": "docs.md"
}
```

- `cli`は必ず配列（プログラム名 + 引数）。文字列結合は禁止。
- `privileged: true`のアクションは実行前に確認ダイアログを出し、`pkexec`を前置して実行。
- 将来的に`configSchema`（構文チェック用）や`dependencies`（プラグイン間依存）を拡張可能。

## 5. データフロー

```
[Renderer(UI)] --ipcRenderer.invoke--> [preload.js] --contextBridge--> [main.js]
      |                                                                     |
      | 表示更新 <--- IPC結果 <--- [core/cliRunner.js] --execFile--> [OSコマンド]
```

各タブの対応：

| タブ | データソース |
|---|---|
| GUI設定 | `plugin.json`の`actions`をボタン化 |
| CLI | `cliRunner`が保持する実行履歴（コマンド・stdout・stderr・終了コード・実行時間） |
| ログ | `logReader` → `journalctl` |
| 設定ファイル | `configManager` → `service.configPath`を読み書き |
| ドキュメント | プラグインの`docs.md`をレンダリング |

## 6. セキュリティ方針

1. レンダラーはNode APIに直接触れない（`contextIsolation: true`, `nodeIntegration: false`）。
2. 実行可能コマンドはプラグインマニフェストで宣言されたものだけに制限（任意文字列実行は不可）。
3. 特権操作は`pkexec`経由でOS側の認証UIに委譲し、アプリ内にパスワードを持たない。
4. 設定ファイル書き込みは必ずバックアップを作成してから行う。

## 7. 今後のロードマップ（抜粋）

- Phase 1（今回）: Electronシェル + chronyプラグインでフロー実証
- Phase 2: プラグインストア（ローカルJSONカタログ→将来リモート化）、Undo/差分表示
- Phase 3: 初心者/上級者モード切替、OpenSSH・Docker・Pi-holeプラグイン追加
- Phase 4: Fedora/Arch等ディストリビューション差異吸収レイヤー
