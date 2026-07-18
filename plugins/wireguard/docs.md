# WireGuard (VPN)

## 概要

WireGuardはシンプルな設定と高速な通信が特徴の次世代VPNです。本プラグインは`wg0`という
名前のトンネル（インターフェース）を対象に、状態確認・起動停止をGUIから行えるようにします。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `wg show` | 現在アクティブな全WireGuardインターフェースの状態（ピア・最終ハンドシェイク時刻等）を表示 |
| `systemctl start wg-quick@wg0.service` | `wg0.conf`の設定でトンネルを起動 |
| `systemctl status wg-quick@wg0.service` | systemdサービスとしての状態を確認 |

## 設定ファイル

- パス: `/etc/wireguard/wg0.conf`
- `[Interface]`セクションで自ホストの秘密鍵・IPアドレス、`[Peer]`セクションで接続先の公開鍵・
  許可するIPレンジ(`AllowedIPs`)を定義します
- **重要**: このファイルには秘密鍵が平文で含まれます。パーミッションは`600`（root以外読み取り不可）を
  維持してください。本アプリでの編集・保存時も同様に注意が必要です

## インターフェース名について

本プラグインは`wg0`という名前のインターフェースを前提としています。複数のトンネルを使う場合や
別名を使っている場合は、`plugin.json`の`systemdUnit`/`configPath`を該当する名前
（例: `wg-quick@home.service`）に合わせて複製・調整してください。

## よくあるトラブル

- **`wg show`が権限エラー**: WireGuardの状態確認には通常root権限が必要です
  （本プラグインでは`privileged: true`にしています）
- **トンネルが起動しない**: `wg0.conf`の秘密鍵・公開鍵のペアが正しいか、`AllowedIPs`が
  他のネットワーク設定と衝突していないか確認
- **接続はできるが通信が通らない**: サーバー側でIPフォワーディング(`net.ipv4.ip_forward=1`)が
  有効になっているか、ファイアウォール（UFWプラグイン等）でWireGuardのポート（デフォルト51820/UDP）が
  許可されているか確認

## 関連リンク

- 公式ドキュメント: https://www.wireguard.com/
