# Windows での記録

Skill Recorder の録画コントローラー、イベントバス、セッション保存、コレクターホスト、収集レベル、解析とスキル生成は macOS と Windows で共通です。この文書では Windows に固有の記録方法、準備、実機確認を扱います。

<a id="what-captures-what-on-windows"></a>

## Windows での記録のしくみ

| 記録対象 | Windows での方法 | macOS との対応 | 権限 |
| --- | --- | --- | --- |
| アプリの切り替え | Koffi から Win32 の `user32` と `kernel32` を呼ぶ | 同等 | 不要 |
| ウィンドウのタイトル | Koffi から Win32 の `user32` を呼ぶ | 同等。Windows では追加許可不要 | 不要 |
| ブラウザーの URL | `powershell.exe` で UI Automation を実行し、アドレスバーを読む | URL の表記は異なる場合がある | 不要 |
| クリップボード | Electron のクリップボード API | 同等 | 不要 |
| 画面の動画と画像 | `desktopCapturer`、Chromium のスナップショット、Sharp | 同等 | 画面収録 |
| 任意の音声解説 | 非表示ウィンドウの `getUserMedia` と `MediaRecorder`。Chromium でデコードし端末内の Whisper で文字起こし | 同等 | マイク |

[`electron/collectors/windows-url-provider.ts`](../electron/collectors/windows-url-provider.ts) はアドレスバーに表示された値を、UI Automation で読みます。macOS が AppleScript で得るアクティブタブの正確な URL とは異なりますが、ホスト単位で操作を区切るのに使えます。Windows では Firefox にも対応します。途中まで入力した URL や検索語など、空白を含むかドットのない値は記録しません。ウィンドウタイトルの取得には Windows で OS の許可が不要です。macOS ではアクセシビリティの許可が必要です。

<a id="prerequisites"></a>

## 前提条件

1. Koffi は `win32-x64` と `win32-arm64` 用のビルド済み N-API パッケージを提供します。
2. URL を読む補助プロセスは Windows 10 と 11 に付属する Windows PowerShell 5.1 の `powershell.exe` を使います。
3. 解析には GitHub Copilot CLI（`copilot`）が必要です。配布用の構成には CLI が同梱されています。
4. 新規録画用のシステムメディアパッケージは不要です。

<a id="doctor-signals"></a>

## 準備状況の確認

録画画面の準備状況か、IPC の `doctor()` を確認します。ウィンドウ記録のプロバイダーは `koffi`、URL 収集が有効ならブラウザーのプロバイダーは `uia` であることを確認してください。

<a id="live-smoke-test"></a>

## 実機での基本動作確認

すべての収集対象を含む設定で録画し、各イベントがセッションの `events.jsonl` に入ることを確認します。

1. 録画ボタンか `Ctrl+Shift+R` で録画を開始します。
2. `Alt+Tab` で Edge とメモ帳などを切り替えます。正しい `owner.name` を持つ `app.activate` と、タイトルが変わったときの `app.title-change` を確認します。
3. Edge または Chrome で2つのサイトにアクセスします。アドレスバーの URL と `host` を含む `browser.url` を確認します。Firefox も試します。URL の途中の文字列や検索語ではイベントが出ないことを確認します。
4. テキストをコピーし、プレビューとハッシュがある `clipboard.change` を確認します。
5. `video.webm`、`video-frames.json`、`video-frames/` の画像、`frames/` の画像を確認します。
6. 「音声解説」をオンにし、録画設定で 99 言語と「既定（言語名）」が表示されることを確認します。既定の言語は OS の優先言語に従います。マイクを許可し、名前付きの入力か「システムの既定」を選びます。録画中にマイクボタンでミュートと解除を行い、隣のメニューで入力を切り替えます。切り替えの前後で話し、`audio.json` に `narrationLanguage` を含む v2 の別区間が保存され、セッションと動画の時刻で区間の境界を追えることを確認します。使用中のマイクを外したときはエラーを表示して停止し、別入力への切り替えは自動で行いません。接続し直して Chromium が判別できる場合は、保存した入力設定を復元します。Whisper モデルがなければ、解析時に初回の約 252 MB のダウンロードを案内します。`narration.json` の言語と原文、`atMs` の時刻を確認します。英語と非ラテン文字の言語を試してください。次回以降の文字起こしはオフラインで行われます。Windows のマイク許可は初回利用時に OS が求めます。
7. 操作バーがアクティブなアプリの上に残ること、マイクメニューと破棄確認がバーの上に開くこと、ドラッグ後もボタンを押せることを確認します。Windows の画面収録保護に対応する環境では、バーが録画画像に映らないことを確認します。破棄を取り消すと録画を継続し、確定するとセッションが残らないことを確認します。
8. 録画を停止し、セッション一覧に「録画済み」と表示されること、解析が選択言語で作業の目的と順序付き手順を生成することを確認します。

記録が見当たらないときは、準備状況とメインプロセスのログを確認してください。URL 収集が使えない、または収集対象を縮小したときの警告などが記録されます。

<a id="packaging"></a>

## パッケージ作成

`package.json` の electron-builder 設定は macOS と Windows NSIS を対象にしています。`koffi`、`@koromix/*`、`sharp`、`@img/*`、`@huggingface/transformers`、`onnxruntime-node`、Copilot の環境別パッケージは `asarUnpack` に指定し、各バイナリを ASAR アーカイブの外から読み込みます。

Whisper モデルは同梱しません。録画画面かセッション一覧で初回の約 252 MB のダウンロードを利用者が承認すると、アプリデータの `models` に保存します。モデルがなくても録画と基本のセッション処理は実行できます。多言語の q8 は約 251.9 MB、以前の英語専用モデルは約 251.2 MB です。どちらも Whisper `small` を使い、メモリ使用量と文字起こし速度は同程度を想定しています。

npm が対象アーキテクチャの任意依存関係を選ぶよう、同じアーキテクチャの Windows 実機または CI ランナーでパッケージを作成します。

```powershell
npm ci
npm run dist:win:x64
# or, on Windows ARM64:
npm run dist:win:arm64
```

Windows のワークフローは `windows-latest` と `windows-11-arm` を使い、パッケージの PE アーキテクチャとネイティブのバイナリを検査します。

<a id="known-limitations"></a>

## 既知の制限

- ブラウザーの URL は取得できた表示値です。タブの URL と完全に同じとは限りません。
- 記録対象は操作バーから開いた PowerShell セッションだけです。ConPTY を使い、他の PowerShell、Windows Terminal、`cmd.exe` は監視しません。設計の経緯は [公式 Issue #5](https://github.com/microsoft/skill-recorder/issues/5) にあります。
- UI Automation によるフォーカス、実行、値の変更といった意味のあるイベントの記録は、Windows と macOS ともに未実装です。
- `onnxruntime-node` は `win32-x64` と `win32-arm64` のバイナリを同梱しているため、文字起こしのためのコンパイラーは不要です。
- 単体の FFmpeg は、`video-frames.json` が導入される前の録画から画像を抽出する場合にだけ参照します。単体版の同梱や取得は行いません。Electron の標準 LGPL コーデック `ffmpeg.dll` はランタイムに含まれます。
- Windows のコードは型検査、UI Automation スクリプトの PowerShell パース検査、`win32` の解析評価（`evals/scenarios/windows-deploy.ts`）でも確認します。
