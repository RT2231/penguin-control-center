// core/pluginsPath.js — プラグインの保存先ディレクトリを決定する。
//
// 方針:
// - パッケージ化されたアプリ(配布された.deb/AppImage)では、書き込み可能な
//   ユーザーデータ領域(userData)を使う。アプリ本体のインストール先は読み取り専用
//   (asar内、またはroot所有のディレクトリ)の場合があり、そこにストアからの
//   プラグインを書き込むことはできないため。
// - 開発中(`npm start`で未パッケージ状態のElectronから実行)は、リポジトリ内の
//   plugins/を使う(開発・動作確認がしやすいように)。
// - Electronの外(単体テスト等、素のNodeから読み込まれた場合)も、開発時と同じく
//   リポジトリ内plugins/を使う。
//
// これにより、配布パッケージ自体には最初プラグインが一切含まれず(ゼロ状態)、
// ユーザーがストアから導入したプラグインだけがuserData配下に保存される。

const path = require('path');

function getPluginsDir() {
  try {
    const { app } = require('electron');
    if (app && typeof app.isPackaged === 'boolean' && app.isPackaged) {
      return path.join(app.getPath('userData'), 'plugins');
    }
  } catch (err) {
    // Electron外(単体テスト等)から呼ばれた場合はここに来る。リポジトリ内を使う。
  }
  return path.join(__dirname, '..', 'plugins');
}

module.exports = { getPluginsDir };
