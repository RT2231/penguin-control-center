# Fail2ban

## 概要

Fail2banはSSHなどのログ（認証失敗など）を監視し、一定回数失敗したIPアドレスを
ファイアウォールで一時的にブロックするソフトウェアです。ブルートフォース攻撃対策の定番です。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `fail2ban-client status` | 現在監視中のjail(監視ルール)一覧を表示 |
| `fail2ban-client status sshd` | sshd jailの詳細（現在BAN中のIPアドレス一覧など）を表示 |
| `fail2ban-client reload` | サービスを再起動せずに設定ファイルを再読込 |
| `systemctl restart fail2ban.service` | 設定変更後の反映に必要 |

## 設定ファイル

- パス: `/etc/fail2ban/jail.local`（`jail.conf`を直接編集せず、上書き用の`.local`ファイルを使うのが公式推奨）
- 存在しない場合は空の状態から作成されます。最低限のsshd監視を有効化する例:

```ini
[sshd]
enabled = true
maxretry = 5
bantime = 3600
```

## よくあるトラブル

- **`fail2ban-client`が権限エラー**: 通常はroot権限が必要です（本プラグインでは`privileged: true`にしています）
- **正規のアクセスまでBANされた**: `fail2ban-client set <jail名> unbanip <IPアドレス>`で解除できます
  （このコマンドは現在GUI化されていません。CLIタブに表示されるコマンド例を参考に、必要であれば
  ターミナルから直接実行してください）
- **jail.localを編集したのに反映されない**: `systemctl restart fail2ban.service`を忘れずに実行

## 関連リンク

- 公式ドキュメント: https://github.com/fail2ban/fail2ban
