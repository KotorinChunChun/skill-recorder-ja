# Skill Recorder の評価

GitHub Copilot の解析エージェントは、録画から作業の目的と順序付きの手順を推定します。この評価は、固定した合成録画を入力し、結果を評価基準と照合して、変動しやすい解析の品質を確認するためのものです。

<a id="why-fixture-based-not-live-capture"></a>

## 合成データを使う理由

実際のアプリと画面収録は、速度や環境によって結果が変わります。固定したイベント列で解析部分を切り出すと、1シナリオ約15～25秒で再実行でき、失敗をモデルや指示文の問題に絞れます。イベントは同じ作業をしたときに実際の収集処理が出力する形に合わせています。映像は使いません。実録画で端から端まで試せるよう、対応する [モックページ](#mock-pages-evalsmocks) も用意しています。

<a id="run"></a>

## 実行

```bash
npm run eval                       # all scenarios
npm run eval:terminal              # recorded-terminal command/output scenarios
npm run eval -- --only=web-to-spreadsheet
npm run eval -- --judge            # also run the semantic LLM judge
npm run eval -- --keep             # print the temp sessions dir (artifacts kept)
npm run eval -- --model=<model-id> # override the describer model
```

アプリと同じ認証を使うため、GitHub Copilot CLI へのサインインが必要です。シナリオが1つでも失敗すると終了コードは 0 以外になります。結果の詳細は Git 管理外の `evals/results/<timestamp>.json` に出力します。

ランナーは Node.js の TypeScript 対応（`--experimental-transform-types`）と解決フック（`evals/register.mjs` → `evals/hooks.mjs`）を使います。拡張子のないインポートを `.ts` へ解決し、`electron` のインポートを画面を持たないスタブ `evals/electron-stub.mjs` へ置き換えて、アプリのソースを直接実行します。

<a id="how-a-run-works"></a>

## 1シナリオの処理

1. `session.json` と `events.jsonl` から合成セッションを作り、`SKILL_RECORDER_SESSIONS_DIR` で指定した専用の一時フォルダーに置きます。
2. 実際の `processSession()` を呼び、アプリで録画を停止したときと同じように `bundle.json` と `description.md` を作成します。
3. アプリと同じ `Describer` の `analyze(id)` を呼びます。エージェントは時系列やイベントを読み、曖昧な箇所で画像を参照する仕組みを使い、`submit_analysis` で結果を提出します。
4. 解析をシナリオの基準で採点します。

<a id="scoring"></a>

## 採点

`scoring.ts` が LLM を使わずに、次の基準で合否を判定します。

- **目的のキーワード**。目的の文に正しい対象が含まれる。
- **手順数**。期待する範囲内であり、細かすぎたり粗すぎたりしない。
- **使用アプリ**。期待するアプリが現れる。
- **操作の順序**。「ページを開く → コピー → スプレッドシートへ」のように主要操作が正しい順序で並ぶ。
- **必須の値**。指定したコピー内容や対象が含まれる。
- **除外項目**。Skill Recorder の開始と停止、権限ダイアログ、トラッキング パラメーターでの遷移などが手順に含まれない。検査するのは手順名、アプリ名、目的で、本文で無関係な操作を除外したと説明しても失点しない。

除外項目の一致が1つでもあればその場で不合格です。それ以外は検査項目の80%以上で合格です。

`--judge` を指定すると、別の Copilot エージェントが `judge.ts` を使って正解データへの忠実さを0～5点で評価します。この判定は再現性のため既定では無効です。

<a id="scenarios"></a>

## シナリオ

`evals/scenarios/` には、繰り返し行う作業を収録しています。

| ID | 作業 |
| --- | --- |
| `web-to-spreadsheet` | Web ページの価格をスプレッドシートへ転記 |
| `invoice-extract` | Web の表から請求明細を抽出し、スプレッドシートへ転記 |
| `research-compile` | 2本の記事を調べ、引用をノートにまとめる |
| `directory-lookup` | ディレクトリから連絡先を集め、スプレッドシートに記録 |
| `irrelevant-detour` | 習慣の記事を調べる途中で無関係なレシピを開く。目的から外れた操作が除外されるか確認（Chrome、TextEdit） |
| `expense-report` | カードの利用明細を領収書と照合し、経費を申請（Chrome、Preview、Expensify） |
| `release-notes` | マージ済みの Pull Request からリリースノートを作成し、バージョン更新とデプロイを実施（ターミナル、GitHub、エディター） |
| `lead-to-crm` | 問い合わせから見込み顧客を確認し CRM に登録（Mail、LinkedIn、Salesforce） |
| `windows-deploy` | Windows で Web アプリを Azure にデプロイし、稼働 URL を記録（Edge、Windows Terminal の `pwsh`、Excel） |
| `terminal-output-required` | 記録したターミナル出力を検索し、失敗したテストの原因を調べる |
| `terminal-failure-recovery` | 失敗したデプロイと成功した再試行を区別 |
| `terminal-sensitive-output` | 記録されたトークンを漏らさず、ターミナルの結果を利用 |

経費精算、リリース、顧客登録のような長い作業では、複数の対象を順に扱い、ネイティブアプリとブラウザーやターミナルを往復します。最後の申請、デプロイ、コミットまで含めて、手順の分割とアプリの対応付けを確認します。

`irrelevant-detour` では、習慣の記事調査の中で別ホストのレシピを開きます。そのページではコピーも後続の操作もありません。目的は明確なのでレシピ閲覧を除外する必要があります。`recipe`、`allrecipes`、`cookie`、`chocolate` が手順名、アプリ名、目的に入ると不合格です。

貼り付けはイベントが出ないため前後から推定します。録画の開始・停止は除外し、トラッキング パラメーターだけが異なる遷移はまとめ、目的と無関係な寄り道は省きます。

<a id="add-a-scenario"></a>

## シナリオの追加

`evals/scenarios/<id>.ts` を作り、`Scenario` をエクスポートして `evals/scenarios/index.ts` に追加します。`scenario.ts` の `recorder`、`visit`、`appActivate`、`clipboard`、`terminal`、`marker` を使ってイベント列を作り、期待する結果を `rubric` に記述します。`--judge` は `truth` を正解として採点します。

```ts
export const myScenario: Scenario = {
  id: "my-task",
  title: "…",
  truth: "What the user actually did, in plain language.",
  build: () => [ recorder(0), ...visit(1500, "Google Chrome", url, title), clipboard(4000, "…"), recorder(8000) ],
  rubric: { intentKeywordsAny: [["…"]], expectedApps: ["chrome"], orderedActions: [["…"]], forbidden: ["skill recorder"] },
};
```

<a id="builder-evals-evalsbuilder"></a>

## 自動化ビルダーの評価（evals/builder/）

確認済みの解析を Scout の成果物へ変換する最終段階を検証します。以前は、ユーザーの Mac や Windows に認証済みの `gh` CLI がある場合でも、GitHub の作業を汎化する際に Playwright でブラウザーを操作する手順が選ばれていました。

```bash
npm run eval:builder                       # all builder scenarios
npm run eval:builder -- --only=github-issue-triage
npm run eval:builder -- --keep             # print the temp sessions dir
npm run eval:builder -- --model=<model-id> # override the builder model
```

各シナリオは、固定の確認済み `Analysis` と最小の有効な `bundle.json` を一時フォルダーに置き、指定の `architecture` と `platform`（macOS または Windows）で実際の `AutomationBuilder.build()` を実行します。こうして解析時のばらつきを除き、自動化の指示やツール一覧に起因する変化を確認します。採点は手順の `label` と `prompt` に絞ります。要約や汎化の説明で、使わなかったツールに言及しても失点しません。

`score.ts` は、大文字小文字を無視した部分一致で、すべての `mustUseAny` グループでいずれかの同義語が現れ、`forbidden` のいずれも現れないことを求めます。除外対象の一致が1つでもあれば不合格です。

`scenarios.ts` と `native-tool-scenarios.ts` の10シナリオは macOS と Windows を対象とします。GitHub Issue の振り分け（`darwin`）と長期間更新のない Pull Request の通知（`win32`）で `gh` とブラウザーの選択を直接検証し、残る8件は解析評価と対になります。

- `release-notes` と2つの GitHub シナリオは、対応する `gh` の使用を求め、`browser_` と `playwright` を除外します。`windows-deploy` は `az` CLI と作業記録用の `xlsx` スキルを求め、ブラウザーを除外します。
- `web-to-spreadsheet`、`invoice-extract`、`research-compile` は `web_fetch` と、出力に対応する `xlsx` または `docx` スキルを求めます。ログインが必要なページではブラウザーも候補にできます。
- `expense-report`（Amex、Expensify）と `lead-to-crm`（Salesforce、LinkedIn）はブラウザーを使う場面があります。ローカル PDF の領収書を読む `view`／PDF 処理や、メールを読む `workiq_*` など、アプリに依存せず直接使える処理を検証します。

この評価をもとに、[Scout のツール一覧](../electron/architectures/catalogues/scout-catalogue.ts) で端末の CLI、特に `gh` を優先し、zsh・Bash と PowerShell の違いも反映しました。解析評価にシナリオを加えるときは、対応するビルダー評価も追加してください。

<a id="skill-builder-evals-evalsskillbuilder"></a>

## スキルビルダーの評価（evals/skillbuilder/）

確認済みの解析から `SKILL.md` の手順案を作る `SkillBuilder` を検証します。自動化ビルダーの評価は手順の文章からツール選択を調べ、スキルビルダーの評価は手順案の構造も調べます。

```bash
npm run eval:skill                       # all skill scenarios
npm run eval:skill -- --only=price-tracker-skill
npm run eval:skill -- --keep             # print the temp sessions dir
npm run eval:skill -- --model=<model-id> # override the builder model
```

両方のビルダーは `evals/lib/seed.ts` で確認済みの `Analysis` と最小構成の `bundle.json` を用意します。

`score.ts` は `mustUseAny` と `forbidden` に加え、`SkillPlan` の構造を検査します。

- `minValues` は固定値 `values` の最小個数を指定します。すべての `{{token}}` が定義済みの値を参照することも確認します。
- `minCalculations` と `minActions` は、副作用のない `calculation` と状態を変更する `action` を区別し、それぞれの最小数を指定します。

5シナリオのうち Scout 向けは2件です。`price-tracker-skill` は URL を固定値として宣言し、`{{…}}` で参照して `web_fetch` と `xlsx` で追記する手順を確認します。`github-issue-triage-skill` は `gh` によるコメントとラベル操作を求め、ブラウザーを除外します。

残る3件は Cowork（Microsoft 365 Copilot）向けです。ツール一覧にブラウザー自動化はないため、playwright、`click`、Web ホストを除外し、正しい Microsoft 365 の `server/Tool` を使うことを求めます。`cowork-teams-digest` はチャネルの取得と `m365_teams` での投稿、`cowork-outlook-reply` はメールの振り分けと `outlook` での返信、`cowork-calendar-schedule` は空き時間の確認と `outlook_calendar` での予定登録を確認します。

<a id="sensitive-detection--redaction-evals-evalssensitive"></a>

## 機密情報の検出とマスキングの評価（evals/sensitive/）

解析で GitHub Copilot に送信する前の端末内処理を確認します。対象は secretlint による秘密情報の検出と、構造化された個人識別情報を検出する正規表現、送信テキストのマスキング、高度な保護で使う画面の OCR とぼかし処理です。

```bash
npm run eval:sensitive                 # all cases (text + frames)
npm run eval:sensitive -- --only=jwt,frame-card-split
npm run eval:sensitive -- --verbose    # also print the redacted text / blur summary
```

LLM、モデルの重み、ネットワークなしで恒常的に同じ結果を得られます。失敗時は終了コードが 0 以外になります。secretlint と正規表現は実際に実行します。画面側は OCR の単語と矩形を直接与え、Tesseract や Sharp を使わずに矩形の対応付けを確認します。

- `corpus.ts` の各送信文字列に、隠す値の `mustRedact` と残す値の `mustKeep` を定義します。秘密情報の種類、構造化された個人識別情報、Luhn 検査に失敗するカード番号や不正な地域番号を持つ SSN を除外する検証、氏名が隠されないこと、複数検出器の組み合わせ、通常の文章・URL・ハッシュを扱います。
- `frames.ts` は、機密語を付けた合成 OCR の配置を使います。画面の秘密情報やメールアドレス、4つのトークンに分かれたカード番号の全体、通常のテキストから既知になった値の OCR 上での検出、ぼかし不要の画像を確認します。

`score.ts` は実際の検出器と `redactText` を動かし、`mustRedact` が消え、`mustKeep` が残ることを確認します。機密を含まないテキストの検出件数は0件である必要があります。画像の評価では `sensitiveFrameBoxes` を使い、機密語の矩形だけが選ばれるか調べます。集計には再現率（隠すべき情報を隠せた割合）と適合率（通常の内容を誤って隠さずに済んだか）を出します。

<a id="opt-in-real-image-ocr-eval-ocr-imagests"></a>

### 実画像の OCR を評価する（任意）

合成 OCR の評価では、Tesseract の読み誤りで値を検出できず、ぼかしが適用されない場合を調べられません。`ocr-images.ts` は Sharp でテキストを JPEG に描き、実際の `Ocr` と `sensitiveFrameBoxes` で、機密行にぼかしの矩形が付き、通常行には付かないことを確認します。

```bash
npm run eval:sensitive:ocr             # renders text → JPEG, real Tesseract (English)
npm run eval:sensitive:ocr -- --keep   # also print each case's recognized OCR text
```

この評価は `eval:sensitive` に含まれません。Tesseract の WASM コア、システムフォントを使う Sharp、言語ごとの初回の `tessdata_fast` 取得が必要です。言語データは Git 管理外の `evals/.cache/tessdata/` に保存します。フォントや通信がない、確認用画像を OCR できないといった環境では、終了コード 0 で評価をスキップします。

各行は固定の高さの領域に描画し、OCR の位置のばらつきを許容して評価します。機密行にぼかしが付けば検出成功、通常行にぼかしが付かなければ誤検出なしとします。GitHub トークン、カード番号とメールアドレス、既知の値に基づく検出、日本語文中の ASCII メールアドレスを英語の `eng` データだけで認識して隠せるかを確認します。

<a id="mock-pages-evalsmocks"></a>

## モックページ（evals/mocks/）

シナリオに対応する静的なページです。`pricing.html`、`invoices.html`、`directory.html`、`article-habits.html`、`article-focus.html` があり、`index.html` から開けます。ページには投稿やデータ送信の処理がありません。

実録画で試す場合は、録画中にブラウザーでページを開き、値をコピーして TextEdit や Numbers に貼り付け、録画を停止して解析します。合成シナリオも同じページと値を使うため、実録画でも同様の目的と手順が得られるかを確認できます。
