# Grafana (監視ダッシュボード)

## 概要

Grafanaは、Prometheus・InfluxDB・PostgreSQLなど様々なデータソースのメトリクスやログを
グラフ・ダッシュボードとして可視化するためのツールです。本プラグインはサービスの
起動停止と、インストール済みプラグイン一覧の確認をGUIから行えるようにします。

## Node Exporter / PostgreSQLプラグインとの組み合わせ

Grafana単体ではデータを収集しません。典型的な構成は、`node_exporter`プラグインで
サーバーのCPU/メモリ/ディスク等のメトリクスを収集し、Prometheusで蓄積したものを
Grafanaで可視化する、という流れです。データベースの中身を直接可視化したい場合は、
PostgreSQL/MySQLプラグインで管理しているDBをデータソースとして追加することもできます。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `grafana-cli plugins ls` | インストール済みのGrafanaプラグイン（データソース・パネル等）一覧 |
| `systemctl status grafana-server.service` | サービスの稼働状態を確認 |
| `grafana-cli --version` | grafana-cliコマンド自体のバージョン確認 |

## 設定ファイル

- パス: `/etc/grafana/grafana.ini`
- 代表的な項目: `http_port`（デフォルト3000）、`domain`（外部公開時のホスト名）、
  `root_url`（リバースプロキシ配下で動かす場合のURL）

## Nginx/Apacheでのリバースプロキシ

GrafanaをHTTPS化・独自ドメインで公開したい場合、Nginx/Apacheプラグインで管理している
Webサーバーをリバースプロキシとして手前に置く構成がよく使われます。その場合、
`grafana.ini`の`root_url`をプロキシ後のURLに合わせて設定する必要があります。

## 初回ログインについて

初期状態の管理者アカウントはユーザー名`admin`・パスワード`admin`で、初回ログイン時に
変更を求められます。パスワードのリセットは`grafana-cli admin reset-admin-password`
コマンドで行えますが、新しいパスワードを引数で指定する対話性の高い操作のため、
本プラグインでは非対応です。必要な場合はターミナルから直接実行してください。

## 関連リンク

- 公式ドキュメント: https://grafana.com/docs/grafana/latest/
