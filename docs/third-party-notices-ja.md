# 第三者ライセンスと表示の日本語案内

この文書は [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) の日本語訳です。再配布の条件は、元の表示と各コンポーネントのライセンス原文を参照してください。

Skill Recorder は [MIT License](../LICENSE) で公開されています。配布用ビルドに含まれる第三者コンポーネントには、それぞれの条件が適用されます。対応するリリースコマンドは、パッケージのライセンス全文、ネイティブ コンポーネントの表示、コピーレフト ライセンスの原文、対応ソースコードと再リンク手順をプラットフォーム別に生成し、`resources/compliance/` に格納します。Electron の正確な表示は `resources/compliance/electron/` にあり、Electron のルートに表示ファイルを保持できる環境ではそちらにも含まれます。

ほかの依存関係には MIT、ISC、Apache-2.0、BSD、Artistic-2.0、BlueOak-1.0.0 などの寛容なライセンスが適用されます。アプリを MIT License で配布でき、依存関係はそれぞれの条件に従います。生成する `THIRD-PARTY-LICENSES.txt` にライセンスと帰属表示を保持します。

## 必要に応じてダウンロードするモデル

### OpenAI Whisper small（Xenova/whisper-small）

- 利用者が明示的に承認したときだけ、[Xenova/whisper-small](https://huggingface.co/Xenova/whisper-small) から多言語モデルを取得します。重みはアプリに同梱しません。
- Transformers.js で使える ONNX 形式への変換は、OpenAI の [openai/whisper-small](https://huggingface.co/openai/whisper-small) をもとに、Xenova（Joshua Lochner）が公開しています。
- Hugging Face のモデル情報は **Apache-2.0** としています。OpenAI の [Whisper リポジトリ](https://github.com/openai/whisper) では、コードとモデルの重みを **MIT License** で公開しています。取得するモデルには配布元が定める条件が適用されます。

### Tesseract の英語データ（tessdata_fast/eng.traineddata）

- 高度な保護で OCR が有効なとき、[tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) から英語認識用のデータを直接取得します。
- コミットは [65727574dfcd264acbb0c3e07860e4e9e9b22185](https://github.com/tesseract-ocr/tessdata_fast/tree/65727574dfcd264acbb0c3e07860e4e9e9b22185)、SHA-256 は `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` に固定しています。
- 言語データには Apache-2.0 が適用されます。配布元から取得するデータですが、ライセンス原文は `resources/compliance/tesseract-core/` に保持します。

## 同梱する実行時コンポーネント

### GitHub Copilot CLI（@github/copilot）

- `@github/copilot` と環境別の `@github/copilot-<platform>-<arch>` には、プロプライエタリの **GitHub Copilot CLI License** が適用されます。`node_modules/@github/copilot/LICENSE.md` を参照してください。
- MIT License の `@github/copilot-sdk` を通じて取得し、別のプロセスで実行します。
- 再配布は、このアプリに改変していないコピーを同梱し、ライセンスと著作権・帰属表示をすべて保持する場合に認められます。CLI のライセンスはアプリ独自のライセンスを制限しないため、アプリの MIT License による配布を妨げません。

### Electron と Chromium のメディアコーデック

- Electron は **MIT License** です。Chromium に含まれる `ffmpeg.dll`（環境によって `libffmpeg.dylib` または `libffmpeg.so`）は動的に読み込むコーデックライブラリです。同梱の表示では FFmpeg を **LGPL-2.1-or-later** としています。GPL の部分を含めるには、標準と異なる FFmpeg のビルド設定を明示的に選ぶ必要があります。
- Electron の `LICENSE.electron.txt` と `LICENSES.chromium.html` をすべての配布用パッケージに保持します。Chromium の表示は環境ごとに異なるため、それぞれを確認します。
- ソースは Electron [v43.1.1](https://github.com/electron/electron/tree/v43.1.1)、Chromium [150.0.7871.114](https://chromium.googlesource.com/chromium/src/+/150.0.7871.114)、Chromium FFmpeg の [ad41607c61898cf7150e0fb20fe4bbabd44922a3](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/ad41607c61898cf7150e0fb20fe4bbabd44922a3) に固定しています。Electron のソースアーカイブと、FFmpeg に適用されたパッチ一式をリリースに含めます。
- Chromium が WebM の録画、画面画像の取得、音声解説のデコードを行います。読み込んだ MP4 や WebM の動画・音声も同じランタイムでデコードします。
- `ffmpeg-static` や単体の FFmpeg 実行ファイルは同梱しません。画像一覧ファイルが導入される前の録画を読む場合に限り、利用者が導入した単体の FFmpeg を使うことがあります。

### Sharp と libvips（sharp、@img/sharp-*）

- `sharp` は **Apache-2.0** です。Windows のネイティブパッケージは **Apache-2.0 AND LGPL-3.0-or-later** に従います。他の環境は、対応する **LGPL-3.0-or-later** の `@img/sharp-libvips-*` を読み込みます。
- ソースは Sharp [v0.35.3](https://github.com/lovell/sharp/tree/v0.35.3)、再現用のパッケージ作成スクリプト [sharp-libvips v1.3.2](https://github.com/lovell/sharp-libvips/tree/v1.3.2)、libvips [v8.18.3](https://github.com/libvips/libvips/tree/v8.18.3) に固定しています。配布用パッケージのネイティブ モジュールはアーカイブ外に置き、置き換えられるようにします。
- Sharp は WebAssembly 版の `@img/sharp-wasm32` も公開しています。FreeBSD と WebContainers 向けのラッパーに対象環境の条件があるため、npm はこの依存パッケージ自体をすべての環境で導入します。Skill Recorder は使用せず、WASM 専用の依存関係 `@emnapi/runtime` と併せ、配布用パッケージから除外します。
- ネイティブ バイナリには MPL-2.0、MIT、BSD、ISC、fontconfig、FreeType、libpng、libtiff、zlib などの条件が適用されるライブラリも含まれます。配布元の正確な一覧は `resources/compliance/NATIVE-THIRD-PARTY-NOTICES.md` にあります。

### ONNX Runtime

`onnxruntime-node`、`onnxruntime-web`、`onnxruntime-common` は MIT License です。npm パッケージには個別のライセンスや第三者表示ファイルがないため、固定した各ソースの正確な表示を `resources/compliance/onnxruntime/` に収録します。

### Tesseract OCR の WebAssembly（tesseract.js、tesseract.js-core）

- `tesseract.js@7.0.0` と `tesseract.js-core@7.0.0` は Apache-2.0 です。対応ソースコードの提供は要求されませんが、ライセンス、著作権表示、該当する通知の保持が必要です。
- 同梱する WebAssembly は [tesseract.js-core のコミット acffef2b66eb44a31df297e11d905f4b39001068](https://github.com/naptha/tesseract.js-core/tree/acffef2b66eb44a31df297e11d905f4b39001068) からビルドします。ビルドスクリプトは `SOURCE-MANIFEST.json` に記載した GIFLIB、Leptonica、IJG libjpeg、libpng、libtiff、libwebp、OpenLibm、Tesseract、zlib の各版を静的にリンクします。
- 配布元の正確な条件は `resources/compliance/tesseract-core/` に、ビルドスクリプトとリンクした9プロジェクトの固定ソースアーカイブは `resources/compliance/sources/` に保持します。
- IJG が求める表示は次のとおりです。**This software is based in part on the work of the Independent JPEG Group.**
- OpenLibm のソースに含まれるテストファイルの一部には LGPL が適用されます。静的ライブラリをビルドする際、これらのテストはコンパイルされず、OCR の WebAssembly にリンクされません。

### 配布用の対応ソースコード

配布用ビルドは GPL-3.0、LGPL-2.1、LGPL-3.0、MPL-2.0 の全文を含みます。Electron の FFmpeg、Sharp、libvips、Sharp のネイティブ バイナリに埋め込まれた全ライブラリ、対象のパッケージ作成用リポジトリのソースアーカイブと、外部から適用したビルドパッチも含めます。

再現性と表示の保持のため、Tesseract.js-core の固定ビルドソース、静的にリンクしたすべての OCR 用ソース、Artistic-2.0 の依存関係の改変していないソースパッケージを同梱します。

`SOURCE-MANIFEST.json` にはファイルごとの入手元、版、SHA-256、用途を記録します。外部から取得するファイルはすべて、利用前に確認済みの SHA-256 と照合します。FFmpeg のアーカイブは固定した Git コミットから同じ内容で再生成できます。`RELINKING.md` に環境別の共有ライブラリの位置と、再ビルド・置き換え手順を記載します。

### その他のネイティブ モジュール

- `get-windows` は MIT License です。
- `koffi` と `@koromix/koffi-*` は MIT License です。Windows ARM64 のネイティブビルドを含め、Win32 で前面ウィンドウを調べるために使います。
- `sharp` は Apache-2.0 です。ネイティブ バイナリの条件は上の Sharp と libvips の項目を参照してください。

## Apache-2.0 のコンポーネント

`sharp`、`tesseract.js`、`tesseract.js-core` などには Apache-2.0 が適用されます。著作権表示、ライセンス、該当する `NOTICE` の内容を保持してください。公開手順は、実際に導入した依存関係から `resources/compliance/THIRD-PARTY-LICENSES.txt` に収集し、確認済みの資料が不足するパッケージがある場合は停止します。

## Artistic-2.0 のコンポーネント

secretlint のテキスト判定処理は、Artistic-2.0 の `binaryextensions`、`editions`、`istextorbinary`、`textextensions`、`version-range` に依存します。配布用ビルドには著作権表示、`resources/compliance/licenses/` にある Artistic-2.0 の全文、`SOURCE-MANIFEST.json` が示す改変していないソースパッケージを含めます。

## ライセンス一覧を生成する

対応ソースコードを取得せずに、導入済みパッケージの表示を検証するには次を実行します。

~~~sh
npm run compliance:licenses
~~~

`npm run dist*` はすべて、完全なコンプライアンス資料を作る `npm run compliance:prepare` を自動で実行します。資料が不完全な場合や、ビルド出力フォルダーを再帰的に梱包してしまった場合は、Electron Builder の `afterPack` がインストーラーの作成を中止します。
