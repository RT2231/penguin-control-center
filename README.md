# Penguin Control Center (PCC) — MVP

LinuxのCLIツールをGUIで管理し、対応するCLIも同時に学べる統合管理ツール。
このMVPでは `chrony`（NTP時刻同期）プラグイン1本で、設計書（`DESIGN.md`）通りの
全機能フロー（GUI操作／CLI表示／ログ／設定ファイル編集／ドキュメント）を実証しています。

## 動作環境

- Linux（systemd環境。journalctl・pkexecが利用可能なこと）
- Node.js 18以上
- `chrony` パッケージ（`sudo apt install chrony` 等。未インストールでもアプリ自体は起動します）

## 起動方法

```bash
cd pcc
npm install
npm start
```

初回 `npm install` でElectron本体（数百MB）がダウンロードされます。

## 特権操作について

`起動` `停止` `再起動` `自動起動を有効化/無効化` は `pkexec` 経由で実行されます。
実行時にOSのパスワード認証ダイアログが表示されます（アプリ内にパスワードは保持しません）。
`pkexec` が使えない環境（PolicyKit未導入など）では失敗しますので、その場合はCLIタブに表示される
コマンドを手動で `sudo` 実行してください。

## 公式サイト・プラグインストア

- 公式サイト: https://rt2231.github.io/penguin-control-center/
- プラグインストア(Webページ): https://rt2231.github.io/penguin-control-center/store.html
- **アプリ内から直接導入**: アプリのサイドバー上部「＋ ストアから追加」を押すと、公式ストアのプラグイン一覧が表示され、
  「導入する」ボタン一つでダウンロード・展開・`plugins/`への配置まで自動で行われます（`unzip`コマンドが必要です）。

対応してほしいソフトウェアがある場合は、[プラグイン提案Issue](https://github.com/RT2231/penguin-control-center/issues/new?template=plugin-proposal.md)から提案してください（公式が審査のうえストアに掲載します）。

## プラグインをストアに公開する（メンテナ向け）

`plugins/`にプラグインを追加・更新したら、GUIツールでストア（`docs/catalog.json` + `docs/downloads/*.zip`）に反映できます。

```bash
npm run publish-gui
# → http://localhost:5178 をブラウザで開く
```

プラグイン一覧から「ストアに公開」を押すと、そのプラグインをzip化して`docs/downloads/`に置き、
`docs/catalog.json`にエントリを追加・更新します。Gitへのコミット・pushは自動で行われないので、
画面に表示されるコマンドで確認しながら手動で行ってください。

## 新しいプラグインの追加方法（開発者向け）

`plugins/<プラグイン名>/plugin.json` を作成するだけで、GUIに新しいソフトウェアが追加されます。

```jsonc
{
  "id": "openssh",
  "name": "OpenSSH",
  "version": "0.1.0",
  "description": "...",
  "service": {
    "systemdUnit": "ssh.service",
    "configPath": "/etc/ssh/sshd_config"
  },
  "actions": [
    { "id": "status", "label": "状態確認", "cli": ["systemctl", "status", "ssh.service", "--no-pager"], "privileged": false },
    { "id": "restart", "label": "再起動", "cli": ["systemctl", "restart", "ssh.service"], "privileged": true }
  ],
  "docs": "docs.md"
}
```

同ディレクトリに `docs.md` を置けばドキュメントタブに、複雑な処理が必要なら `handler.js` を
置けば任意のJSロジックを追加できます（詳細は `DESIGN.md` の「プラグインマニフェスト仕様」を参照）。

## 既知の制約（MVPのため）

- プラグインの更新チェックは手動（ストア画面を開いたときのみ確認、バックグラウンド自動更新なし）
- 設定ファイルの構文チェック・差分表示・Undoは未実装（バックアップ作成のみ）
- 初心者/上級者モード切替は未実装
- Ubuntu/Debian系での動作を主に想定（他ディストリビューションは`systemdUnit`名の差異等で調整が必要な場合あり）
- `handler.js`はメインプロセスで無制限に実行されるため、実質的にフル権限のコードとして扱われます（ストアでは`⚠ カスタムコード含む`バッジで明示）

詳細な設計方針・今後のロードマップは `DESIGN.md` を参照してください。
