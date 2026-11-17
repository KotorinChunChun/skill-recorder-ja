import { useEffect, useRef } from "react";

import type { SensitiveModelStatus } from "../common/ipc";

/** Human-readable status for the on-device protection model shown in the sheet. */
function protectionModelNote(status: SensitiveModelStatus | null): string {
  if (!status) return "確認中…";
  switch (status.ocr) {
    case "ready":
      return "このPCのモデルを利用できます";
    case "downloading":
      return status.progress == null
        ? "このPCにモデルを準備中…"
        : `このPCにモデルを準備中…${Math.round(status.progress)}%`;
    case "error":
      return "モデルを準備できませんでした";
    default:
      return "このPCのモデルは未設定です";
  }
}

/**
 * Plain-language disclosure of what the recorder captures, where it is stored,
 * and what leaves the machine on analysis. Every claim here is grounded in the
 * actual collectors and describer behavior, so it must be kept in sync with them.
 *
 * Also home to the Advanced-protection opt-out toggle: protection is on by default,
 * and this sheet is where the user reviews what it does and turns it off if they
 * don't want on-device screen-image scanning.
 */
export function WhatsRecorded({
  onClose,
  onReviewed,
  sensitive,
  advancedPending,
  onToggleAdvanced,
  onDownload,
}: {
  onClose: () => void;
  onReviewed: () => void;
  sensitive: SensitiveModelStatus | null;
  advancedPending: boolean;
  onToggleAdvanced: () => void;
  onDownload: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const advancedOn = sensitive?.enabled ?? true;
  const showModelError = advancedOn && sensitive?.ocr === "error";
  const showDownloadAction =
    advancedOn && (sensitive?.ocr === "error" || sensitive?.ocr === "missing");

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-recorded-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <span className="sheet-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2.5 4 4.8v4.3c0 3.4 2.4 6.2 6 7.4 3.6-1.2 6-4 6-7.4V4.8L10 2.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="m7.4 9.8 1.9 1.9 3.4-3.6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2 id="whats-recorded-title">記録と送信の内容</h2>
        </header>

        <p className="sheet-lead">
          Skill Recorder は画面と操作を記録し、操作手順を再利用できるスキルにします。記録される内容と、このPCから送信される内容は次のとおりです。
        </p>

        <section className="sheet-block">
          <h3>録画中に記録されるもの</h3>
          <p className="sheet-note">録画の開始から停止までが対象です。</p>
          <ul>
            <li>切り替えたアプリと、そのウィンドウやドキュメントのタイトル。</li>
            <li>開いたページのウェブアドレス。</li>
            <li>コピーしたテキストの冒頭（最大120文字）。</li>
            <li>選択した画面の無音の動画（低フレームレート）。</li>
            <li>
              録画操作バーからターミナルを開いた場合は、そのコマンド、作業フォルダー、終了状態、実行時刻、全出力。
            </li>
          </ul>
          <p className="sheet-caution">
            パスワード、アクセストークン、API キー、認証情報などの機密情報を入力、貼り付け、表示、コピー、読み上げしないでください。画面に表示した内容のほか、コピーしたテキストの冒頭や音声解説も録画に含まれます。
          </p>
        </section>

        <section className="sheet-block">
          <h3>記録対象のターミナル（開いた場合のみ）</h3>
          <ul>
            <li>録画操作バーから開いたターミナルだけが対象です。</li>
            <li>
              ターミナルの出力はすべて録画と一緒に保存されます。アプリによるサイズ制限はないため、長時間動くコマンドや出力の多いコマンドは、録画の保存容量を大きくすることがあります。
            </li>
            <li>
              シェルのプロファイルの編集、システム全体へのフックの追加、既存のターミナルの監視、録画終了後のコマンド記録は行いません。
            </li>
          </ul>
        </section>

        <section className="sheet-block">
          <h3>音声解説（オンにした場合のみ）</h3>
          <p className="sheet-note">
            既定ではオフです。「音声解説」で録画開始時の状態とマイクを選び、録画中は操作バーで切り替えます。
          </p>
          <ul>
            <li>
              音声解説をオンにすると、使用許可の確認と利用できる入力の一覧表示のため、マイクに短時間アクセスします。この確認で音声は保存されません。
            </li>
            <li>マイク音声は、録画中にマイクがオンの間だけ保存されます。</li>
            <li>
              マイクをオフにすると、その音声区間が終了してマイクが解放されます。再びオンにするか別の入力に切り替えると、同じ録画内に新しい音声区間が作られます。
            </li>
            <li>
              音声は端末内のモデルで文字起こしできます。Whisper が対応する99言語から選んだ言語で文字起こしします。初回は約252 MBのダウンロードが必要で、開始するタイミングは自分で選べます。
            </li>
            <li>音声解説と録画操作バーのマイクを両方オフにすると、マイクは使われません。</li>
          </ul>
        </section>

        <section className="sheet-block">
          <h3>保存先</h3>
          <ul>
            <li>録画はこのPCのアプリ専用セッションフォルダーに保存されます。</li>
            <li>録画は削除するまで残ります。セッション一覧から個別に削除できます。</li>
            <li>AI 接続の設定と SDK の会話状態は、録画フォルダーの外に保存されます。API キーを削除しても、録画と会話履歴は残ります。</li>
          </ul>
        </section>

        <section className="sheet-block">
          <h3>解析に送信されるもの</h3>
          <ul>
            <li>録画中にこのPCから送信されるデータはありません。</li>
            <li>
              「解析」を選ぶと、操作履歴（ウィンドウとドキュメントのタイトル、URL、コピーしたテキストの冒頭、記録対象のターミナルのコマンド）、画面画像、文字起こし結果、解析に必要な範囲のターミナル出力が、選択した AI プロバイダーに送られます。送信先は GitHub Copilot または設定したモデルの接続先で、解析の前にセッション一覧に表示されます。
            </li>
            <li>
              既定では送信前に、このPCでテキストと画面画像のパスワード、キー、メールアドレス、カード番号や識別番号などの機密情報を隠します。この設定は下で変更できます。
            </li>
          </ul>
        </section>

        <section className={`sheet-block sheet-advp ${advancedOn ? "on" : ""}`}>
          <div className="sheet-advp-head">
            <div className="sheet-advp-copy">
              <h3>高度な保護</h3>
              <p className="sheet-note">
                既定ではオンです。録画を解析する前に、このPCでテキストと画面画像を確認し、機密情報を隠します。オフにすると記録した内容がそのまま送信されます。
              </p>
            </div>
            <button
              type="button"
              className="sheet-switch-btn"
              role="switch"
              aria-checked={advancedOn}
              aria-busy={advancedPending}
              aria-label="高度な保護"
              disabled={advancedPending}
              onClick={onToggleAdvanced}
            >
              <span className={`sheet-switch ${advancedOn ? "on" : ""}`} aria-hidden>
                <span className="sheet-switch-knob" />
              </span>
            </button>
          </div>
          {advancedOn && (
            <>
              <ul>
                <li>
                  送信するテキスト（音声の文字起こしとターミナル出力を含む）と画面画像から、パスワード、キー、メールアドレス、カード番号や識別番号などを隠します。
                </li>
                <li>
                  オフにすると記録内容をそのまま送るため、解析精度が上がる場合があります。機密情報が含まれていない録画に限ってオフにしてください。
                </li>
                <li>この処理はすべてこのPCで行われます。</li>
              </ul>
              <div className={`sheet-advp-status ${showModelError ? "is-error" : ""}`}>
                <span className="sheet-advp-model">{protectionModelNote(sensitive)}</span>
                {showDownloadAction && (
                  <button type="button" className="sheet-advp-download" onClick={onDownload}>
                    {sensitive?.ocr === "error" ? "再試行" : "今すぐ設定"}
                  </button>
                )}
              </div>
              <p className="sheet-caution">
                機密情報を見逃したり、別の情報を誤って隠したりすることがあります。録画に機密情報を含めないでください。
              </p>
            </>
          )}
        </section>

        <section className="sheet-block">
          <h3>記録されないもの</h3>
          <ul>
            <li>キー入力は記録されません。</li>
            <li>Terminal や PowerShell など、別のターミナルアプリで実行したコマンドは記録されません。</li>
            <li>録画している間だけ記録します。バックグラウンドでは記録されません。</li>
          </ul>
        </section>

        <button className="sheet-close" onClick={onReviewed}>
          閉じる
        </button>
      </div>
    </div>
  );
}
