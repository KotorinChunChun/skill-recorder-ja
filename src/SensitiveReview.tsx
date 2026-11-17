import { useState } from "react";

import type { SensitiveFinding, SensitiveReport } from "../common/ipc";
import { sourceLabel } from "../common/sensitive";

const SEVERITY_LABEL: Record<SensitiveFinding["severity"], string> = {
  high: "高リスク",
  medium: "機密情報の可能性あり",
  low: "検出の確度が低い",
};

function headline(report: SensitiveReport): string {
  const t = report.totalFindings;
  const regions = report.images?.regionsBlurred ?? 0;
  if (t > 0 && regions > 0) return `送信前に機密情報 ${t} 件を隠し、画像の ${regions} 箇所をぼかしました`;
  if (t > 0) return `送信前に機密情報 ${t} 件を隠しました`;
  if (regions > 0) return `送信前に画像の ${regions} 箇所をぼかしました`;
  return "送信前に機密情報が含まれていないか確認しました";
}

/**
 * Informational, non-blocking result of the on-device pre-send scan. Collapsed to a
 * single indication line by default (a shield + what was hidden); the details are
 * behind a "Review" disclosure so the summary never crowds the analysis. Everything
 * shown is masked / counted upstream in the scanner, so this component never sees a
 * raw secret and image regions are reported as counts only. The user can dismiss it.
 */
export function SensitiveReview({
  report,
  onDismiss,
}: {
  report: SensitiveReport;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const regions = report.images?.regionsBlurred ?? 0;
  const frames = report.images?.framesBlurred ?? 0;
  const hasDetails = report.findings.length > 0 || regions > 0;

  return (
    <section className="sensitive-review" role="status" aria-live="polite">
      <div className="sensitive-review-bar">
        <svg
          className="sensitive-review-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 1.75 3 3.6v3.7c0 3.05 2.13 5.26 5 6.65 2.87-1.39 5-3.6 5-6.65V3.6L8 1.75Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M5.75 8.05 7.3 9.6l3.05-3.35"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="sensitive-review-headline">{headline(report)}</p>
        {hasDetails && (
          <button
            className="sensitive-review-toggle linky"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "閉じる" : "詳細"}
          </button>
        )}
        <button className="sensitive-dismiss linky" onClick={onDismiss} aria-label="閉じる">
          閉じる
        </button>
      </div>

      {open && (
        <div className="sensitive-review-body">
          <div className="sensitive-scroll">
            {report.findings.length > 0 && (
              <ul className="sensitive-list">
                {report.findings.map((f, i) => (
                  <li key={`${f.source}-${f.label}-${i}`} className="sensitive-item">
                    <span
                      className={`sensitive-dot sev-${f.severity}`}
                      title={SEVERITY_LABEL[f.severity]}
                      aria-hidden="true"
                    />
                    <div className="sensitive-item-body">
                      <div className="sensitive-item-head">
                        <span className="sensitive-label">{f.label}</span>
                        <span className="sensitive-source">{sourceLabel(f.source)}</span>
                        {f.occurrences > 1 && (
                          <span className="sensitive-count">×{f.occurrences}</span>
                        )}
                      </div>
                      <code className="sensitive-snippet">{f.snippet}</code>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {regions > 0 && (
              <div className="sensitive-item">
                <span className="sensitive-dot sev-high" aria-hidden="true" />
                <div className="sensitive-item-body">
                  <div className="sensitive-item-head">
                    <span className="sensitive-label">ぼかし処理した箇所</span>
                    <span className="sensitive-source">画面画像</span>
                  </div>
                  <span className="sensitive-snippet">
                    画像 {frames} 枚の {regions} 箇所をぼかしました。画面から読み取った文字は保存されないため、ここには表示されません。
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="sensitive-caveat">
            AI プロバイダーに送信する前に、このPCでテキスト（ウィンドウのタイトル、URL、コピーした内容、コマンド、補足情報、音声の文字起こし）と画面画像を確認し、機密情報や個人情報を隠しました。既定ではオンで、「記録と送信の内容」で切り替えられます。
          </p>
        </div>
      )}
    </section>
  );
}
