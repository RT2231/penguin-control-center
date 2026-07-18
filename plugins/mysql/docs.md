# MySQL / MariaDB

## 概要

MySQL（およびその互換フォーク版であるMariaDB）はオープンソースの代表的なリレーショナル
データベースです。本プラグインはサービスの起動停止のみを管理対象とし、**データベース内部の
操作（クエリ実行、ユーザー管理、テーブル操作など）は意図的に対象外**にしています。

## なぜDB内部の操作に対応していないか

データベースへの接続には通常パスワード等の認証情報が必要です。PCCはCLIコマンドを
そのまま実行する設計上、認証情報をアプリ内に保存・入力させる機能を持たせたくありません
（保存すれば漏洩リスク、都度入力させれば対話的プロンプトでコマンドが固まるリスクがあります）。
そのため本プラグインは「サービスが動いているかどうか」の管理に留めています。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `mysql --version` | インストールされているクライアントのバージョン確認（認証不要） |
| `mysqladmin ping` | サーバーが応答するか簡易確認（認証情報を渡さないため、認証必須構成では失敗する場合があります） |
| `systemctl status mysql.service` | サービスの稼働状態を表示 |
| `systemctl restart mysql.service` | `my.cnf`変更後の反映に必要 |

## サービス名について

Ubuntu/Debianでは、インストールしたパッケージによって`mysql.service`（Oracle MySQL）または
`mariadb.service`（MariaDB）とユニット名が異なります。本プラグインは`mysql.service`を前提と
しています。MariaDBを使用している場合は、多くのディストリビューションで`mysql.service`が
`mariadb.service`へのエイリアスとして動作しますが、環境によっては動作しない場合があります。

## 設定ファイル

- パス: `/etc/mysql/my.cnf`（多くの場合、実体は`/etc/mysql/mysql.conf.d/`以下を`!includedir`で
  読み込む構成になっています）
- 変更後は必ず`systemctl restart mysql.service`が必要です

## データベースの操作をしたい場合

`mysql -u <ユーザー名> -p`でターミナルから直接接続してください。GUI経由でのDB管理ツールが
必要な場合は、phpMyAdminやDBeaverなど専用ツールの利用を推奨します。

## 関連リンク

- 公式ドキュメント: https://dev.mysql.com/doc/
- MariaDB: https://mariadb.org/documentation/
