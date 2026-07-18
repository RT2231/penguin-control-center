# Redis

## 概要

Redisは高速なインメモリのキーバリューストアで、キャッシュやセッションストア、
メッセージブローカーなど幅広い用途で使われます。本プラグインはサービスの起動停止と、
認証不要な範囲での簡易な状態確認（生存確認・サーバー情報）をGUIから行えるようにします。

## 主なCLIコマンド

| コマンド | 説明 |
|---|---|
| `redis-cli ping` | サーバーが応答するか確認（正常なら`PONG`が返る） |
| `redis-cli info server` | バージョン・稼働時間・プロセスID等のサーバー情報を表示 |
| `redis-cli info memory` | メモリ使用量・断片化率などの統計情報 |
| `systemctl restart redis-server.service` | `redis.conf`変更後の反映に必要 |

## 認証(requirepass)について

`redis.conf`で`requirepass`が設定されている場合、`redis-cli ping`は
`NOAUTH Authentication required.`というエラーを返します（これはエラーではなく、
認証が正しく機能していることの確認にもなります）。本プラグインはパスワードを扱わない設計のため、
認証が必要な環境では「生存確認」アクションはエラー表示になる点にご注意ください。
サービス自体が起動しているかは「サービス状態」タブで確認できます。

## 設定ファイル

- パス: `/etc/redis/redis.conf`
- 代表的な項目: `bind`（待受アドレス）、`requirepass`（パスワード認証）、
  `maxmemory`（メモリ上限）、`appendonly`（永続化の有効/無効）

## セキュリティ上の注意

デフォルト設定のRedisは、外部からの接続を許可すると認証なしで誰でもデータを読み書きできて
しまいます。インターネットに公開する構成にする場合は、必ず`requirepass`の設定と
ファイアウォール（UFWプラグイン等）での接続元制限を行ってください。

## よくあるトラブル

- **`redis-cli ping`が`Could not connect`**: サービスが起動しているか、`bind`設定で
  ローカルホストからの接続が許可されているか確認
- **メモリ使用量が想定より多い**: `maxmemory`と退避ポリシー(`maxmemory-policy`)の設定を確認

## 関連リンク

- 公式ドキュメント: https://redis.io/docs/
