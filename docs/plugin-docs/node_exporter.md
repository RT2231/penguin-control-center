# Node Exporter (Prometheusメトリクス公開)

## 概要

Node ExporterはPrometheus公式のエクスポーター（メトリクス収集エージェント）で、
CPU使用率・メモリ・ディスクI/O・ネットワーク統計などのOSレベルのメトリクスを
HTTPエンドポイント（デフォルトで`:9100/metrics`）として公開します。Prometheusサーバーが
これを定期的に取得（スクレイプ）し、Grafanaプラグインで可視化する、という組み合わせで
使われるのが一般的です。

## 設定について

Node Exporter自体は複雑な設定ファイルを持たず、多くの場合コマンドライン引数
（有効にする収集項目の指定など）で制御します。Debian/Ubuntu系のパッケージでは、
それらの引数を`/etc/default/node_exporter`という環境変数ファイルで指定する構成が
一般的です。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `node_exporter --version` | インストールされているバージョンを確認 |
| `systemctl status node_exporter.service` | サービスの稼働状態を確認 |

## 動作確認方法

サービスが起動していれば、`http://<このマシンのIP>:9100/metrics`にブラウザまたは
`curl`でアクセスすると、Prometheus形式のテキストメトリクスがそのまま表示されます。
これが表示されれば正常に動作しています。

## セキュリティ上の注意

Node Exporterのメトリクスエンドポイントには認証機能がありません。CPU使用率や
実行中プロセス数などのシステム情報が読み取れてしまうため、インターネットに直接
公開せず、UFWプラグイン等でPrometheusサーバーのIPアドレスのみ9100番ポートへの
アクセスを許可する構成を推奨します。

## 関連リンク

- 公式ドキュメント: https://github.com/prometheus/node_exporter
