# Docker

## 概要

Dockerはコンテナ型の仮想化プラットフォームです。本プラグインはDockerデーモン(`docker.service`)の
起動停止と、コンテナ・イメージの一覧確認をGUIから行えるようにします。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `docker version` | クライアント/サーバーのバージョン確認 |
| `docker ps` | 稼働中のコンテナ一覧（`-a`を付けると停止中も含む） |
| `docker images` | ローカルに保存されているイメージ一覧 |
| `systemctl restart docker.service` | デーモンの再起動（daemon.json変更後などに必要） |

## 設定ファイル

- パス: `/etc/docker/daemon.json`
- 代表的な項目: `data-root`（イメージ保存先の変更）、`log-driver`、`registry-mirrors`
- 存在しない場合は空の`{}`から作成されます

## 権限について

`docker`コマンド自体は、実行ユーザーが`docker`グループに所属していないと権限エラーになります
（`sudo usermod -aG docker $USER` 後に再ログインが必要）。本アプリはdockerコマンドに対して
`pkexec`を付与していません（グループ権限での実行を想定）。

## よくあるトラブル

- **`docker ps`が権限エラー**: 実行ユーザーが`docker`グループに入っているか確認
- **起動しない**: ディスク容量不足やoverlay2ドライバの不整合が多い原因。ログタブで詳細を確認
- **daemon.json編集後に起動しない**: JSON構文エラーの可能性。編集前のバックアップから復元

## 関連リンク

- 公式ドキュメント: https://docs.docker.com/
