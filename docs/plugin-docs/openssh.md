# OpenSSH

## 概要

`sshd`はLinuxへリモートログインするためのSSHサーバーです。設定ミスがあるとリモート接続できなくなる
（自分自身を締め出す）リスクがあるため、変更前に「設定ファイルの文法チェック」を実行することを推奨します。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `systemctl status ssh.service` | サービスの稼働状態を表示 |
| `sshd -t` | 設定ファイルの文法チェック（構文エラーがあれば表示、正常なら無出力） |
| `who` | 現在ログイン中のユーザー一覧 |
| `last -n 10` | 直近10件のログイン履歴 |
| `systemctl restart ssh.service` | 設定変更後の反映に必要 |

## 設定ファイル

- パス: `/etc/ssh/sshd_config`
- 代表的な項目: `Port`（待受ポート）、`PermitRootLogin`、`PasswordAuthentication`
- **重要**: リモート経由でこのアプリを操作している場合、`PasswordAuthentication no` などに変更して
  再起動すると、鍵認証を設定していないと即座に接続できなくなります。変更前に別セッションを保持したまま
  文法チェック→反映の順で行ってください。

## サービス名について

Debian/Ubuntu系は `ssh.service`、RHEL/Fedora系は `sshd.service` と名前が異なります。
本プラグインはDebian/Ubuntu系を前提にしています。

## よくあるトラブル

- **設定変更後に接続できなくなった**: コンソール（物理/仮想コンソール）から`sshd_config`を復元し、
  `systemctl restart ssh.service`で復旧
- **`sshd -t`が権限エラーになる**: 設定ファイルの読み取り権限を確認

## 関連リンク

- 公式マニュアル: `man sshd_config`
