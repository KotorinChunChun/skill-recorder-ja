# Skill Recorder をソースから導入する

> [!TIP]
> 日本語版は [README の Windows 手順](README.md#日本語版) で起動できます。Microsoft 公式版は [公式リリース](https://github.com/microsoft/skill-recorder/releases/latest) の **Commit-pinned installation** から、対象 OS のコマンド全体をコピーして実行してください。[公式版の導入の流れ](README.md#install-it)

この文書では、Microsoft 公式版のソースインストーラー、実行前の確認、設定、更新、アンインストールと、手動の開発環境を扱います。Windows、macOS、Ubuntu で、指定コミットのソースを端末内でビルドします。Node.js、Electron、ネイティブ依存関係、GitHub Copilot CLI は、公式の入手先または設定済みの互換レジストリから取得します。

この手順で作成したビルドはローカル実行専用です。ビルド済みアプリ、`node_modules`、取得したランタイムを再配布しないでください。配布用のバイナリには `npm run dist*` を使い、生成された完全なコンプライアンス一式を添付してください。

<a id="commit-pinned-one-line-installation"></a>

## コミットを固定した1行インストール

例の `<40-character-release-commit>` は、公式リリースに記載された40文字の完全なコミット SHA に置き換えてください。仮の文字列のまま実行するとダウンロードに失敗します。[公式リリース](https://github.com/microsoft/skill-recorder/releases/latest) には SHA を設定済みのコマンドがあります。

<a id="windows-11-x64-or-arm64"></a>

### Windows 11 x64 または ARM64

```powershell
$commit="<40-character-release-commit>"; $env:SKILL_RECORDER_COMMIT=$commit; irm "https://raw.githubusercontent.com/microsoft/skill-recorder/$commit/install.ps1" | iex
```

<a id="macos-or-ubuntu"></a>

### macOS または Ubuntu

```sh
commit="<40-character-release-commit>"; curl -fsSL "https://raw.githubusercontent.com/microsoft/skill-recorder/$commit/install.sh" | SKILL_RECORDER_COMMIT="$commit" bash
```

バックグラウンド起動し、世代管理したログを残す場合は以下を使います。

```sh
commit="<40-character-release-commit>"; curl -fsSL "https://raw.githubusercontent.com/microsoft/skill-recorder/$commit/install.sh" | SKILL_RECORDER_COMMIT="$commit" SKILL_RECORDER_DETACHED=1 bash
```

コミット SHA を2箇所に指定するのは、実行するスクリプトとビルド対象を固定するためです。`master` や `main` などのブランチ名、検証していないタグは使わないでください。

1. インストーラーは完全なコミット SHA を受け取り、変化する参照を拒否します。
2. ネイティブの x64 または ARM64 を選び、対応 OS を確認します。`install.sh` は macOS と Ubuntu に対応します。
3. `nodejs.org` から公式のポータブル版 Node.js 24 を取得し、`SHASUMS256.txt` と照合します。Windows では OpenJS Foundation の Authenticode 署名も確認します。
4. GitHub Codeload から指定コミットのソースを取得します。
5. lockfile の URL が正規の npmjs URL であることを確認します。設定済みのレジストリまたは互換ミラーで `npm ci` を実行し、Electron の公式リリースからランタイムを取得して、公式チェックサムを確認済みのポリシーと照合します。
6. `npm run compliance:licenses` を実行し、対象環境のパッケージに確認済みのライセンス資料が不足していれば停止します。
7. ローカルでビルドし、リポジトリと依存関係のライセンスを保管します。Electron と Copilot の実行ファイルのハッシュも記録します。
8. Windows ではスタートメニューとデスクトップ、macOS ではランチャーと `~/Applications` の `Skill Recorder (Source)`、Ubuntu ではランチャーとデスクトップエントリを作成します。
9. 作成したショートカットの一覧を表示します。

Windows では初回も自動起動しません。ターミナルの `@` で囲まれた完了メッセージに従い、録画を終え、起動中のすべての Skill Recorder で **Quit** を選びます。終了を待ってから **Skill Recorder (Source)** を開いてください。ショートカットをどちらも作れなかった場合は起動コマンドが表示されます。macOS と Ubuntu では自動起動します。`SKILL_RECORDER_NO_LAUNCH=1` で無効にできます。

導入に管理者権限やシステム全体の Node.js と Copilot CLI は不要です。AI 機能にはネットワークと、利用権限のある GitHub Copilot アカウントまたは対応プロバイダーの API キーが必要です。[独自のモデルを使う（BYOM）](README.md#bring-your-own-model) に対応する接続先、モデル、キーの保管方法があります。OS の安全なストレージがない場合はキーをメモリに保持して利用できます。Ubuntu で起動をまたいで保存するには、対応するデスクトップのキーリングをロック解除してください。録画だけなら AI 接続は不要です。

ダウンロードしたスクリプトを直接シェルに渡す方法は、組織のポリシーで無効になっている場合があります。次の手順で内容とハッシュを確認できます。Gatekeeper、Smart App Control、アプリケーション制御ポリシー、エンドポイント保護により実行が制限される場面では、組織の方針に従ってください。

<a id="inspect-first-installation"></a>

## スクリプトを確認してから導入する

表示された SHA-256 を、対応する GitHub Release に掲載された値と照合してからスクリプトを実行してください。

### Windows

```powershell
$commit = "<40-character-release-commit>"
$script = Join-Path $env:TEMP "skill-recorder-install-$commit.ps1"
Invoke-WebRequest "https://raw.githubusercontent.com/microsoft/skill-recorder/$commit/install.ps1" -OutFile $script -UseBasicParsing
Get-FileHash $script -Algorithm SHA256
Get-Content $script
$env:SKILL_RECORDER_COMMIT = $commit
& $script
```

### macOS

```sh
commit="<40-character-release-commit>"
script="$(mktemp -t skill-recorder-install.XXXXXX)"
curl -fsSL "https://raw.githubusercontent.com/microsoft/skill-recorder/$commit/install.sh" -o "$script"
shasum -a 256 "$script"
cat "$script"
SKILL_RECORDER_COMMIT="$commit" bash "$script"
rm -f "$script"
```

### Ubuntu

```sh
commit="<40-character-release-commit>"
script="$(mktemp --suffix=.sh)"
curl -fsSL "https://raw.githubusercontent.com/microsoft/skill-recorder/$commit/install.sh" -o "$script"
sha256sum "$script"
cat "$script"
SKILL_RECORDER_COMMIT="$commit" bash "$script"
rm -f "$script"
```

<a id="source-installer-options-and-locations"></a>

## インストーラーの設定と保存先

| 環境変数 | 対象 | 内容 |
| --- | --- | --- |
| `SKILL_RECORDER_COMMIT` | 全環境 | 必須。40文字の完全なソースコミット |
| `SKILL_RECORDER_INSTALL_ROOT` | 全環境 | ユーザー別のソースとランタイムの保存先 |
| `SKILL_RECORDER_NO_LAUNCH=1` | macOS、Ubuntu | インストールと検証だけを行う。Windows は常に手動起動 |
| `SKILL_RECORDER_NO_DESKTOP_SHORTCUT=1` | Windows | スタートメニューのショートカットだけを作る |
| `SKILL_RECORDER_DETACHED=1` | macOS、Ubuntu | バックグラウンド起動し、ログをファイルに保存 |
| `SKILL_RECORDER_LOG_KEEP` | macOS、Ubuntu | バックグラウンド起動ログの保持数。既定は `5` |

既定のインストール先は次のとおりです。

- Windows は `%LOCALAPPDATA%\SkillRecorder`
- macOS は `~/Library/Application Support/SkillRecorder`
- Ubuntu は `${XDG_DATA_HOME:-~/.local/share}/SkillRecorder`

各版は `versions/<commit>` に配置されます。依存関係、ライセンス、整合性、ビルドの確認が通るとランチャーの参照先が更新されます。

<a id="re-running-the-same-command"></a>

## 同じコマンドを再実行する

Windows で同じコミットを指定すると、`versions/<commit>` の既存の導入内容を確認し、ショートカットを更新します。再取得や再ビルドは行わず、手動起動の案内を表示します。

途中で失敗した場合、Node.js とソースのアーカイブは `<install root>\cache` に残り、次の試行で再利用されます。再利用前に SHA-256 を確認し、Node.js は毎回 `nodejs.org` の公開チェックサムと照合します。完了時にはキャッシュを削除します。手動で削除したキャッシュは必要に応じて再取得されます。

<a id="relaunching-after-it-closes"></a>

## アプリを開き直す

- Windows はデスクトップまたはスタートメニューの **Skill Recorder (Source)** を開きます。
- macOS は `~/Applications` の **Skill Recorder (Source)** を使います。Spotlight や Launchpad から検索でき、Dock に固定できます。
- Ubuntu は **Skill Recorder (Source)** のデスクトップエントリか、ランチャースクリプトから起動します。

ランチャーは最新の導入済みコミットを参照します。単一起動ロックに対応した版を再度開くと、すでに起動している録画画面か操作バーを表示します。この操作で録画は開始・停止されません。別の版が動いている場合は先に終了してください。ロックに対応していない旧版は新しい版と同時に動くことがあります。Windows の完了メッセージに従って旧版を手動で終了してください。

<a id="manual-developer-setup"></a>

## 手動で開発環境を作る

日本語版の Windows 手順は [README](README.md#日本語版) にあります。以下のダウンロード例は Microsoft 公式版を取得します。`<40-character-release-commit>` は [公式リリース](https://github.com/microsoft/skill-recorder/releases/latest) の完全なコミット SHA に置き換えてください。そのまま実行すると `404 Not Found` になります。

Node.js の公式配布元から 24.19 以降の 24 系を入れます。確認済みの依存スクリプトのポリシーを適用するため、npm 11.17 以降が必要です。公式版は、リポジトリの履歴全体の代わりに指定コミットのアーカイブを取得します。

### Windows PowerShell

```powershell
$commit = "<40-character-release-commit>"
$archive = Join-Path $env:TEMP "skill-recorder-$commit.zip"
$parent = Join-Path $PWD "skill-recorder-source"
Invoke-WebRequest "https://codeload.github.com/microsoft/skill-recorder/zip/$commit" -OutFile $archive -UseBasicParsing
Expand-Archive $archive $parent
Set-Location (Join-Path $parent "skill-recorder-$commit")
npm run check:lockfile
npm ci --ignore-scripts=false --dangerously-allow-all-scripts=false --strict-allow-scripts
npm run electron:install-reviewed
npm run compliance:licenses
npm run build
npm start
```

### macOS

```sh
commit="<40-character-release-commit>"
archive="skill-recorder-$commit.tar.gz"
source_dir="skill-recorder-$commit"
curl -fsSL "https://codeload.github.com/microsoft/skill-recorder/tar.gz/$commit" -o "$archive"
mkdir "$source_dir"
tar -xzf "$archive" --strip-components=1 -C "$source_dir"
cd "$source_dir"
npm run check:lockfile
npm ci --ignore-scripts=false --dangerously-allow-all-scripts=false --strict-allow-scripts
npm run electron:install-reviewed
npm run compliance:licenses
npm run build
npm start
```

### Ubuntu

ダウンロードやアーカイブ処理に必要なツールがなければ先に準備します。

```sh
sudo apt-get update
sudo apt-get install --yes ca-certificates curl tar
```

次に、指定コミットのソースを取得してビルドします。

```sh
commit="<40-character-release-commit>"
archive="skill-recorder-$commit.tar.gz"
source_dir="skill-recorder-$commit"
curl -fsSL "https://codeload.github.com/microsoft/skill-recorder/tar.gz/$commit" -o "$archive"
mkdir "$source_dir"
tar -xzf "$archive" --strip-components=1 -C "$source_dir"
cd "$source_dir"
npm run check:lockfile
npm ci --ignore-scripts=false --dangerously-allow-all-scripts=false --strict-allow-scripts
npm run electron:install-reviewed
npm run compliance:licenses
npm run build
npm start
```

ホットリロードを使う場合は、確認済みの依存関係と Electron を用意し、`npm run compliance:licenses` の完了後に `npm run dev` を実行します。

lockfile は正規の `registry.npmjs.org` の URL と整合性ハッシュを記録します。npm はこれらの URL を互換性のあるレジストリに割り当てられます。インストールには `npm ci` を使い、lockfile を再生成しないでください。ソース、`.compliance`、依存関係のライセンス資料は一緒に保管します。

<a id="networks-that-block-registrynpmjsorg"></a>

### registry.npmjs.org に接続できないネットワーク

ポータブル版 Node.js には組み込みの `npmrc` がありません。インストーラーは端末のグローバル設定を探してポータブル版 npm に渡します。`replace-registry-host` が正規の npmjs URL を設定済みのミラーに割り当てます。設定がない端末では `registry.npmjs.org` を使います。

Windows では Node.js と npm を事前に入れる必要はありません。明示的な `NPM_CONFIG_GLOBALCONFIG` を優先し、続いてシステムの npm が報告するグローバル設定、`NPM_CONFIG_PREFIX` の `etc\npmrc`、`%APPDATA%\npm\etc\npmrc`、ネイティブ・現在・x86 の Program Files にある `nodejs\etc\npmrc` を探します。PATH 登録前に配置された管理対象の設定も検出します。ユーザーの `.npmrc` と環境変数の優先順位、設定ファイルはそのままです。

端末内にある設定を読み、Intune やデバイスポリシーの同期は行いません。未設定の Windows 端末で公開レジストリに接続できず、端末やアカウントの情報に Microsoft Entra テナントが示されている場合は、Microsoft 向けの経路を一度だけ試すことがあります。この情報は接続経路の選択に使います。再試行のプロセスにだけレジストリを設定し、lockfile の整合性とスクリプトの承認を維持します。TLS 検証や保存済みの設定は変更しません。npm が明示的に設定済みの場合、他の組織、ネットワーク以外の障害には適用されません。再試行できないときや失敗したときは、組織で承認されたパッケージフィードを用意するよう案内します。

npm が PATH にある場合は、承認されたミラーを設定できます。

```sh
npm config set registry <url> --location=global
```

システム全体に npm を入れていない Windows では、依存関係のエラーに、取得済みの npm のパスを使うコマンドが表示されます。組織に指定された URL に置き換え、フィードの認証手順に従ってください。ミラーを使う場合も、lockfile の整合性ハッシュを検証します。

<a id="licensing-boundary"></a>

## ライセンスと再配布の範囲

ソース公開では MIT License のソースを配布します。Sharp/libvips、ONNX Runtime、Tesseract.js、改変していない GitHub Copilot CLI などは設定済みレジストリから利用者側で取得します。確認済みの Electron はインストーラーが GitHub から取得します。lockfile の URL と整合性ハッシュは npmjs と互換のある社内ミラーの両方で利用できます。

プラットフォームごとのコンプライアンス処理には、`LICENSE` と `THIRD-PARTY-NOTICES.md`、npm パッケージ（Copilot CLI を含む）のライセンス全文、Electron と Chromium の表示、`.compliance/licenses` の GPL・LGPL・MPL・Artistic-2.0 の原文、`.compliance` の Sharp/libvips と ONNX Runtime の表示、`.compliance/tesseract-core` の Tesseract の WebAssembly コンポーネントの表示、未解決項目のない一覧を含めます。

アプリを再配布するには `npm run dist*` を使います。同梱ライブラリに必要な表示、対応ソースコード、パッチ、ハッシュ、再リンク手順をまとめます。[第三者ライセンスと表示の日本語案内](docs/third-party-notices-ja.md)

<a id="updating-and-uninstalling"></a>

## 更新とアンインストール

新しいリリースの完全なコミット SHA を指定してインストーラーを実行します。Windows では録画を終了し、起動中のすべての版で **Quit** を選んでから、更新したショートカットで起動してください。通常の起動はショートカットから行い、新しい版の動作を確認してから古い版を削除します。

<a id="windows-uninstall"></a>

### Windows でアンインストール

```powershell
Remove-Item "$([Environment]::GetFolderPath('Programs'))\Skill Recorder (Source).lnk" -Force
Remove-Item "$([Environment]::GetFolderPath('DesktopDirectory'))\Skill Recorder (Source).lnk" -Force
Remove-Item "$env:LOCALAPPDATA\SkillRecorder" -Recurse -Force
```

<a id="macos-uninstall"></a>

### macOS でアンインストール

```sh
rm -rf "$HOME/Applications/Skill Recorder (Source).app"
rm -rf "$HOME/Library/Application Support/SkillRecorder"
```

<a id="ubuntu-uninstall"></a>

### Ubuntu でアンインストール

```sh
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
rm -f "$data_home/applications/skill-recorder-source.desktop"
rm -rf "$data_home/SkillRecorder"
```

これらのコマンドはソースインストール先と起動項目を削除します。インストール先の外に保存されたセッションとアプリデータは残ります。

<a id="release-maintainer-checklist"></a>

## リリース担当者の確認項目

詳しい手順は [`RELEASING.md`](RELEASING.md) にあります。

1. コントリビューターとその雇用主から MIT License で公開する許可を得る。
2. 対象の各 OS とアーキテクチャで、公開するコミット自体をビルドして検証する。
3. Windows、macOS、Ubuntu の CI で、未解決項目のないライセンス一覧を生成する。
4. 導入コマンドでブランチ名の代わりに完全なコミット SHA を公開する。
5. 対象コミットの `install.ps1` と `install.sh` の SHA-256 を公開する。
6. リリースタグを移動・削除から保護する。
7. 1行で導入する方法と、実行前に確認する方法をクリーンな環境で検証する。
8. ソース公開に Node.js、Electron、npm 依存関係、Copilot バイナリのミラーや再梱包品を含めない。
9. ビルド済みのアプリを公開する場合は `npm run dist*` を使い、その版のコンプライアンス資料一式を公開する。
