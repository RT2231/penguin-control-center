# Tailscale (メッシュVPN)

## 概要

TailscaleはWireGuardを土台にした、設定がほぼ不要な（ゼロコンフィグ）メッシュVPNです。
複数のマシンを1つのプライベートネットワークのように扱え、自宅サーバーへの外部からの
安全なアクセスなどによく使われます。本プラグインはデーモンの起動停止・接続状態確認を
GUIから行えるようにします。

## ⚠️ 初回接続(tailscale up)はGUI非対応

新しい端末をTailscaleネットワークに参加させる`tailscale up`コマンドは、ブラウザでの
認証（Googleアカウント等でのログイン）が必要な対話的操作のため、本プラグインでは
対応していません。初回のみターミナルから直接`sudo tailscale up`を実行してください。
一度参加した端末は、本プラグインで起動・停止・状態確認ができます。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `tailscale status` | 自分を含むネットワーク参加端末の一覧とオンライン状態 |
| `tailscale ip` | このマシンに割り当てられたTailscale上のIPアドレス(100.x.y.z形式) |
| `systemctl status tailscaled.service` | デーモンのsystemd上の状態 |

## WireGuardプラグインとの違い

WireGuardプラグインは手動で鍵ペア・ピア設定を行う「セルフホスト型」VPNを想定しています。
Tailscaleは鍵交換やNAT越えを自動化した「マネージド型」で、セットアップは簡単な反面、
Tailscale社のコーディネーションサーバーに依存します。用途に応じて使い分けてください。

## よくあるトラブル

- **`tailscale status`で「Logged out」と表示される**: `sudo tailscale up`で再度ログインが必要です
- **他の端末から接続できない**: そのマシン側のファイアウォール（UFWプラグイン等）で
  Tailscaleの使うUDPポート(デフォルト41641)がブロックされていないか確認

## 関連リンク

- 公式ドキュメント: https://tailscale.com/kb/
