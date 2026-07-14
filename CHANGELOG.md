# Changelog

このプロジェクトの変更履歴です。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) を
参考にしています。

## [Unreleased]

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

[Unreleased]: https://github.com/RT2231/penguin-control-center/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/RT2231/penguin-control-center/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/RT2231/penguin-control-center/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/RT2231/penguin-control-center/releases/tag/v0.1.0
