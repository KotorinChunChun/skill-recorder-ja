# コーディング エージェント向けのリポジトリ指示

<a id="pull-requests-target-the-active-release-branch-not-main"></a>

## Microsoft 公式版に送る Pull Request の対象

日常の作業は公式リポジトリの現行リリースブランチに入ります。リリースブランチの形式は `release/<semver>` で、対象はバージョンが最も新しい `release/*` です。`main` は版を確定してマージするときに更新します。[リリース手順](../RELEASING.md)

別の指示がある場合を除き、Microsoft 公式版に変更を送るときは以下の順で作業します。例では、公式リポジトリを `origin` として `release/0.3.0` を指定しています。実際の対象はリモートの一覧で確認してください。

- 現行リリースブランチを調べ、バージョンが最も新しいものを使います。

  ~~~sh
  git ls-remote --heads origin 'release/*'
  ~~~

- 現行リリースブランチから作業ブランチを作成します。

  ~~~sh
  git fetch origin
  git switch -c <your-branch> origin/release/0.3.0
  ~~~

- Pull Request のベースに現行リリースブランチを指定します。

  ~~~sh
  gh pr create --repo microsoft/skill-recorder --base release/0.3.0 --head <your-branch>
  ~~~

`main` を対象にするのは、[リリース手順](../RELEASING.md) にある版のマージを行う場合です。
