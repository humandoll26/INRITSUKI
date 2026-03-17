# 韻律機 | INRITSUKI

短歌向けに、テロップ表示と読み上げテキストを分けて、VOICEVOX で朗読しながら縦書き動画を作るローカルツールです。

## できること

- テロップ表示用の文字列と、読み上げ用の文字列を分けて入力できます
- VOICEVOX で朗読音声を生成できます
- 縦書きの静止テロップ付き動画を `WebM` で保存できます

## 前提

このツールは短歌形式を前提にしています。基本は五句での入力を想定しています。

また、このツール単体には音声合成エンジンは含まれていません。利用前に、ユーザー自身で Node.js と VOICEVOX をインストールしてください。

Node.js を初めて使う場合でも、このツールでは難しい準備は必要ありません。Node.js をインストールしたあと、`start-server.cmd` を実行すればローカルサーバーが起動します。`npm install` や `build` のような追加作業は不要です。

## 使い方

1. Node.js をインストールします  
   https://nodejs.org/
2. `LTS` と書かれた方をクリックして、Windows 用インストーラーをダウンロードします
3. ダウンロードしたインストーラーを開き、基本的にはそのまま `Next` を押して進めます
4. `Install` を押して完了まで待ち、最後に `Finish` を押します
5. コマンドプロンプトか PowerShell を開いて `node -v` を実行し、Node.js のバージョンが表示されることを確認します
6. このツールでは Node.js を使って `server.mjs` を起動します。追加のビルド作業はありません
7. VOICEVOX をインストールします  
   https://voicevox.hiroshiba.jp/
8. VOICEVOX を起動します
9. ブラウザで `http://127.0.0.1:50021/version` を開き、バージョン文字列が表示されることを確認します
10. このフォルダで `start-server.cmd` を実行します
11. ブラウザで `http://127.0.0.1:5173/` を開きます
12. テキストを入力して `朗読する` を押します
13. 必要なら `動画を保存` で `WebM` を書き出します

`index.html` の直開きでは正常動作しません。必ず `start-server.cmd` から起動してください。

## 保存形式

動画の保存形式は `WebM` です。`MP4` が必要な場合は、保存後に外部変換サービスを利用してください。

- CloudConvert: https://cloudconvert.com/webm-to-mp4
- FreeConvert: https://www.freeconvert.com/webm-to-mp4

機密性の高い内容は外部サービスへアップロードしないでください。

## GitHub で公開する場合の注意

このリポジトリには VOICEVOX 本体は含まれていません。利用する場合は、各自で VOICEVOX をインストールしてください。

生成音声の利用については、VOICEVOX のソフトウェア利用規約だけでなく、使用する各音声ライブラリの利用条件にも従ってください。

## クレジット

このツールは VOICEVOX を利用しています。

- VOICEVOX 公式サイト: https://voicevox.hiroshiba.jp/
- VOICEVOX 利用規約: https://voicevox.hiroshiba.jp/term/


## ライセンスまわりの補足

VOICEVOX 本体の最新規約と、使用するキャラクターごとの利用条件を必ず確認してください。
