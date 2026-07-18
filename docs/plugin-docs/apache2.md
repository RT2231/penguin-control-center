# Apache HTTP Server (apache2)

## 概要

Apache HTTP Serverは代表的なWebサーバーソフトウェアです。本プラグインは`apache2`サービスの
起動停止・設定文法チェック・有効モジュール確認をGUIから行えるようにします。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `apachectl configtest` | 設定ファイルの文法チェック（`Syntax OK`が出れば問題なし） |
| `apachectl -M` | 有効になっているモジュール一覧 |
| `apachectl -S` | 設定されている仮想ホスト(VirtualHost)の一覧と構成 |
| `systemctl reload apache2.service` | 接続を切らずに設定を反映（`restart`より安全） |

## 設定ファイル

- パス: `/etc/apache2/apache2.conf`
- サイト個別設定は通常 `/etc/apache2/sites-available/` 配下（本プラグインでは未対応、将来拡張予定）
- **重要**: 設定変更後は必ず`configtest`を実行してから`reload`/`restart`してください。
  文法エラーのまま再起動すると、Apacheが起動できなくなります。

## サービス名について

Debian/Ubuntu系は `apache2.service`、RHEL/Fedora系は `httpd.service` と名前もパッケージ名も異なります。
本プラグインはDebian/Ubuntu系を前提にしています。

## よくあるトラブル

- **`configtest`でエラー**: エラーメッセージに行番号が出るので該当箇所を確認
- **起動しない（ポート競合）**: 80/443番ポートを他のプロセス（nginx等）が使用していないか確認
- **`.htaccess`が効かない**: `AllowOverride`ディレクティブの設定を確認

## 関連リンク

- 公式ドキュメント: https://httpd.apache.org/docs/
