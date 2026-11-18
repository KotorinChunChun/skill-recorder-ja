# Windows の動作確認

Skill Recorder は Windows 11 の x64 と ARM64 をネイティブでサポートします。アーキテクチャ別の検査は [`.github/workflows/windows.yml`](.github/workflows/windows.yml) にあり、GitHub Actions の `windows-latest` とネイティブの `windows-11-arm` で実行します。

<a id="architecture-sensitive-components"></a>

## アーキテクチャ別のコンポーネント

| コンポーネント | Windows x64 | Windows ARM64 | 備考 |
| --- | --- | --- | --- |
| Electron 43 | 対応 | 対応 | 公式アーカイブ |
| Koffi と前面ウィンドウ取得用 FFI | 対応 | 対応 | ビルド済みの N-API パッケージ。コンパイラー不要 |
| Sharp / libvips | 対応 | 対応 | `@img/sharp-win32-*` パッケージ |
| ONNX Runtime | 対応 | 対応 | `onnxruntime-node` に両方のバイナリが入る |
| GitHub Copilot CLI | 対応 | 対応 | `@github/copilot-win32-*` パッケージ |
| TypeScript、Rolldown、Lightning CSS | 対応 | 対応 | 両方のネイティブ開発用パッケージがある |
| 単体版 FFmpeg / `ffmpeg-static` | 不要 | 不要 | 現行のメディア処理は Chromium を使う |
| Electron のコーデックライブラリ `ffmpeg.dll` | 同梱 | 同梱 | LGPL-2.1+。Electron 標準のコンポーネントと表示 |

`get-windows` は macOS と Linux 向けの任意依存関係です。Windows は Koffi から `user32`、`dwmapi`、`kernel32` を呼びます。Windows 向けの `get-windows` のバイナリがなくても、導入と記録は行えます。

<a id="why-native-arm64-installation-now-works"></a>

## ARM64 のネイティブ環境での導入

以前は `ffmpeg-static` の postinstall スクリプトに Windows ARM64 向けのバイナリがなく、導入に失敗していました。現在は `package.json`、lockfile、Vite の外部依存関係、electron-builder の展開ルール、配布パッケージから削除されています。

画面録画は Chromium の VP8・VP9 対応 `MediaRecorder` を使います。録画用レンダラーは並行してデスクトップのトラックを読み、毎秒1フレームの画像を重複排除し、少なくとも5秒ごとに画像を保存します。後処理は WebM をデコードせず、JPEG を選択、切り出し、重複排除します。

音声解説は、非表示の Chromium レンダラーで `AudioContext` を使って Opus/WebM をデコードし、16 kHz のモノラルに変換・再サンプリングします。メインプロセスが無音を検出してから Whisper で文字起こしします。

<a id="automated-gate"></a>

## CI の検査

Windows の各アーキテクチャで、CI は次を行います。

1. ネイティブの Node.js 24 を導入して `npm ci` を実行する。
2. Sharp、ONNX Runtime、Koffi を読み込む。
3. ユニットテストと本番用ビルドを実行する。
4. アーキテクチャ専用の NSIS インストーラーを作成する。
5. パッケージの PE の種類と、Sharp、ONNX、Koffi、Copilot のバイナリのアーキテクチャを確認する。
6. ファイルと `app.asar` の中身を調べ、`ffmpeg-static` や単体の FFmpeg 実行ファイルが入っていれば失敗させる。Electron のコーデック DLL とライセンス表示も確認する。

公開時は、[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) に記載された、版を固定した LGPL のソースコードと再リンク資料の添付が必要です。

ローカルで同等の検査を行う場合は以下を使います。

```powershell
npm ci
npm test
npm run build
npm run dist:win:arm64  # on native Windows ARM64
node scripts/verify-windows-package.mjs arm64
```

x64 では `dist:win:x64` と `x64` を指定します。対象と同じアーキテクチャの環境でビルドすると、npm が適切な任意依存関係を選びます。パッケージ作成スクリプトはアーキテクチャをまたぐビルドを拒否し、Koffi、Sharp、Copilot にビルド元の異なるバイナリが混在するのを防ぎます。

<a id="manual-windows-arm64-smoke-test"></a>

## Windows ARM64 実機での基本動作確認

デスクトップの権限と実際の前面アプリを確認するため、リリース前に Windows 11 ARM64 実機で次を試します。

1. `node -p "process.arch"` と実行中の Electron がともに `arm64` を示すことを確認します。
2. 2分間録画し、15秒以上静止した画面を記録してから、Win32 アプリ、設定、ブラウザー、管理者権限のアプリを切り替えます。
3. `app.activate` にウィンドウを所有するプロセスが記録されることを確認します。設定アプリでは `ApplicationFrameHost.exe` 以外の実際の所有者を確認します。管理者権限のアプリへの切り替えでクラッシュしないことも確認します。
4. `video.webm`、`video-frames.json`、`video-frames/` の定期保存画像、`frames/` に残した JPEG を確認します。
5. セッション解析で切り出し画像を要求し、寸法が指定どおりで文字を読めることを確認します。
6. 音声解説を録音して文字起こしし、単体の FFmpeg を入れずに時刻付きの区間を生成できることを確認します。
7. 変更前の録画を開きます。単体の FFmpeg があれば従来形式の画像を抽出でき、なければイベントだけで解析できることを確認します。FFmpeg がないときは、対処法を含む互換性の警告が1回記録されます。

<a id="ai-connection-and-credential-smoke-checks"></a>

## AI 接続と認証情報の確認

Windows 11 の x64 と ARM64 で次を確認します。macOS と Ubuntu の対応を検証する場合は、キーの保存と再起動の確認も実施します。

1. AI 接続を未設定にして解析を選び、BYOM と GitHub の両方が提示されることを確認します。録画だけならどちらも不要です。
2. GitHub を選び、Microsoft テナント情報による SSO と標準の個人アカウントの両方の経路を確認します。
3. GitHub にはログインせず、画像入力とツール呼び出しに対応する BYOM モデルを設定します。解析、スキル作成、自動化作成を確認します。接続の合成テストには料金がかかります。
4. 再起動し、Windows は DPAPI、macOS は Keychain、Ubuntu は対応するデスクトップのキーリングから、保存したキーを読み込めることを確認します。
5. ストレージが利用できないかロックされている状態で、キー入力欄にメモリ保持の案内が表示され、BYOM をそのまま使えることを確認します。再起動後はキーの入力を求め、接続先とモデルは保持します。
6. キーを削除して再起動し、復元されないことを確認します。処理の実行中に接続を切り替えられず、待機中のモデルとの会話は接続の切り替えでリセットされることも確認します。
7. テスト用キーの印が、アプリとランタイムのログ、生成ファイル、デバッグ用データに含まれないことを確認します。認証情報を保護せずに書き出したり、エクスポートしたりしてはいけません。

ユニットテストはストレージを差し替えて保存可能・不可能の挙動を調べます。OS の実機や実際のプロバイダーでの確認は別途行います。

<a id="known-limitations"></a>

## 既知の制限

- URL の記録は Windows PowerShell の UI Automation の補助プロセスを使います。アプリとウィンドウの記録は PowerShell に依存しません。
- 画面の画像は意図的に毎秒1フレームまでに制限しています。高い密度を要求しても細部は増えません。
- 単体の FFmpeg は旧形式の録画向けの任意依存関係です。新規録画での取得、同梱、導入は不要です。Electron 標準の LGPL コーデック DLL はランタイムに含まれます。
