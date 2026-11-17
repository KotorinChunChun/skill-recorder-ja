import { useEffect, useRef } from "react";

export function RecordingPrivacyWarning({
  starting,
  onStart,
  onReview,
  onClose,
}: {
  starting: boolean;
  onStart: () => void;
  onReview: () => void;
  onClose: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !starting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, starting]);

  return (
    <div className="sheet-backdrop" onClick={starting ? undefined : onClose}>
      <div
        className="recording-warning"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-warning-title"
        aria-describedby="recording-warning-copy recording-warning-detail"
        aria-busy={starting}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="recording-warning-head">
          <span className="recording-warning-icon" aria-hidden>
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2.5 4 4.8v4.3c0 3.4 2.4 6.2 6 7.4 3.6-1.2 6-4 6-7.4V4.8L10 2.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M10 6.4v4.1M10 13.4h.01"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <h2 id="recording-warning-title">録画を始める前に</h2>
        </header>

        <p id="recording-warning-copy" className="recording-warning-copy">
          パスワード、アクセストークン、API キー、その他の機密情報は、画面に表示したり、音声解説に含めたりしないでください。
        </p>
        <p id="recording-warning-detail" className="recording-warning-detail">
          録画を始める前に、記録される内容と、解析時に選択した AI プロバイダーに送信される可能性のある内容を確認できます。
        </p>

        <div className="recording-warning-actions">
          <button className="secondary" onClick={onReview} disabled={starting}>
            記録と送信の内容を確認
          </button>
          <button
            ref={startRef}
            className="record-cta"
            onClick={onStart}
            disabled={starting}
          >
            {starting ? "開始中…" : "録画を開始"}
          </button>
        </div>
      </div>
    </div>
  );
}
