import { AI_SETUP_REQUIRED } from "../common/ai-provider";
import { IMPORT_LIMIT_LABEL } from "../common/import";

// 内部のエラー文は再試行判定やログにも使われるため、画面に出すときだけ翻訳する。
const messages = new Map<string, string>([
  [AI_SETUP_REQUIRED, "先に AI の接続方法を選んでください。独自のモデルまたは GitHub 認証を使えます。"],
  ["Already recording", "すでに録画中です。"],
  ["Not recording", "録画中ではありません。"],
  ["Recording is already starting.", "すでに録画を開始しています。"],
  ["Skill Recorder is shutting down.", "Skill Recorder を終了しています。"],
  ["No screen available", "利用できる画面がありません。"],
  ["Microphone controls are only available while recording.", "マイクは録画中に操作できます。"],
  ["Narration language cannot change while recording.", "文字起こしの言語は録画を終了してから変更してください。"],
  ["Unsupported narration language.", "この言語の文字起こしには対応していません。"],
  ["Invalid narration preference.", "音声解説の設定が無効です。"],
  ["Choose the next recording's narration state after this recording ends.", "次の録画の音声設定は、現在の録画を終了してから変更してください。"],
  ["Choose the next recording's screen after this recording ends.", "次に録画する画面は、現在の録画を終了してから選んでください。"],
  ["Invalid screen selection.", "画面の選択が無効です。"],
  ["Invalid microphone selection.", "マイクの選択が無効です。"],
  ["Could not switch microphones.", "マイクを切り替えられませんでした。"],
  ["Finish recording before importing a video.", "録画を終了してから動画を読み込んでください。"],
  ["Another recording import is being processed. Finish or cancel it first.", "別の録画を読み込み中です。読み込みが終わるまで待つか、キャンセルしてください。"],
  ["This import is already being processed.", "この録画は読み込み中です。"],
  ["The source recording changed during import. Select it again.", "読み込み中に元の録画が変更されました。もう一度選んでください。"],
  ["Recording exceeds the import size limit.", "録画ファイルのサイズが上限を超えています。"],
  ["The recording has invalid or unsupported track metadata. Choose an MP4 or WebM with one video track and at most one audio track.", "トラック情報が無効か、対応していません。映像トラックが1つ、音声トラックが最大1つの MP4 または WebM を選んでください。"],
  ["Chromium could not decode this recording's video codec or media data.", "この録画の映像形式に対応していないか、ファイルの内容を読み取れませんでした。"],
  ["Unsupported WebM audio or video codec.", "この WebM の音声または映像形式には対応していません。"],
  ["Imported audio must be mono or stereo at no more than 48 kHz.", "音声は最大48 kHzのモノラルまたはステレオに対応しています。"],
  ["The recording must have a known duration of at most 15 minutes.", "再生時間が判明しており、15分以内の録画を選んでください。"],
  ["The recording must contain video no larger than 3840 x 2160 pixels.", "映像の画素数が3840×2160以下の録画を選んでください。"],
  ["Imported audio must be mono or stereo and no longer than 15 minutes.", "音声は15分以内のモノラルまたはステレオに対応しています。"],
  ["Recording decode failed.", "録画ファイルを読み取れませんでした。"],
  ["Could not extract a recording frame.", "録画から画像を取り出せませんでした。"],
  ["Choose a recording within the import limits: " + IMPORT_LIMIT_LABEL + ".", "MP4 または WebM で、サイズが512 MiB以内、再生時間が15分以内の録画を選んでください。"],
  ["Unknown session.", "セッションが見つかりません。"],
  ["No completed session to analyze yet.", "解析できる録画がまだありません。"],
  ["Cancel this import's processing before deleting it.", "録画の読み込みをキャンセルしてから削除してください。"],
  ["You can't delete a recording while it's still in progress.", "録画を終了してから削除してください。"],
  ["This recording is being analyzed. Cancel that first, then delete.", "解析をキャンセルしてから録画を削除してください。"],
  ["This recording is being transcribed. Wait for that to finish before deleting it.", "文字起こしが終わってから録画を削除してください。"],
  ["This recording is being turned into a skill. Cancel that first, then delete.", "スキルの作成をキャンセルしてから録画を削除してください。"],
  ["This recording is being turned into an automation. Cancel that first, then delete.", "自動化の作成をキャンセルしてから録画を削除してください。"],
  ["Wait for import processing before downloading details.", "読み込みが終わってから詳細をダウンロードしてください。"],
  ["You can't download details while this recording is still in progress.", "録画を終了してから詳細をダウンロードしてください。"],
  ["The recorded terminal is unavailable.", "記録対象のターミナルを利用できません。"],
  ["Open the recorded terminal while a recording is active.", "記録対象のターミナルは録画中に開いてください。"],
  ["The recorded terminal can only be opened from the recording bar.", "記録対象のターミナルは録画操作バーから開いてください。"],
  ["Terminal interruption confirmation is unavailable.", "ターミナルの中断を確認できませんでした。"],
  ["Enter a valid HTTPS base URL.", "有効な HTTPS のベース URL を入力してください。"],
  ["Use HTTPS without credentials, query parameters, or a fragment.", "HTTPS を使い、認証情報、クエリ、フラグメントは URL に含めないでください。"],
  ["Foundry v1 requires a base URL ending in /openai/v1/.", "Foundry v1 のベース URL は /openai/v1/ で終わる必要があります。"],
  ["Native Azure requires the resource host without an API path.", "Azure のバージョン指定型では、リソースのホスト名だけを指定してください。"],
  ["Enter the base URL, not an individual API operation.", "個別操作の URL ではなく、ベース URL を入力してください。"],
  ["Enter an Azure API version, such as 2024-10-21.", "2024-10-21 のように Azure API バージョンを入力してください。"],
  ["Enter a valid API key.", "有効な API キーを入力してください。"],
  ["Enter an API key for this provider and endpoint.", "このプロバイダーと接続先で使う API キーを入力してください。"],
  ["The provider rejected the API key or access. Check the key and deployment permissions.", "プロバイダーがアクセスを拒否しました。API キーとデプロイのアクセス権を確認してください。"],
  ["The provider's quota or rate limit was reached. Check billing or try again later.", "プロバイダーの利用枠またはレート制限に達しました。利用料金を確認するか、時間をおいてお試しください。"],
  ["The provider could not find this model or deployment. Check its name and endpoint.", "モデルまたはデプロイが見つかりません。名前と接続先を確認してください。"],
  ["The model or API format is incompatible. Check image input, tool calling, and the selected API format.", "このモデルまたは API 形式には対応していません。画像入力、ツール呼び出し、選択した API 形式を確認してください。"],
  ["The provider request failed or timed out. Check the endpoint, connection, and model, then try again.", "プロバイダーへのリクエストが失敗したか、タイムアウトしました。接続先、通信状況、モデルを確認して、もう一度お試しください。"],
  ["The connection did not pass the image and tool-calling check. Choose a vision-capable model with tool support, or retry.", "画像入力とツール呼び出しのテストに失敗しました。両方に対応するモデルを選ぶか、再試行してください。"],
  ["Connection setup canceled.", "接続設定をキャンセルしました。"],
  ["Finish AI connection setup before starting another action.", "AI の接続設定を完了してから操作してください。"],
  ["Finish or cancel current AI work before changing its connection.", "AI の処理が終わるまで待つか、処理をキャンセルしてから接続先を変更してください。"],
  ["Preparing recording frames...", "録画の画像を準備中…"],
  ["Starting analysis…", "解析を開始中…"],
  ["Re-analyzing with your feedback…", "入力内容を反映して再解析中…"],
  ["Thinking…", "AI が処理中…"],
  ["Asking the agent to finalize its analysis…", "AI に解析結果の確定を依頼中…"],
  ["Finalizing analysis…", "解析結果を確定中…"],
  ["Reading the timeline…", "操作履歴を読み込み中…"],
  ["Reading the approved analysis…", "確認済みの解析結果を読み込み中…"],
  ["Reading the voice narration…", "音声解説を読み込み中…"],
  ["Reading terminal command index…", "ターミナルのコマンドの一覧を読み込み中…"],
  ["Searching recorded terminal output…", "ターミナルの出力を検索中…"],
  ["Listing available frames…", "画像の一覧を取得中…"],
  ["Received analysis draft.", "解析結果の下書きを受け取りました。"],
  ["Refining the plan…", "手順を見直し中…"],
  ["Planning the skill…", "スキルの手順を作成中…"],
  ["Planning the automation…", "自動化の手順を作成中…"],
  ["Writing the skill…", "スキルを保存中…"],
  ["Writing the automation…", "自動化を保存中…"],
  ["Proposed a plan for your review.", "スキルの手順を確認できます。"],
  ["Proposed an automation plan for your review.", "自動化の手順を確認できます。"],
  ["Plan ready for your review.", "手順を確認できます。"],
  ["Received the finished skill.", "完成したスキルを受け取りました。"],
  ["Skill ready for review. Nothing has been installed.", "スキルを確認できます。確認後に追加またはエクスポートできます。"],
]);

const detailPrefixes = new Map([
  ["Analysis run failed: ", "解析に失敗しました。"],
  ["Planning failed: ", "手順の作成に失敗しました。"],
  ["Skill build failed: ", "スキルの作成に失敗しました。"],
  ["Automation exported to ", "自動化の保存先："],
  ["Could not finalize the recorded terminal: ", "ターミナルの記録を保存できませんでした。"],
  ["Recording stopped, but its files could not be discarded: ", "録画を停止しました。録画ファイルを破棄できませんでした。"],
  ["Recording stopped, but finalizing its files failed: ", "録画を停止しました。録画ファイルの保存を完了できませんでした。"],
]);

export function japaneseMessage(message: string | null | undefined): string {
  if (!message) return "";
  const translated = messages.get(message);
  if (translated) return translated;
  for (const [prefix, label] of detailPrefixes) {
    if (message.startsWith(prefix)) return label + japaneseMessage(message.slice(prefix.length));
  }
  return message
    .replace(/^(.+) is unavailable\. System default will be used\.$/, "$1 を利用できないため、システムの既定を使います。")
    .replace(/^(.+) is unavailable\. (.+) will be recorded\.$/, "$1 を利用できないため、$2 を録画します。")
    .replace(/^Analysis ready \(revision (\d+)\)\.$/, "解析が完了しました（リビジョン $1）。")
    .replace(/^Looking at ([\d.]+)–([\d.]+)s…$/, "$1〜$2秒の範囲を確認中…")
    .replace(/^Attached (\d+) frame image\(s\) from ([\d.]+)–([\d.]+)s\.$/, "$2〜$3秒の画像を $1 枚添付しました。")
    .replace(/^Searching narration for “(.+)”…$/, "音声解説から「$1」を検索中…");
}
