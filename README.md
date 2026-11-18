# Skill Recorder

## 日本語版

[Microsoft の Skill Recorder v0.9.2](https://github.com/microsoft/skill-recorder/releases/tag/v0.9.2) をベースにした個人フォークです。元のコミットは [63bbb50](https://github.com/microsoft/skill-recorder/commit/63bbb50111713b02f3bc0ebbd5f354f4eb038f99) です。

- 録画、セッション一覧、解析、スキルと自動化の作成画面を日本語化しました。
- 文字起こしの既定値は OS の優先言語に従います。日本語環境では「既定（日本語）」と表示されます。
- 解析で選んだ言語でセッション名、目的、操作手順を生成します。解析済みの録画では「再解析」で言語を選び直せます。

### Windows で日本語版をソースから起動

Node.js 24.19 以降の 24 系と npm 11.17 以降を使います。PowerShell 7 で次のコマンドを実行してください。

~~~powershell
git clone --branch ja/v0.9.2 https://github.com/KotorinChunChun/skill-recorder-ja.git
Set-Location skill-recorder-ja
npm run check:lockfile
npm ci --ignore-scripts=false --dangerously-allow-all-scripts=false --strict-allow-scripts
npm run electron:install-reviewed
npm run compliance:licenses
npm run build
npm start
~~~

手動ビルドの詳細は [INSTALL.md](INSTALL.md#manual-developer-setup) を参照してください。

Skill Recorder は、作業画面、アプリやウィンドウの切り替え、閲覧ページ、任意で開く記録対象のターミナルのコマンドと出力、任意の音声解説を記録します。GitHub Copilot CLI を使って作業の目的と手順を再構成し、次の形式で再利用できるようにします。

- **スキル**は、必要なときにエージェントが実行する `SKILL.md` 形式の手順です。
- **自動化**は、スケジュールや条件をもとに実行する手順です。

1回の操作例から、同種の作業にも使える手順を生成します。画面上のクリックをそのまま再現するより、`gh` CLI や `web_fetch` など、エージェントが直接利用できるツールを優先します。

<p align="center">
  <img src="docs/images/recorder.png" alt="公式版の録画画面。録画ボタン、タイマー、音声解説の切り替え、言語とマイクの設定、準備状況が並ぶ" width="420">
  &nbsp;&nbsp;
  <img src="docs/images/library.png" alt="公式版のセッション一覧。左に録画、右に解析された目的と手順が並ぶ" width="520">
</p>

<a id="how-it-works"></a>

## 使い方

1. **録画する。** 録画ボタンか、システム全体で使える `⌘⇧R`（macOS）または `Ctrl+Shift+R`（Windows）で録画を始め、普段どおりに作業します。画面と操作は端末内で記録されます。
2. **録画中に操作する。** 最前面の小さな操作バーで、録画、マイク、記録対象のターミナルの状態を確認できます。ターミナルを開く、マイクをミュート・解除する、入力を切り替える、録画を終了する、確認して破棄するといった操作ができます。
3. **解析する。** セッション一覧で「録画を解析」を選びます。選択した AI プロバイダーが目的と操作手順をまとめます。結果を確認し、必要に応じて編集してください。
4. **作成する。** 確認した解析をもとに、スキルや自動化を作成します。

「SKILL.md を確認」では、追加やエクスポートの前に、先頭の設定情報を含むファイル全体を読み取り専用で確認できます。プレビューを準備した段階ではスキルファイルは作成されません。画面を閉じても同じプレビューを再表示でき、どちらの画面から追加・エクスポートしてもその内容が使われます。手順を編集するとプレビューは破棄されます。プレビューは任意で、生成した手順を読むためのものです。実行時の安全性を保証するものではありません。

<a id="import-an-existing-recording"></a>

### 保存済みの録画を読み込む

録画ボタン横のフォルダーアイコンから、Teams のデモ動画など、この端末に保存された MP4 または WebM を選びます。Chromium が動画と音声を確認し、対応していないコーデックや暗号化、非対応のトラック構成、破損、制限超過を検出した場合は理由を表示します。変換ソフトや単体の FFmpeg、追加コーデックの導入は不要です。

- ファイルは最大 **512 MiB**、**15 分**、**3840 × 2160 ピクセル相当**です。
- 映像トラックは1つ、音声トラックは最大1つです。音声はモノラルまたはステレオで、48 kHz 以下です。
- MP4 は AVC、HEVC、VP9、AV1 の映像と AAC または Opus の音声を、WebM は VP8、VP9、AV1 の映像と Opus または Vorbis の音声を認識します。読み込めるかどうかは、同梱の Chromium が実際にデコードできるかで決まります。

512 MiB、15分のステレオ音声付き動画を Windows ARM64 で読み込んだ検証では、Whisper がメモリに読み込まれた状態で Electron プロセス全体のメモリ使用量が約 4.6 GB（4.25 GiB）に達しました。他のアプリと外部の Copilot CLI プロセスを除いた実測値です。デコーダーのワーキングセットには 2 GiB の上限があり、ファイルサイズが制限内でもこの上限を超える動画は読み込めません。

検証後は「補足情報」に作業の内容や該当箇所の時刻を入力できます。時刻は AI の参考情報として使われます。動画全体が処理される場合もあります。音声付きの動画では音声と生成結果の言語を選びます。解析前に端末内の Whisper で文字起こしします。初回はモデルのダウンロードについて案内し、文字起こしに失敗したときは解析を止めて再試行できるようにします。音声のない動画や発話が検出されない動画にも対応します。

解析結果は通常の録画と同じ画面で確認できます。操作の説明を編集し、追加、削除、並べ替えをしてからスキルを作成できます。読み込んだ動画の解析で使う情報は、映像、発話、補足情報です。画面にも音声にも現れないクリップボードの内容やコマンドは復元できません。

元のファイルは保存場所に残ります。ローカルに作ったコピーと関連データはセッションに保存され、そのセッションを削除するとコピーが削除されます。ファイル選択時点ではデータを送信しません。「録画を解析」を選ぶと、選択した画像、文字起こし、補足情報が既存のプライバシー保護処理を経て AI プロバイダーに送信されます。デバッグ用データには、録画の場合と同様に、読み込んだ動画や補足情報も含まれます。利用権限のある動画を使い、機密情報の混入を避けてください。動画の読み込み操作にマイクや画面収録の権限は不要です。

`npm test` に読み込みの仕様とプライバシーのテストが含まれます。`npm run test:import:runtime` は確認済みの Electron を使って Chromium で MP4 と WebM の合成動画を作り、デコード、再生位置の移動、無音や音声なし、非対応コーデック、キャンセル、元ファイルの保持を検証します。リリース対象の環境ごとに実行し、代表的な Teams の録画も確認してください。`-- --large` を加えると、ちょうど 512 MiB の MP4 の読み込みと、1バイト超過したファイルの拒否も確認できます。この検証にはメモリと一時ディスク容量が必要です。初期の実測と実行時検証は Windows ARM64 で行っています。

<a id="get-started"></a>
<a id="install-it"></a>

## Microsoft 公式版の導入

[Microsoft の公式リリース](https://github.com/microsoft/skill-recorder/releases/latest) では、指定コミットを端末上でビルドするソースインストーラーを提供しています。対応する Node.js を取得し、端末内に **Skill Recorder (Source)** の起動項目を作ります。システム全体へのインストールは不要です。主な対象は macOS で、Windows 11 の x64 と ARM64 にも対応します。[Windows の検証](WINDOWS-VALIDATION.md)

1. リリースページの **Commit-pinned installation** で Windows 11 x64 or ARM64 または macOS or Ubuntu を選び、コードブロックのコマンド全体をコピーします。
2. Windows は PowerShell、macOS と Ubuntu はターミナルで実行します。
3. ビルドが完了するまでウィンドウを開いたまま待ちます。Windows では、録画中なら終了し、起動中のすべての Skill Recorder で **Quit** を選んで閉じてから、デスクトップかスタートメニューの **Skill Recorder (Source)** を開きます。macOS と Ubuntu では、通常はインストーラーが起動します。初回は数分かかる場合があります。

> [!IMPORTANT]
> リリースページのコマンドには正しいコミットが含まれています。`<40-character-release-commit>` が残った例はそのまま実行できません。リリースの **Assets** に並ぶ **Source code (zip)** と **Source code (tar.gz)** はソースのアーカイブです。この導入方法では Git や Node.js をあらかじめ入れる必要はありません。

事前にスクリプトを確認する方法、起動設定、更新、アンインストールは [`INSTALL.md`](INSTALL.md) を参照してください。組織の実行ポリシーに従ってください。

Windows ではショートカット、macOS では `~/Applications` や Spotlight、Launchpad、Ubuntu ではアプリ一覧から再起動できます。新しい版で再度起動操作をすると、すでに動いている録画画面または操作バーが表示されます。この仕組みを持たない古い版は、更新後の版を開く前に終了してください。

<a id="then-record"></a>

### 録画と AI 接続

macOS では初回起動時に画面収録の許可が必要です。録画そのものに AI 接続は不要です。初めて解析や生成を行うときは、セッション一覧の「AI 接続」で「独自のモデルを使う」か「GitHub で認証」を選びます。設定がない場合は、すでに使える GitHub Copilot のログインを検出して再利用します。0.8.0 からの更新でも同じです。いずれの接続方法も Microsoft の従業員を含めて選べます。

GitHub 認証が必要な場合は、既定のブラウザーでログインと承認を完了します。アプリがアクセスを確認し、中断した解析を一度だけ再試行します。サインインをキャンセルするか該当の解析を離れた場合は、自動で再試行しません。

Windows では端末内の Microsoft Entra テナント情報をもとに、**Microsoft Enterprise SSO** と **Personal GitHub account** の選択が表示されることがあります。この情報は接続経路の選択に使います。Microsoft SSO で `github.com/enterprises/microsoft` に到達したら、そのタブを閉じて Skill Recorder に戻り、**Authorize Copilot** を選んで GitHub Copilot アプリを承認してください。2つの操作で同じブラウザープロファイルと、Microsoft に紐づいた GitHub アカウントを使います。テナント情報がない端末や macOS、Linux では標準の GitHub サインインに進みます。勤務先メールアドレスの入力は不要です。

承認には Copilot CLI の Web OAuth を使います。同じブラウザープロファイルなら、GitHub の SSO セッションを利用してデバイスコードの入力なしで承認できます。再ログインを求められたら、ブラウザープロファイルを確認してください。承認後はタブを閉じ、Skill Recorder に戻ります。固定の Copilot CLI 1.0.78 で `--no-auto-update login --web-flow` を使うため、自動更新キャッシュにある別のバージョンに依存しません。1.0.71 など、古い同梱版は `--web-flow` に対応していません。

サインインはキャンセルでき、5分でタイムアウトします。ブラウザーからのログインに失敗すると、アプリにエラーと同梱 CLI の手動コマンドが表示されます。Windows では PowerShell で実行し、手動サインイン後は解析を再試行してください。スキルや自動化の作成画面でサインインした場合は、作成や導入を自分で再開します。

<a id="bring-your-own-model"></a>

### 独自のモデルを使う（BYOM）

セッション一覧の「AI 接続」から設定します。BYOM は同梱の Copilot SDK と CLI を使いますが、GitHub ログインや Copilot 契約は不要です。モデルへのリクエストは選んだ接続先に送信され、プロバイダー側の料金が適用されます。

| プロバイダー | 必要な設定 |
| --- | --- |
| Microsoft Foundry / Azure OpenAI (v1) | API キー、`/openai/v1/` を含むベース URL、デプロイ名 |
| Azure OpenAI（バージョン指定） | API キー、API パスなしのリソースホスト、デプロイ名、Azure API バージョン |
| OpenAI | API キーとモデル ID。標準のベース URL は入力済み |
| Anthropic | API キーとモデル ID。標準のベース URL は入力済み |
| カスタム（OpenAI 互換） | API キー、HTTPS のベース URL、モデル ID、対応する API 形式 |

画像入力とツール呼び出しに対応したモデルを使います。「詳細設定」で対応するプロバイダーの Responses API または Chat Completions API を選べます。「テストして保存」は合成画像とツール呼び出しを送信するため、利用料金がかかります。録画ファイルはこのテストでは送信されません。カスタム接続先が使えるかどうかは、実際のプロトコルとモデルの互換性で決まります。キーなしのローカルサービスやマネージド ID による認証は、この設定画面では選べません。

Windows 11（x64、ARM64）、macOS と、対応するデスクトップのキーリングを備えた Ubuntu では OS の安全なストレージでキーを保護します。ストレージを利用できないときはキーをメモリだけに保存し、次回起動時に再入力を求めます。秘密でない設定は、保存できる範囲で保持します。「キーを削除」はアプリ内のキーを削除する操作です。プロバイダー側のキーはそこで管理してください。

AI 接続を切り替える前に、進行中の AI 処理を終了またはキャンセルしてください。録画や保存済みの結果は保持され、進行中の会話はリセットされます。キーはデバッグ用データに含まれません。接続設定と SDK の会話状態は、録画とは別にアプリデータに保存されます。キーを削除しても会話履歴は残ります。

`npm run test:ai` は接続設定、セキュアストレージやメモリでの保存、接続の状態遷移を確認します。`npm run test:ai:runtime` は合成プロバイダーを端末内で立ち上げ、同梱の SDK と CLI による画像・ツールのやり取りとキーの保存状態を確認します。どちらも実際の API キーや有料モデルは使いません。OS のキー保管や実プロバイダーでの確認は [AI 接続と認証情報の確認](WINDOWS-VALIDATION.md#ai-connection-and-credential-smoke-checks) を参照してください。

<a id="what-gets-captured"></a>

## 記録と送信の内容

録画、保存、画像の抽出、任意の音声文字起こしは端末内で行います。「録画を解析」を選ぶと、イベント時系列（ウィンドウや文書のタイトル、URL、コピー内容の冒頭、ターミナルのコマンド）、抽出画像、文字起こし、解析中に要求された範囲のターミナル出力を、選択した AI プロバイダーに送信します。保護が有効なら、要求された出力を送る前に、コマンドとローカルに保存したターミナル出力全体から秘密情報や個人を識別できる情報を端末内で検査します。

- **ウィンドウ**は、アクティブなアプリやウィンドウの切り替えを記録します。
- **ブラウザー**は、開いているページの URL を取得します。Windows では [アドレスバーの表示値](docs/windows-capture.md) を使います。
- **画面**は Chromium で録画します。低頻度の画像は、画面が変わったときか定期保存の時刻に残します。
- **クリップボード**は、コピーしたテキストの冒頭を記録します。
- **音声解説**は任意です。Whisper が対応する99言語で端末内の文字起こしを行います。初回に約252 MBのモデルを取得します。
- **記録対象のターミナル**は、録画操作バーから開いた場合に限り、コマンド、作業ディレクトリ、シェル、終了状態、実行時間、出力全体を記録します。出力のアプリ独自の上限はなく、録画の容量に含まれます。既存ターミナルの監視、シェル設定の変更、グローバルフックの追加は行いません。

> [!WARNING]
> 録画中はパスワード、アクセストークン、API キー、認証情報、機密情報を画面に表示したり、入力、貼り付け、コピー、読み上げをしたりしないでください。録画前にもアプリで案内します。

<a id="develop-from-source"></a>

## 開発環境

リリースのソースを入手し、Node.js 24 系を使います。準備のコマンドは [手動開発環境の構築](INSTALL.md#manual-developer-setup) を参照してください。依存関係と確認済み Electron を準備したあと、`npm run dev` で Vite と Electron をホットリロード付きで起動できます。配布用ビルドやライセンスの扱いは [`INSTALL.md`](INSTALL.md) に、バージョンや依存関係を変更してリリースする手順は [`RELEASING.md`](RELEASING.md) にあります。

<a id="evals"></a>

## 評価

合成録画を使い、Copilot による解析とスキル・自動化の作成を評価できます。[評価の詳細](evals/README.md)

~~~bash
npm run eval            # 合成録画の解析を採点
npm run eval:terminal   # ターミナル出力の検索とマスキングを評価
npm run eval:builder    # スキルや自動化への汎化を評価
~~~

<a id="documentation"></a>

## ドキュメント

- [インストール、更新、開発環境](INSTALL.md)
- [リリース手順](RELEASING.md)
- [Windows の動作確認](WINDOWS-VALIDATION.md) と [Windows での記録](docs/windows-capture.md)
- [評価の手順](evals/README.md) と [将来の機能](docs/future-features.md)
- [第三者ライセンスと表示の日本語案内](docs/third-party-notices-ja.md) と [原文](THIRD-PARTY-NOTICES.md)

<a id="security"></a>

## セキュリティ

脆弱性は公開 GitHub Issues に記載せず、[セキュリティ窓口](SECURITY.md) を確認してください。

<a id="support"></a>

## サポート

不具合や機能要望の窓口は [サポート案内](SUPPORT.md) にあります。報告の前に既存の Issue を検索してください。

<a id="license"></a>

## ライセンス

[MIT License](LICENSE)

<a id="contributing"></a>

## コントリビューション

[コントリビューションの条件](CONTRIBUTING.md) と [行動規範](CODE_OF_CONDUCT.md) を確認してください。Microsoft の公式リポジトリに送る Pull Request では、Contributor License Agreement（CLA）への同意が必要になる場合があります。CLA bot が対象を判定し、Pull Request の状態チェックやコメントで手順を案内します。同じ CLA を使うリポジトリでの手続きは1回です。[Contributor License Agreements](https://cla.opensource.microsoft.com)

<a id="trademarks"></a>

## 商標

Microsoft の商標やロゴを使う場合は [Microsoft Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general) に従ってください。改変版で Microsoft の公式提供や支援を受けていると誤解させる使い方を避けてください。第三者の商標とロゴには、各権利者の方針が適用されます。
