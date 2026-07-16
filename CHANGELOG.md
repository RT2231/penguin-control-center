# Changelog

このプロジェクトの変更履歴です。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) を
参考にしています。

## [Unreleased]

### 変更
- ライセンス方針を整理: 本体はGPL-3.0を維持しつつ、GPLv3第7条に基づく「プラグイン向け
  追加的許可条項」をLICENSEに追加。プラグインが本体プロセス内に`require()`される設計上、
  従来の「本体GPL・プラグインMIT」構想には法的にグレーな点があったため、明示的な許可条項で解消。
  公式プラグイン向けに`plugins/LICENSE`(MIT)を新設
- `plugins/LICENSE`を改訂し、著作権が各プラグインの個々の作者に帰属することを明記
  （プロジェクトへの譲渡ではないことを明確化）。`plugin.json`に`author`フィールドを追加し、
  全11公式プラグインに設定。プラグイン提案Issueテンプレートにも著作権者名の記載欄を追加

### 追加
- CIに、実際にElectronアプリを`xvfb`上で起動して動作確認する「スモークテスト」を追加
  （preloadエラーや未捕捉例外の検出、プラグイン一覧の描画確認）。これはv0.1.3で修正した
  preload.jsの起動不能バグのような、単体テストでは検出できない問題を防ぐためのもの

## [0.1.3] - 2026-07-15

### 修正
- **重大**: `preload.js`が`sandbox: true`環境でローカルの自作モジュール(`core/diffLines.js`)を
  `require`しており、preloadスクリプトの読み込みに失敗してアプリ全体が起動不能になっていた問題を修正
  （v0.1.2に含まれています。v0.1.2を導入した方はこのバージョンへの更新を強く推奨します）
- 再発防止として、preload.jsがローカルモジュールをrequireしていないことを検証する自動テストを追加

## [0.1.2] - 2026-07-12

### 追加
- 配布パッケージ(.deb/AppImage)をプラグインゼロの状態に変更。プラグインの保存先を
  ユーザーごとの書き込み可能領域(`userData`)に分離
- `node:test`による自動テスト(25件)をCIに追加
- リリース成果物にSHA256SUMSを添付
- プラグインストアサイトに各プラグインの詳細ページ(`docs.md`表示)を追加
- AppImage版向けの自動アップデート機能(`electron-updater`)
- リリースワークフローでpackage.jsonのバージョンをgitタグに自動同期

### 修正
- `tools/publish-gui`の`escapeHtml`に引用符エスケープが漏れていた問題(CodeQL指摘)
- ストア画面の更新ボタンラベルでバージョン文字列が未エスケープだった問題
- `electron-builder` 26.x向けの`linux.desktop`設定の互換性修正
- サイドバーの状態チェックにキャッシュを導入し、無駄な`systemctl`実行を抑制

## [0.1.1] - 2026-07-11

### 追加
- `electron-builder`によるLinuxパッケージング(.deb/AppImage)対応
- アプリアイコンを追加
- タグpushでの自動ビルド・GitHub Release添付ワークフロー

## [0.1.0] - 2026-07-09〜2026-07-11

### 追加
- Penguin Control Center MVP初版（Electron + プラグインアーキテクチャ）
- プラグイン11個: chrony, OpenSSH, Docker, Apache HTTP Server, Nginx, Samba, cron,
  MySQL/MariaDB, Pi-hole, UFW, Fail2ban
- 設定ファイルの差分表示・自動バックアップ・Undo(復元)
- 初心者/上級者モード切り替え
- ホーム/ダッシュボード、プラグイン検索・タグ絞り込み、トースト通知
- プラグイン競合検知(`conflictsWith`)
- プラグインストア(公式サイト + アプリ内ワンクリック導入)、メンテナ向け公開ツール(`publish-gui`)
- GitHubリポジトリ運用一式(CI, CodeQL, Dependabot, ブランチ保護, Issue/PRテンプレート,
  SECURITY.md, CODE_OF_CONDUCT.md)
- セキュリティ強化(パストラバーサル対策・オリジン検証・SHA256検証・XSS対策・CSP)

[Unreleased]: https://github.com/RT2231/penguin-control-center/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/RT2231/penguin-control-center/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/RT2231/penguin-control-center/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/RT2231/penguin-control-center/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/RT2231/penguin-control-center/releases/tag/v0.1.0
