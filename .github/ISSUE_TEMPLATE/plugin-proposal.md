---
name: プラグイン提案
about: 新しいソフトウェア対応プラグインを提案する（採用されるとPCC公式が plugins/ に追加し、公式サイトのプラグインストアに掲載します）
title: "[プラグイン提案] "
labels: plugin-proposal
---

## 対応させたいソフトウェア

<!-- 例: OpenSSH, Docker, Pi-hole など -->

## そのソフトウェアの用途・対象ユーザー

<!-- どんな人がこの管理機能を必要としますか -->

## 想定するアクション（GUIボタン化したい操作）

| ラベル | 対応CLI（配列で） | 管理者権限が必要か |
|---|---|---|
| 例: 状態確認 | `systemctl status xxx.service --no-pager` | 不要 |
| 例: 再起動 | `systemctl restart xxx.service` | 必要 |

## 設定ファイル（あれば）

- パス:
- 説明:

## systemdユニット名（ログ表示に使う場合）

## その他・補足

<!-- 動作確認環境、参考ドキュメントリンクなど -->

---
※ このIssueをもとにPCC公式（メンテナ）が内容を確認し、問題なければ `plugins/` に追加のうえ公式サイトのプラグインストアに掲載します。
plugin.jsonをご自身で用意いただける場合は、このIssueに貼り付けていただいても構いません（[仕様はCONTRIBUTING.md参照](https://github.com/RT2231/penguin-control-center/blob/main/CONTRIBUTING.md)）。
