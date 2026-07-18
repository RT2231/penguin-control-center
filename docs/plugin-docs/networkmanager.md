# NetworkManager (ネットワーク設定)

## 概要

NetworkManagerはLinuxで最も広く使われているネットワーク接続管理デーモンです。本プラグインは
`nmcli`（NetworkManagerのCLIツール）を使って、接続状態の確認をGUIから行えるようにします。
**新しい接続の作成やWi-Fiパスワードの入力は対話的な操作になるため対象外**です。

## ⚠️ 注意事項（締め出し防止）

Wi-Fi経由でこのマシンに接続して操作している場合、「サービスを再起動」を実行すると
一時的にネットワーク接続が切断される可能性があります。有線LAN経由での操作を推奨します。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `nmcli device status` | 各ネットワークデバイス（Wi-Fi・有線等）の接続状態を一覧表示 |
| `nmcli connection show` | 保存されている接続プロファイルの一覧 |
| `nmcli device wifi list` | 近隣で検出されているWi-Fiアクセスポイントの一覧 |
| `nmcli radio` | Wi-Fi/WWAN/機内モードのON・OFF状態 |
| `nmcli general status` | 全体の接続状態(CONNECTED/DISCONNECTED等)のサマリー |

## 設定ファイル

- パス: `/etc/NetworkManager/NetworkManager.conf`
- 個別の接続プロファイル（Wi-FiのSSID・パスワード等）は通常
  `/etc/NetworkManager/system-connections/`配下に別ファイルとして保存されます
  （本プラグインでは`NetworkManager.conf`本体のみを編集対象としています）

## サーバー用途での利用について

サーバー環境ではNetworkManagerではなく`systemd-networkd`やディストリビューション標準の
ネットワーク設定（`/etc/network/interfaces`等）が使われている場合もあります。その場合、
本プラグインの`nmcli`コマンドは利用できません。

## よくあるトラブル

- **`nmcli`コマンドが見つからない**: NetworkManagerがインストールされていないか、
  別のネットワーク管理方式（systemd-networkd等）が使われている可能性があります
- **Wi-Fi一覧に何も出てこない**: `nmcli radio`でWi-Fiが無効化されていないか確認

## 関連リンク

- 公式ドキュメント: https://networkmanager.dev/docs/
