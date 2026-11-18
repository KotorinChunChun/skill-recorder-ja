# Skill Recorder のリリース手順

この文書は Microsoft 公式版のリリース手順です。日本語フォークをソースから起動する手順は [README](README.md#日本語版) にあります。

バージョンはセマンティック バージョニングに従います。

1. 既定はソースのみのリリースです。GitHub はタグが指すソースを公開し、利用者はインストーラーでコミットを固定して端末上でビルドします。
2. バイナリのリリースは任意です。`npm run dist*` で生成し、バイナリと版が一致するコンプライアンス資料一式を添付します。

`dist/`、`dist-electron/`、`node_modules/` や `install.ps1`・`install.sh` が端末上で組み立てたアプリは、リリースに添付しないでください。

<a id="1-prepare-a-release-pull-request"></a>

## 1. リリース用の Pull Request を準備する

最新の `main` を起点に次のバージョンを決めます。

- 互換性を保つ修正はパッチ（`0.1.1`）
- 互換性を保つ機能追加はマイナー（`0.2.0`）
- 1.0 以降の非互換変更はメジャー（`1.0.0`）

タグを作らずに `package.json` と `package-lock.json` を更新します。

```sh
npm version 0.2.0 --no-git-tag-version
```

`0.2.0` はリリースする版に置き換えてください。Pull Request に利用者に影響する変更を書きます。依存関係や同梱素材の変更は、コンプライアンス ポリシーのハッシュを更新する前に確認してください。

<a id="dependency-and-asset-review"></a>

### 依存関係と素材の確認

```sh
npm run fix:lockfile-registry
npm run check:lockfile
npm ci --ignore-scripts=false --dangerously-allow-all-scripts=false --strict-allow-scripts
npm run compliance:licenses
```

次の資料と変更を確認します。

- `.compliance/LICENSE-INVENTORY.json`、`.compliance/THIRD-PARTY-LICENSES.txt`、`THIRD-PARTY-NOTICES.md`
- `package-lock.json` の差分と、`package.json#allowScripts` のバージョンごとの許可・拒否
- 追加・変更した画像、フォント、モデル、ネイティブライブラリ、実行ファイル、コピーしたソース

lockfile には正規の `registry.npmjs.org` の URL を記録します。Microsoft の開発者が設定済みの社内ミラーを使う場合も、社内フィードの URL を lockfile や開発者向け設定にコミットしないでください。Windows インストーラーで条件を限定して使う Microsoft 向けの再取得先は実装コード内の例外です。README や導入コマンドへ転記しないでください。新しい依存関係にインストールスクリプトがある場合は、正確な版を確認して必要なものを許可し、不要なものを拒否します。

コンプライアンス処理は未確認の版や資料を拒否します。エラーの解消には、先に入手元、ライセンス、表示、再配布条件、対応ソースコードの要件を確認してください。

| 変更 | 必要な確認 |
| --- | --- |
| GitHub Copilot SDK または CLI | 対象版の条件と表示、改変しない形での同梱が可能か、確認済みポリシーの版 |
| Electron または Chromium | アーカイブとチェックサム、Chromium の表示、FFmpeg のコミット・ソース・パッチ、対応環境ごとのハッシュ |
| Sharp または sharp-libvips | パッケージのライセンス、ネイティブ依存関係、ビルド元のリポジトリ、パッチ、ソースアーカイブ、再リンク手順 |
| ONNX Runtime | 正確なリリースまたは開発リビジョン、ライセンスと表示、ネイティブパッケージとソースの参照 |
| Tesseract.js、Tesseract.js-core、tessdata | npm の版、WASM のビルドコミットとサブモジュール、埋め込みライブラリの表示、言語データのコミットとハッシュ、固定したソースアーカイブ |
| Artistic-2.0 のパッケージ | パッケージの表示とライセンス全文、ソース取得手順または正確な Standard Version のソース |
| 新規のネイティブまたはコピーレフト コンポーネント | 正確な表示、ライセンス原文、完全な対応ソースコード、必要なビルドスクリプト・パッチ・再リンク手順 |
| フォント、画像、モデル、録画などの素材 | 入手元と書面の再配布許可。アプリのコードと別に確認 |

新しい義務を満たせない依存関係は、マージやリリースの対象から外します。

<a id="2-validate-the-release-candidate"></a>

## 2. リリース候補を検証する

```sh
npm test
npm run build
npm run typecheck:evals
npm run compliance:licenses
```

バイナリを配布する場合は完全なコンプライアンス資料も生成します。

```sh
npm run compliance:prepare
```

Pull Request では、Windows x64 と ARM64 のライセンス、テスト、ビルド、パッケージ、アーキテクチャ、macOS の対応ソースコードの準備、テストとビルド、Ubuntu のライセンス、テストとビルドが必要です。Windows、macOS、Ubuntu でコミットを固定したソースインストーラーも検証します。コンプライアンス検査をすべて通過してから公開してください。

<a id="3-merge-and-freeze-the-release-commit"></a>

## 3. マージしてコミットを確定する

Pull Request を `main` にマージし、該当コミットのワークフローが成功するまで待ちます。正確なコミット SHA を記録します。

```sh
git fetch origin main
release_commit="$(git rev-parse origin/main)"
printf '%s\n' "$release_commit"
```

タグと導入コマンドは、このコミットを参照します。導入コマンドではブランチ名や移動可能なタグに置き換えないでください。検証後、注釈付きタグを作ります。

```sh
version="v0.2.0"
git tag -a "$version" "$release_commit" -m "Skill Recorder $version"
git push origin "$version"
```

公開済みのタグを移動や再利用から保護してください。不具合がある場合は新しいパッチ版を公開します。

<a id="4-calculate-installer-script-hashes"></a>

## 4. インストーラーの SHA-256 を求める

作業ツリーのファイルを使わず、対象コミットの Git blob からハッシュを計算します。これによりチェックアウトの古さと改行コードの変換の影響を避けられます。末尾の引数を40文字の完全なリリースコミット SHA に置き換えます。PowerShell、macOS、Ubuntu で実行できます。

```sh
node -e 'const {execFileSync}=require("node:child_process");const {createHash}=require("node:crypto");const commit=process.argv[1];if(!/^[0-9a-f]{40}$/i.test(commit))throw new Error("full release commit SHA required");for(const file of ["install.ps1","install.sh"]){const data=execFileSync("git",["cat-file","blob",commit+":"+file]);console.log(createHash("sha256").update(data).digest("hex")+"  "+file)}' FULL_40_CHARACTER_RELEASE_COMMIT_SHA
```

`install.ps1` と `install.sh` の SHA-256 を GitHub Release のノートに掲載します。[実行前にスクリプトを確認する手順](INSTALL.md#inspect-first-installation) で利用者が照合します。

<a id="5-publish-the-source-only-github-release"></a>

## 5. ソースのみの GitHub Release を公開する

ソースのみのリリースではインストーラーやポータブル版バイナリを添付しません。GitHub が生成するアーカイブにはタグが指すソースが入り、`node_modules` や取得済みのランタイムは含まれません。

ノートにはバージョン、完全なリリースコミット SHA、`install.ps1` と `install.sh` の SHA-256、利用者に影響する変更、[コミットを固定した導入コマンド](INSTALL.md#commit-pinned-one-line-installation)（Windows と macOS／Ubuntu）、ソースのみの配布であること、更新・セキュリティ・互換性に関する注意事項を掲載します。

ノートのファイルを準備してから公開します。一時ファイルのリリースノートはコミットしません。

```sh
gh release create "v0.2.0" \
  --verify-tag \
  --title "Skill Recorder v0.2.0" \
  --notes-file release-notes.txt
```

<a id="6-optional-binary-release"></a>

## 6. バイナリを公開する場合

対象は Windows x64、Windows ARM64、macOS arm64 です。Linux と macOS x64 を含むその他の環境は [ソース導入](INSTALL.md) を使います。コンプライアンス処理は非対応環境で配布用の資料を生成しません。

対象 OS と CPU のネイティブ環境で、該当するコマンドを選んで実行します。

```sh
npm ci
npm run dist
npm run dist:win:x64
npm run dist:win:arm64
npm run dist:portable:mac
npm run dist:portable:win
```

成果物は `release/` にできます。`afterPack` のコンプライアンス検査を通過し、公開前に次を確認してください。

1. タグのコミットと変更していない lockfile を使ってビルドしたこと。
2. OS と CPU アーキテクチャが正しいこと。
3. `resources/compliance/` に表示、ライセンス原文、対応ソースコード、パッチ、ハッシュ、再リンク手順がそろっていること。
4. 生成した `.compliance` を個別の添付用アーカイブにまとめたこと。
5. バイナリとコンプライアンス資料を同じリリースに添付すること。
6. すべての添付ファイルの SHA-256 を公開すること。
7. バイナリを公開している間はコンプライアンス資料を保持すること。
8. 署名なし、アドホック署名、Authenticode、Developer ID のどの状態かを明記すること。

手動の **Portable builds** ワークフローは未署名のプレビューと対応資料を作ります。Actions の成果物を取得して確認し、必要な場合に GitHub Release として公開します。

<a id="7-post-release-verification"></a>

## 7. 公開後に検証する

対応するクリーンな環境で確認します。

1. 完全なリリースコミット SHA から各インストーラーを取得し、SHA-256 を公開ノートと照合する。
2. macOS と Ubuntu は `SKILL_RECORDER_NO_LAUNCH=1` で導入する。Windows は自動起動しないため、手動起動の完了案内を確認する。
3. 依存関係の導入と対象環境のライセンス一覧の生成が成功することを確認する。
4. 起動中の版を終了し、録画、解析、スキルの作成を確認する。待機中と録画中にも再度起動し、既存の録画画面か録画操作バーが表示されることを確認する。
5. [更新とアンインストール](INSTALL.md#updating-and-uninstalling) が機能することを確認する。

GitHub Release のタグが記録したコミットを指し、ソースアーカイブ、ハッシュ、ノート、公開したコンプライアンス資料を入手できることも確認します。

<a id="8-correcting-a-published-release"></a>

## 8. 公開済みのリリースを訂正する

告知せずに成果物を差し替えたり、公開済みのリリースタグを移動したりしないでください。

- リリースノートの誤りは、本文を修正し、訂正内容を記録する。
- スクリプト、依存関係、コンプライアンス資料、バイナリに不備がある場合は、その版を利用不適と明記し、新しいパッチ版を公開する。
- 添付ファイルに法的またはセキュリティ上の問題がある場合は、該当バイナリを取り下げ、記録を残し、修正版を新しいバージョンで公開する。
