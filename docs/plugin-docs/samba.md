# Samba (ファイル共有)

## 概要

SambaはWindowsのSMB/CIFSプロトコルを使い、Windows・Mac・Linux間でファイルやプリンタを
共有するためのソフトウェアです。本プラグインは`smbd`サービスの起動停止・設定確認・共有一覧の
確認をGUIから行えるようにします。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `testparm -s` | 設定ファイル(`smb.conf`)の文法チェック。エラーがあれば表示 |
| `smbclient -L localhost -N` | ローカルホストに定義されている共有(shares)一覧を匿名で取得 |
| `smbstatus` | 現在接続中のクライアントと開かれているファイルの一覧(root権限が必要) |
| `systemctl restart smbd.service` | 設定変更後の反映に必要 |

## 設定ファイル

- パス: `/etc/samba/smb.conf`
- `[global]`セクションでワークグループ名などの全体設定、`[共有名]`セクションで個別の共有フォルダを定義
- 共有フォルダの例:

```ini
[shared]
   path = /srv/samba/shared
   read only = no
   guest ok = yes
```

## サービス構成について

Sambaはファイル共有用の`smbd`と、NetBIOS名前解決用の`nmbd`という2つのデーモンで構成されます。
本プラグインは主要な`smbd`のみを管理対象としています。`nmbd`が必要な環境（古いWindowsクライアント
との互換性が必要な場合等）では別途手動での管理が必要です。

## よくあるトラブル

- **`testparm`でエラー**: 該当セクション名とエラー内容が表示されるので該当箇所を確認
- **Windowsから共有が見えない**: ファイアウォール（UFW等）で445番ポート(SMB)が許可されているか確認
- **ユーザー認証で共有に入れない**: Sambaは独自のユーザーDB(`smbpasswd`)を使うため、
  Linuxのユーザーパスワードとは別に`smbpasswd -a <ユーザー名>`での設定が必要な場合があります
  （本プラグインでは未対応、ターミナルから直接実行してください）

## 関連リンク

- 公式ドキュメント: https://www.samba.org/samba/docs/
