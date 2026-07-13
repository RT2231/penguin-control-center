# chrony (NTP時刻同期)

## 概要

`chrony`はLinuxでシステム時刻をNTPサーバーと同期するためのデーモンです。
`ntpd`より高速に同期し、間欠的なネットワーク接続（ノートPCなど）にも強いのが特徴です。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `chronyc tracking` | 現在の同期状態（オフセット・遅延など）を表示 |
| `chronyc sources -v` | 参照しているNTPサーバー一覧と各サーバーの評価を表示 |
| `systemctl status chrony.service` | systemdサービスとしての稼働状態を表示 |
| `systemctl restart chrony.service` | サービスを再起動（設定変更後に必要） |

## 設定ファイル

- パス: `/etc/chrony/chrony.conf`（ディストリビューションにより`/etc/chrony.conf`の場合あり）
- `server` / `pool` ディレクティブで参照NTPサーバーを指定
- 設定変更後は `systemctl restart chrony.service` が必要

## よくあるトラブル

- **同期しない**: ファイアウォールでUDP 123番ポートがブロックされていないか確認
- **`chronyc`が権限エラー**: 通常は一般ユーザーで実行可能。エラーが出る場合はソケット権限を確認
- **仮想マシンで時刻がずれる**: ホストOS側の時刻同期機能と競合していないか確認

## 関連リンク

- 公式ドキュメント: https://chrony-project.org/documentation.html
