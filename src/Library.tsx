import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { Analysis, AnalysisStep } from "../common/analysis";
import { IMPORT_LIMITS } from "../common/import";
import type {
  AnalyzeProgress,
  AutomationBuildProgress,
  CopilotSignInResult,
  NarrationStatus,
  SensitiveReport,
  SessionSummary,
  SkillBuildProgress,
  SkillPlacement,
  SkillPreview,
} from "../common/ipc";
import { isCopilotSignedOutError } from "../common/ipc";
import type {
  BuildTarget,
  BuiltSkill,
  SkillArchitecture,
  SkillPlan,
} from "../common/skill";
import {
  ARCHITECTURES,
  DEFAULT_TARGET,
  TARGETS,
  buildTargetFor,
} from "../common/skill";
import type { AutomationPlan, BuiltAutomation } from "../common/automation";
import {
  DEFAULT_NARRATION_LANGUAGE,
  NARRATION_MODEL_DOWNLOAD_LABEL,
  NARRATION_LANGUAGES,
  isNarrationLanguage,
  type NarrationLanguage,
} from "../common/narration";
import {
  AnalysisStepTiles,
  AutomationStepTiles,
  EditableText,
  ScheduleEditor,
  SkillStepTiles,
} from "./plan-edit";
import { formatBytes, formatDur, formatWhen, shortLabel } from "./format";
import { skillPlacementModel, skillTargetFor } from "./skill-placement";
import { SkillReviewModal } from "./SkillReviewModal";
import { initialSkillReviewState, SkillOperationGuard, skillReviewBusy, skillReviewReducer } from "./skill-review-state";
import { SensitiveReview } from "./SensitiveReview";
import { AnalysisRecovery, completeSignIn, type AnalysisRun } from "./analysis-recovery";
import { AiConnectionButton, useAiConnection } from "./AiProviderDialog";
import { AI_SETUP_REQUIRED, aiDestination } from "../common/ai-provider";
import { japaneseNarrationLanguage, japaneseTarget } from "./ui-language";
import { japaneseMessage } from "./ui-messages";

export function Library() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus | null>(null);

  const loadSessions = useCallback(async () => {
    const list = await window.skillRecorder.listSessions();
    const requested = await window.skillRecorder.takeLibrarySelection();
    setSessions(list);
    setLoaded(true);
    setSelectedId((prev) => requested && list.some((item) => item.id === requested)
      ? requested : prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void loadSessions();
    return window.skillRecorder.onStatusChanged((s) => {
      if (s.state !== "recording") void loadSessions();
    });
  }, [loadSessions]);
  useEffect(() => {
    const offSessions = window.skillRecorder.onSessionsChanged(() => { void loadSessions(); });
    const offSelection = window.skillRecorder.onLibrarySelection(() => { void loadSessions(); });
    return () => { offSessions(); offSelection(); };
  }, [loadSessions]);

  useEffect(() => {
    void window.skillRecorder.narrationStatus().then(setNarrationStatus);
    return window.skillRecorder.onNarrationStatusChanged((next) => {
      setNarrationStatus(next);
      if (next.phase === "idle") void loadSessions();
    });
  }, [loadSessions]);

  const deleteSession = useCallback(async (id: string) => {
    setNotice(null);
    const res = await window.skillRecorder.deleteSession(id);
    if (!res.ok) {
      setNotice(res.error ?? "録画を削除できませんでした。");
      return;
    }
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = prev.filter((s) => s.id !== id);
      setSelectedId((cur) => {
        if (cur !== id) return cur;
        if (next.length === 0) return null;
        return (next[idx] ?? next[next.length - 1]).id;
      });
      return next;
    });
  }, []);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="lib">
      <aside className="lib-list">
        <AiConnectionButton />
        <div className="lib-list-head">
          <span className="eyebrow">セッション一覧</span>
          <span className="pill">{sessions.length}</span>
        </div>
        {notice && (
          <button className="sess-notice" onClick={() => setNotice(null)} title="閉じる">
            {japaneseMessage(notice)}
          </button>
        )}
        <div className="lib-list-scroll">
          <SessionsList
            sessions={sessions}
            loaded={loaded}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={deleteSession}
          />
        </div>
      </aside>
      <main className="lib-detail">
        {selected ? (
          <AnalysisWorkspace
            key={selected.id}
            summary={selected}
            narrationStatus={narrationStatus}
            onChanged={loadSessions}
          />
        ) : (
          <div className="detail-empty">
            <span className="eyebrow">セッションが選択されていません</span>
            <p>左の一覧から録画を選ぶと、解析した目的と操作手順を確認できます。</p>
          </div>
        )}
      </main>
    </div>
  );
}

/* --- Sessions list -------------------------------------------------------- */

function SessionsList({
  sessions,
  loaded,
  selectedId,
  onSelect,
  onDelete,
}: {
  sessions: SessionSummary[];
  loaded: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <p className="sessions-empty">{loaded ? "録画はまだありません。" : "読み込み中…"}</p>;
  }
  return (
    <ul className="sess-list">
      {sessions.map((s) =>
        confirmId === s.id ? (
          <li key={s.id}>
            <div className="sess-confirm" role="alertdialog" aria-label="録画の削除を確認">
              <div className="sess-confirm-text">
                <span className="sess-confirm-title">この録画を削除しますか？</span>
                <span className="sess-confirm-sub">
                  削除した録画は復元できません。
                  {s.sizeBytes != null && ` このPCの空き容量が ${formatBytes(s.sizeBytes)} 増えます。`}
                </span>
              </div>
              <div className="sess-confirm-actions">
                <button className="linky" onClick={() => setConfirmId(null)}>
                  キャンセル
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setConfirmId(null);
                    void onDelete(s.id);
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          </li>
        ) : (
          <li key={s.id}>
            <div className="sess-row">
              <button
                className={`sess ${s.id === selectedId ? "on" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                <div className="sess-top">
                  <span className="sess-when">{formatWhen(s.startedAt)}</span>
                  <span className="sess-tags">
                    {s.imported && <span className="tag recorded">読み込み済み</span>}
                    {s.hasSkill && <span className="tag ok">スキル</span>}
                    {s.hasAutomation && <span className="tag auto">自動化</span>}
                    {!s.hasSkill && !s.hasAutomation && s.analysis && (
                      <span className="tag an">解析済み</span>
                    )}
                    {!s.imported && !s.hasSkill && !s.hasAutomation && !s.analysis && !s.processed && (
                      <span className="tag warn">処理中</span>
                    )}
                    {!s.imported && !s.hasSkill && !s.hasAutomation && !s.analysis && s.processed && (
                      <span className="tag recorded">録画済み</span>
                    )}
                  </span>
                </div>
                <div className="sess-intent">
                  {s.analysis
                    ? s.analysis.title?.trim() || shortLabel(s.analysis.intent)
                    : s.imported?.name ?? "未解析"}
                </div>
                <div className="sess-sub">
                  {s.durationMs != null && <span>{formatDur(s.durationMs)}</span>}
                  {s.sizeBytes != null && (
                    <span
                      className="sess-size"
                      title={`${s.sizeBytes.toLocaleString()} バイトを使用`}
                    >
                      {formatBytes(s.sizeBytes)}
                    </span>
                  )}
                  {s.analysis && <span>{s.analysis.stepCount} 手順</span>}
                  {s.hasVideo && <span>動画</span>}
                  {s.hasAudio && !s.hasNarration && <span>音声未処理</span>}
                  {s.hasNarration && <span>音声</span>}
                </div>
              </button>
              <button
                className="sess-del"
                aria-label={`録画を削除 · ${formatWhen(s.startedAt)}`}
                title="録画を削除"
                onClick={() => setConfirmId(s.id)}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M3 4.5h10M6.4 4.5V3.3c0-.44.36-.8.8-.8h1.6c.44 0 .8.36.8.8v1.2M4.7 4.5l.5 8.2c.02.42.37.75.8.75h4c.42 0 .77-.33.8-.75l.5-8.2"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

/* --- Analysis workspace --------------------------------------------------- */

const DownloadGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M8 2.6v6.2m0 0 2.3-2.3M8 8.8 5.7 6.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.2 10.4v1.2c0 .6.5 1.1 1.1 1.1h7.4c.6 0 1.1-.5 1.1-1.1v-1.2"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SavedGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M3.4 8.4 6.3 11.3 12.6 4.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Subtle, per-recording "download a debug bundle" affordance shown in the session
 * header. A quiet download icon packages the whole session (private capture data)
 * into a `.zip` the user can hand to us; a privacy-warning modal gates the actual
 * download. It says nothing about where to send the file — that's shared separately.
 */
function DebugDownload({ sessionId }: { sessionId: string }) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  const download = useCallback(async () => {
    setPhase("saving");
    setErrorMsg("");
    const res = await window.skillRecorder.exportDebugBundle(sessionId);
    if (res.ok) setPhase("saved");
    else if (res.canceled) setPhase("idle");
    else {
      setErrorMsg(res.error ?? "デバッグ用データを作成できませんでした。");
      setPhase("error");
    }
  }, [sessionId]);

  // Let the "Saved" acknowledgement fade back to the quiet icon on its own.
  useEffect(() => {
    if (phase !== "saved") return;
    const t = setTimeout(() => setPhase("idle"), 3200);
    return () => clearTimeout(t);
  }, [phase]);

  // While the warning is up, focus it and close on Escape — matching the app's sheets.
  useEffect(() => {
    if (phase !== "confirm") return;
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const label =
    phase === "saving"
      ? "デバッグ用データを準備中…"
      : phase === "saved"
        ? "デバッグ用データを保存しました"
        : "デバッグ用データをダウンロード";

  return (
    <div className="debug-dl">
      {phase === "error" && (
        <span className="debug-dl-note" title={japaneseMessage(errorMsg)}>
          保存できませんでした
        </span>
      )}
      <button
        className={`debug-dl-icon${phase === "saved" ? " is-saved" : ""}`}
        onClick={() => setPhase("confirm")}
        disabled={phase === "saving"}
        aria-label={label}
        title={label}
      >
        {phase === "saving" ? (
          <span className="spinner" aria-hidden />
        ) : phase === "saved" ? (
          <SavedGlyph />
        ) : (
          <DownloadGlyph />
        )}
      </button>

      {phase === "confirm" && (
        <div className="sheet-backdrop" onClick={() => setPhase("idle")}>
          <div
            ref={dialogRef}
            className="sheet debug-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="debug-dl-title"
            aria-describedby="debug-dl-desc"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sheet-head">
              <span className="sheet-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect
                    x="4.4"
                    y="8.7"
                    width="11.2"
                    height="7.9"
                    rx="1.9"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M6.9 8.7V6.7a3.1 3.1 0 0 1 6.2 0v2"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="12.4" r="1.1" fill="currentColor" />
                </svg>
              </span>
              <h2 id="debug-dl-title">機密情報が含まれる可能性があります</h2>
            </header>

            <p className="sheet-lead" id="debug-dl-desc">
              このデータには、画面の動画や画像、開いたページの URL、コピーした内容、音声解説と文字起こしなど、録画で取得したすべての情報が含まれます。信頼できる相手にだけ共有してください。
            </p>

            <div className="sheet-actions">
              <button className="linky" onClick={() => setPhase("idle")}>
                キャンセル
              </button>
              <button className="record-cta" onClick={() => void download()}>
                ZIP をダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Error banner for the Copilot-backed panels. When the CLI has no credentials the app
 * waits for verified authentication. Only analysis supplies a recovery callback;
 * building, creating and installing always require another explicit user action.
 */
function AnalysisError({
  error,
  onAuthenticated,
  onSignInStart,
  onSignInEnd,
}: {
  error: string;
  onAuthenticated?: () => void | Promise<void>;
  onSignInStart?: () => boolean;
  onSignInEnd?: (canceled: boolean) => void;
}) {
  const connection = useAiConnection();
  const [signIn, setSignIn] = useState<CopilotSignInResult | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<string | null>(null);
  const generation = useRef(0);
  const live = useRef(false);
  const endCallback = useRef(onSignInEnd);
  endCallback.current = onSignInEnd;

  useEffect(() => {
    live.current = true;
    setWaiting(false);
    setSignIn(null);
    setFailure(null);
    return () => {
      live.current = false;
      generation.current++;
      const id = attempt.current;
      attempt.current = null;
      if (id) {
        endCallback.current?.(true);
        void window.skillRecorder.cancelCopilotSignIn(id).catch(() => {
          console.warn("Could not cancel Copilot sign-in during panel cleanup.");
        });
      }
    };
  }, [error]);

  const cancelSignIn = async () => {
    const id = attempt.current;
    if (!id) return;
    const canceledGeneration = generation.current;
    attempt.current = null;
    onSignInEnd?.(true);
    setWaiting(false);
    setFailure(onAuthenticated
      ? "サインインをキャンセルしました。解析は自動で再試行されません。"
      : "サインインをキャンセルしました。");
    try {
      await window.skillRecorder.cancelCopilotSignIn(id);
    } catch (err) {
      if (live.current && generation.current === canceledGeneration) {
        setFailure(`サインインをキャンセルできませんでした。${String(err)}`);
      }
    }
  };

  const openSignIn = async () => {
    if (attempt.current) return;
    const id = crypto.randomUUID();
    generation.current++;
    attempt.current = id;
    setWaiting(true);
    setSignIn(null);
    setFailure(null);
    let canceledResult = false;
    try {
      // A false return suppresses stale recovery without suppressing sign-in itself.
      const recover = onSignInStart?.() ?? true;
      const result = await completeSignIn(
        window.skillRecorder.copilotSignIn(id),
        () => live.current && attempt.current === id,
        recover ? onAuthenticated : undefined,
      );
      if (result && live.current && attempt.current === id) {
        canceledResult = !result.ok && result.status === "canceled";
        setSignIn(result);
      }
    } catch (err) {
      if (live.current && attempt.current === id) setFailure(String(err));
    } finally {
      if (live.current && attempt.current === id) {
        attempt.current = null;
        onSignInEnd?.(canceledResult);
        setWaiting(false);
      }
    }
  };

  if (!isCopilotSignedOutError(error) || connection.status?.mode === "byom") return <div className="analysis-error">
    {isCopilotSignedOutError(error) ? "AI 接続が「独自のモデル」に切り替わりました。もう一度操作してください。" : japaneseMessage(error)}{" "}
    {(error.includes(AI_SETUP_REQUIRED) || connection.status?.mode === "byom") &&
      <button className="row-action" onClick={() => void connection.configure()}>AI 接続</button>}
  </div>;

  return (
    <div className="analysis-error">
      <p>解析や生成を続けるには GitHub Copilot にサインインしてください。</p>
      <div className="signin-row">
        <button className="row-action" onClick={() => void openSignIn()} disabled={waiting}>
          {waiting ? "ブラウザーでのサインインを待機中…" : "Copilot にサインイン"}
        </button>
        {waiting && (
          <>
            <span role="status">アプリの案内に従って、ブラウザーでサインインを完了してください。</span>
            <button className="linky" onClick={() => void cancelSignIn()}>サインインをキャンセル</button>
          </>
        )}
        {signIn?.ok && (
          <span>Copilot にサインインしました。準備ができたらもう一度操作してください。</span>
        )}
        {signIn && !signIn.ok && (
          <span>{japaneseMessage(signIn.error) || (
            signIn.status === "canceled" ? "サインインをキャンセルしました。" :
            signIn.status === "timed-out" ? "サインインがタイムアウトしました。もう一度お試しください。" :
            "Copilot にサインインできませんでした。"
          )}</span>
        )}
        {failure && <span role="alert">{japaneseMessage(failure)}</span>}
      </div>
      {signIn && !signIn.ok && signIn.command && (
        <>
          <p className="signin-manual">以下のコマンドでもサインインできます。</p>
          <code className="signin-command">{signIn.command}</code>
        </>
      )}
    </div>
  );
}

function AnalysisWorkspace({
  summary,
  narrationStatus,
  onChanged,
}: {
  summary: SessionSummary;
  narrationStatus: NarrationStatus | null;
  onChanged: () => void | Promise<void>;
}) {
  const { ensureReady: ensureAiReady, status: aiStatus } = useAiConnection();
  const sessionId = summary.id;
  const imported = summary.imported;
  const [importDetails, setImportDetails] = useState(imported?.details ?? "");
  const [importLanguage, setImportLanguage] = useState<NarrationLanguage>(imported?.language ?? DEFAULT_NARRATION_LANGUAGE);
  const importRunActive = useRef(false);
  const readyToAnalyze = summary.processed || Boolean(imported);
  const voicePending = summary.hasAudio && !summary.hasNarration;
  const voiceLanguage = japaneseNarrationLanguage(
    summary.narrationLanguage ?? DEFAULT_NARRATION_LANGUAGE,
  );
  const voiceBusy =
    narrationStatus?.activeSessionId === sessionId && narrationStatus.phase !== "idle";
  const voiceError =
    narrationStatus?.activeSessionId == null || narrationStatus.activeSessionId === sessionId
      ? narrationStatus?.error
      : null;
  const voiceStale =
    summary.analysis != null &&
    (summary.narrationSegmentCount ?? 0) > 0 &&
    summary.narrationUpdatedAt != null &&
    (summary.analysis.narrationSourceUpdatedAt == null ||
      summary.narrationUpdatedAt > summary.analysis.narrationSourceUpdatedAt);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [signInPending, setSignInPending] = useState(false);
  const signInPendingRef = useRef(false);
  const pendingRecovery = useRef<AnalysisRun | null>(null);
  const recovery = useRef(new AnalysisRecovery());
  const [failedRun, setFailedRun] = useState<AnalysisRun | null>(null);
  const latestRun = useRef<AnalysisRun | null>(null);
  const workspaceLive = useRef(false);
  const [statusLine, setStatusLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Informational summary of what the on-device scan redacted before sending;
  // set alongside a successful analysis, cleared at the start of the next run.
  const [review, setReview] = useState<SensitiveReport | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftIntent, setDraftIntent] = useState("");
  const [confirmReanalysis, setConfirmReanalysis] = useState(false);
  const [selectedOutputLanguage, setSelectedOutputLanguage] = useState<NarrationLanguage | null>(null);
  const outputLanguage = selectedOutputLanguage ?? analysis?.language ?? summary.defaultAnalysisLanguage;
  // Directly-editable steps (the source of truth downstream); persisted on a short
  // debounce so typing stays instant. `stepsDirty` gates the persist so seeding from
  // a freshly loaded analysis never writes back.
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const stepsDirty = useRef(false);
  const stepsRef = useRef<AnalysisStep[]>([]);
  stepsRef.current = steps;
  // The final stage: pick a target, then build a skill or an automation. A recording
  // that is already exactly one kind opens straight to it; otherwise it opens to the
  // analysis, where "Create…" starts the target picker.
  const initialLaunch: LaunchTarget =
    summary.hasSkill && !summary.hasAutomation
      ? "skill"
      : summary.hasAutomation && !summary.hasSkill
        ? "automation"
        : "none";
  const [launch, setLaunch] = useState<LaunchTarget>(initialLaunch);
  const [chosenArch, setChosenArch] = useState<SkillArchitecture>(DEFAULT_TARGET.architecture);
  useEffect(() => {
    workspaceLive.current = true;
    return () => {
      workspaceLive.current = false;
      if (importRunActive.current) {
        void window.skillRecorder.cancelAnalysis(sessionId).catch((error) => console.error("Could not cancel departing import analysis:", error));
      }
      recovery.current.invalidate();
      signInPendingRef.current = false;
      pendingRecovery.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    let live = true;
    void Promise.all([
      window.skillRecorder.getAnalysis(sessionId),
      window.skillRecorder.getSensitiveReport(sessionId),
    ]).then(([a, r]) => {
      if (!live) return;
      setAnalysis(a);
      setSteps(a?.steps ?? []);
      stepsDirty.current = false;
      // Rehydrate the redaction summary so it survives reopen (only when the session
      // is actually analyzed — never surface a stale report on an un-analyzed one).
      setReview(a ? r : null);
    });
    return () => {
      live = false;
    };
  }, [sessionId]);

  // Persist directly-edited steps on a short debounce (no agent, no re-analysis).
  useEffect(() => {
    if (!stepsDirty.current) return;
    const t = setTimeout(() => {
      stepsDirty.current = false;
      void window.skillRecorder.updateAnalysis({ sessionId, steps: stepsRef.current }).then((res) => {
        if (res.ok && res.analysis) setAnalysis(res.analysis);
        void onChanged();
      });
    }, 500);
    return () => clearTimeout(t);
  }, [steps, sessionId, onChanged]);

  // Flush any pending step edits when leaving this session, so nothing is lost.
  useEffect(() => {
    return () => {
      if (stepsDirty.current) {
        void window.skillRecorder.updateAnalysis({ sessionId, steps: stepsRef.current });
        stepsDirty.current = false;
      }
    };
  }, [sessionId]);

  const onStepsChange = useCallback((next: AnalysisStep[]) => {
    stepsDirty.current = true;
    setSteps(next);
  }, []);

  // Single latest status line (no growing log).
  useEffect(() => {
    return window.skillRecorder.onAnalyzeProgress((p: AnalyzeProgress) => {
      if (p.sessionId !== sessionId) return;
      setStatusLine(japaneseMessage(p.message));
      // The invocation, not a progress event, owns the busy state.
    });
  }, [sessionId]);

  const executeRun = useCallback(
    async (token: AnalysisRun) => {
      latestRun.current = token;
      importRunActive.current = Boolean(imported);
      setEditing(false);
      setDraftTitle("");
      setDraftIntent("");
      setReview(null);
      setError(null);
      setAnalyzing(true);
      setFailedRun(null);
      setStatusLine("開始中…");
      let signedOut = false;
      try {
        if (imported && !analysis) {
          const saved = await window.skillRecorder.saveImportDetails(sessionId, {
            details: importDetails, language: importLanguage,
          });
          if (!saved.ok) throw new Error(saved.error ?? "録画の詳細を保存できませんでした。");
          if (!workspaceLive.current || !recovery.current.accepts(token)) return;
        }
        const res = await window.skillRecorder.analyze(sessionId, token.language);
        if (!workspaceLive.current || !recovery.current.accepts(token)) return;
        if (res.ok && res.analysis) {
          setAnalysis(res.analysis);
          setSteps(res.analysis.steps);
          stepsDirty.current = false;
          // Preserve the existing narration/redaction pipeline and result handling.
          setReview(res.review ?? null);
        } else {
          const message = res.error ?? "解析に失敗しました。";
          signedOut = isCopilotSignedOutError(message);
          setError(message);
          setFailedRun(token);
        }
      } catch (err) {
        if (workspaceLive.current && recovery.current.accepts(token)) {
          const message = String(err);
          signedOut = isCopilotSignedOutError(message);
          setError(message);
          setFailedRun(token);
        }
      } finally {
        importRunActive.current = false;
        if (workspaceLive.current && recovery.current.isCurrent(token)) {
          recovery.current.finishRun(token, signedOut);
          setAnalyzing(false);
          try {
            await onChanged();
          } catch (err) {
            // A refresh failure must not be mistaken for an interrupted analysis.
            if (workspaceLive.current && latestRun.current === token) {
              setFailedRun(null);
              setError(`録画一覧を更新できませんでした。${String(err)}`);
            }
          }
        }
      }
    },
    [sessionId, onChanged, imported, importDetails, importLanguage, analysis],
  );

  const run = useCallback(async (language?: NarrationLanguage) => {
    if (signInPendingRef.current) return;
    const token = recovery.current.beginRun(language);
    if (!token) return;
    try {
      if (await ensureAiReady(true) && workspaceLive.current && recovery.current.accepts(token)) {
        await executeRun(token);
      } else recovery.current.finishRun(token, false);
    } catch {
      recovery.current.finishRun(token, false);
      if (workspaceLive.current) setError("AI 接続を準備できませんでした。もう一度お試しください。");
    }
  }, [executeRun, ensureAiReady]);

  const onSignInStart = useCallback(() => {
    signInPendingRef.current = true;
    setSignInPending(true);
    setConfirmReanalysis(false);
    const recover = failedRun != null && recovery.current.beginSignIn(failedRun);
    pendingRecovery.current = recover ? failedRun : null;
    return recover;
  }, [failedRun]);

  const onSignInEnd = useCallback((canceled: boolean) => {
    signInPendingRef.current = false;
    if (pendingRecovery.current) recovery.current.endSignIn(pendingRecovery.current, canceled);
    pendingRecovery.current = null;
    if (workspaceLive.current) setSignInPending(false);
  }, []);

  const retryAfterSignIn = useCallback(async () => {
    if (!workspaceLive.current || !failedRun) return;
    const token = recovery.current.retry(failedRun);
    if (!token) return;
    signInPendingRef.current = false;
    setSignInPending(false);
    await executeRun(token);
  }, [failedRun, executeRun]);

  const cancel = useCallback(async () => {
    const token = latestRun.current;
    recovery.current.cancelRun();
    setStatusLine("停止中…");
    try {
      await window.skillRecorder.cancelAnalysis(sessionId);
    } catch (err) {
      if (workspaceLive.current && latestRun.current === token) {
        setFailedRun(null);
        setError(`解析をキャンセルできませんでした。${String(err)}`);
      }
    }
  }, [sessionId]);

  const startEdit = useCallback(() => {
    if (!analysis) return;
    setDraftTitle(analysis.title ?? "");
    setDraftIntent(analysis.intent);
    setError(null);
    setFailedRun(null);
    setEditing(true);
  }, [analysis]);

  const saveEdit = useCallback(async () => {
    const res = await window.skillRecorder.updateAnalysis({
      sessionId,
      title: draftTitle.trim(),
      intent: draftIntent.trim() || undefined,
    });
    if (res.ok && res.analysis) {
      setAnalysis(res.analysis);
      setEditing(false);
    } else {
      setFailedRun(null);
      setError(res.error ?? "変更を保存できませんでした。");
    }
    void onChanged();
  }, [sessionId, draftTitle, draftIntent, onChanged]);

  if (launch === "picker") {
    return (
      <TargetPicker
        startedAt={summary.startedAt}
        onPick={(t) => {
          setChosenArch(t.architecture);
          setLaunch(t.kind);
        }}
        onClose={() => setLaunch("none")}
      />
    );
  }

  if (launch === "skill") {
    return (
      <SkillBuilderView
        sessionId={sessionId}
        architecture={chosenArch}
        startedAt={summary.startedAt}
        hasSkill={summary.hasSkill}
        onClose={() => {
          setLaunch("none");
          void onChanged();
        }}
      />
    );
  }

  if (launch === "automation") {
    return (
      <AutomationBuilderView
        sessionId={sessionId}
        architecture={chosenArch}
        startedAt={summary.startedAt}
        hasAutomation={summary.hasAutomation}
        onClose={() => {
          setLaunch("none");
          void onChanged();
        }}
      />
    );
  }

  return (
    <section className="ws">
      <div className="ws-head">
        <div className="ws-titles">
          <span className="eyebrow">解析</span>
          <span className="ws-when">{formatWhen(summary.startedAt)}</span>
        </div>
        <div className="ws-head-actions">
          {analysis && readyToAnalyze && !voiceStale && !confirmReanalysis && !analyzing && !signInPending && !editing && (
            <button className="ghost" onClick={() => setConfirmReanalysis(true)}>再解析</button>
          )}
          <DebugDownload sessionId={sessionId} />
        </div>
      </div>

      <div className="ws-body">
        {voicePending && voiceError && !analyzing && !imported && (
          <p className="voice-analysis-note">
              {voiceLanguage}の音声を文字起こしできませんでした。今回の解析に音声は含まれません。音声は保存されているので、再解析すると文字起こしを再試行できます。
          </p>
        )}

        {analysis && readyToAnalyze && (voiceStale || confirmReanalysis) && !analyzing && !signInPending && !editing && (
          <div className="voice-card">
            <div className="voice-card-copy">
              {voiceStale && <strong>解析後に文字起こしが追加されました</strong>}
              {confirmReanalysis ? (
                <>
                  <AnalysisLanguageSelect
                    label="生成する文章の言語"
                    value={outputLanguage}
                    onChange={setSelectedOutputLanguage}
                  />
                  <span>録画データを AI に送り、現在の解析結果を置き換えます。手動で編集した内容も置き換わります。</span>
                </>
              ) : (
                <span>文字起こしを含めるには再解析してください。</span>
              )}
            </div>
            {confirmReanalysis ? (
              <div className="voice-card-actions">
                <button className="linky" onClick={() => { setConfirmReanalysis(false); setSelectedOutputLanguage(null); }}>
                  キャンセル
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setConfirmReanalysis(false);
                    setSelectedOutputLanguage(null);
                    void run(outputLanguage);
                  }}
                >
                  解析結果を置き換える
                </button>
              </div>
            ) : (
              <button className="secondary" onClick={() => setConfirmReanalysis(true)}>
                音声を含めて再解析
              </button>
            )}
          </div>
        )}

        {!readyToAnalyze && (
          <p className="ws-note">この録画を処理中です。少し待ってからもう一度お試しください。</p>
        )}

        {readyToAnalyze && !summary.analysis && !analysis && !analyzing && (
          <div className="ws-empty">
            <p className="ws-empty-lead">{imported ? "録画から操作手順を作成します。" : "録画から実際の操作手順を確認できます。"}</p>
            {imported ? (
              <div className="import-details">
                <p className="import-source">{imported.name} · {formatDur(imported.durationMs)} · {imported.hasAudio ? "動画と音声" : "音声なしの動画"}</p>
                <label className="edit-field">
                  <span className="edit-label">補足情報（任意）</span>
                  <textarea
                    className="edit-intent"
                    value={importDetails}
                    maxLength={IMPORT_LIMITS.details}
                    placeholder="例：操作は 02:10 から 05:30 までです。経費を承認する手順で、最後の確認は別のアプリで行います。"
                    onChange={(event) => setImportDetails(event.target.value)}
                    disabled={signInPending}
                  />
                </label>
                <small>作業の目的や映っている内容、目安の時刻を書けます。時刻は AI の参考情報です。動画の切り出しは行われず、指定外の部分も処理される場合があります。</small>
                <AnalysisLanguageSelect
                  label={imported.hasAudio ? "録画の音声と生成する文章の言語" : "生成する文章の言語"}
                  value={importLanguage}
                  onChange={setImportLanguage}
                  disabled={signInPending}
                />
              </div>
            ) : (
              <AnalysisLanguageSelect
                label="生成する文章の言語"
                value={outputLanguage}
                onChange={setSelectedOutputLanguage}
                disabled={signInPending}
              />
            )}
            <button className="record-cta" onClick={() => void run(imported ? importLanguage : outputLanguage)} disabled={signInPending}>
              録画を解析
            </button>
            <details className="analyze-disclosure">
              <summary>AI プロバイダーに送信される内容</summary>
              <p>
                送信先：{aiDestination(aiStatus)}。{" "}
                {imported
                  ? "「解析」を選ぶと、動画から選んだ画像、文字起こし結果、補足情報が、選択した AI プロバイダーに送信されます。読み込んだ動画ファイルはこのPCに保存されます。"
                  : "「解析」を選ぶと、操作履歴（ウィンドウやドキュメントのタイトル、URL、コピーしたテキストの冒頭）、画面画像、文字起こし、入力した補足情報などが、選択した AI プロバイダーに送信されます。"}
                <span className="cloud-analysis-caution">
                  パスワード、アクセストークン、API キー、認証情報などの機密情報を含む可能性がある録画は解析しないでください。
                </span>{" "}
                既定では送信前に、このPCでテキストと画面画像のパスワード、キー、メールアドレス、カード番号や識別番号などを隠します。精度を優先する場合は「記録と送信の内容」で保護をオフにできます。保護をオンにしていても機密情報を見逃す場合があります。
              </p>
            </details>
            {voicePending && (
              <p className="voice-analysis-note">
                {imported
                  ? `解析前に、このPCで${japaneseNarrationLanguage(importLanguage)}の音声を文字起こしします。${narrationStatus?.model === "ready" ? "" : `初回の解析時に文字起こしモデル（${NARRATION_MODEL_DOWNLOAD_LABEL}）をダウンロードします。`}文字起こしに失敗した場合は解析を停止します。再試行できます。`
                  : narrationStatus?.model === "ready"
                  ? `${voiceLanguage}の音声を文字起こししてから解析します。`
                  : `${voiceLanguage}の音声を文字起こししてから解析します。初回は文字起こしモデル（${NARRATION_MODEL_DOWNLOAD_LABEL}）をダウンロードします。`}
              </p>
            )}
          </div>
        )}

        {summary.processed && review && !analyzing && (
          <SensitiveReview report={review} onDismiss={() => setReview(null)} />
        )}

        {analyzing && (
          <div className="status-line">
            <span className="spinner" />
            <span className="status-text">
              {voiceBusy ? narrationWorkLabel(narrationStatus) : statusLine || "処理中…"}
            </span>
            <button className="linky status-cancel" onClick={cancel}>
              キャンセル
            </button>
          </div>
        )}

        {analyzing && narrationStatus?.phase === "downloading" && (
          <p className="voice-analysis-note">
            初回の解析では、約252 MBの文字起こしモデルをダウンロードします。
          </p>
        )}

        {error && (
          <AnalysisError
            error={error}
            onSignInStart={onSignInStart}
            onSignInEnd={onSignInEnd}
            onAuthenticated={failedRun && !failedRun.retried ? retryAfterSignIn : undefined}
          />
        )}

        {analysis && !analyzing && !signInPending && (
          <div className="ws-read">
            <div className="summary">
              <div className="summary-head">
                <span className="eyebrow">行った操作</span>
                {!editing && (
                  <button className="linky" onClick={startEdit}>
                    編集
                  </button>
                )}
              </div>

              {editing ? (
                <div className="summary-edit">
                  <label className="edit-field">
                    <span className="edit-label">名前</span>
                    <input
                      className="edit-title"
                      value={draftTitle}
                      placeholder="短い名前（例：習慣づくりの記事を探す）"
                      autoFocus
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveEdit();
                        } else if (e.key === "Escape") setEditing(false);
                      }}
                    />
                    <span className="edit-hint">セッション一覧に表示されます</span>
                  </label>
                  <label className="edit-field">
                    <span className="edit-label">目的</span>
                    <textarea
                      className="edit-intent"
                      value={draftIntent}
                      placeholder="何をしようとしたか一文で入力"
                      onChange={(e) => setDraftIntent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditing(false);
                      }}
                    />
                  </label>
                  <div className="edit-actions">
                    <button className="linky" onClick={() => setEditing(false)}>
                      キャンセル
                    </button>
                    <button className="secondary" onClick={() => void saveEdit()}>
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="summary-text">{analysis.intent}</h2>
                  {analysis.intentRationale && (
                    <p className="summary-why">{analysis.intentRationale}</p>
                  )}
                </>
              )}
            </div>

            <div className="story-edit">
              <div className="summary-head">
                <span className="eyebrow">手順</span>
                <span className="edit-hint">手順をクリックして編集、並べ替え、追加、削除できます。変更は自動保存されます。</span>
              </div>
              <AnalysisStepTiles steps={steps} onChange={onStepsChange} />
            </div>
          </div>
        )}
      </div>

      {analysis && !analyzing && !signInPending && (
        <div className="ws-foot">
          <span className="foot-status">{launchFootStatus(summary)}</span>
          <div className="ws-foot-actions">
            {summary.hasSkill && (
              <button className="secondary" onClick={() => setLaunch("skill")} title="この録画から作成したスキルを開く">
                スキルを開く →
              </button>
            )}
            {summary.hasAutomation && (
              <button
                className="secondary"
                onClick={() => setLaunch("automation")}
                title="この録画から作成した自動化を開く"
              >
                自動化を開く →
              </button>
            )}
            <button
              className="record-cta"
              onClick={() => setLaunch("picker")}
              title="この録画からスキルや自動化を作成する"
            >
              {summary.hasSkill || summary.hasAutomation ? "別のものを作成 →" : "作成…"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AnalysisLanguageSelect({
  label, value, onChange, disabled,
}: {
  label: string;
  value: NarrationLanguage;
  onChange: (language: NarrationLanguage) => void;
  disabled?: boolean;
}) {
  return (
    <label className="edit-field">
      <span className="edit-label">{label}</span>
      <select className="edit-title" value={value} disabled={disabled} onChange={(event) => {
        if (isNarrationLanguage(event.target.value)) onChange(event.target.value);
      }}>
        {NARRATION_LANGUAGES.map(({ code }) => <option key={code} value={code}>{japaneseNarrationLanguage(code)}</option>)}
      </select>
    </label>
  );
}

function narrationWorkLabel(status: NarrationStatus | null): string {
  if (!status) return "処理中…";
  if (status.phase === "transcribing") return "音声を文字起こし中…";
  if (status.phase === "loading") return "文字起こしモデルを準備中…";
  if (status.phase === "downloading") {
    return status.progress == null
      ? "文字起こしモデルをダウンロード中…"
      : `文字起こしモデルをダウンロード中…${status.progress}%`;
  }
  return "処理中…";
}

/* --- Final stage: target picker + builders -------------------------------- */

/** Which final-stage surface the analysis workspace is showing. */
type LaunchTarget = "none" | "picker" | "skill" | "automation";

function launchFootStatus(summary: SessionSummary): string {
  if (summary.hasSkill && summary.hasAutomation) return "スキルと自動化を作成しました";
  if (summary.hasSkill) return "スキルを作成しました";
  if (summary.hasAutomation) return "自動化を作成しました";
  return "";
}

/** "What do you want to build?" — picks both kind and architecture up front. */
function TargetPicker({
  startedAt,
  onPick,
  onClose,
}: {
  startedAt: number | null;
  onPick: (target: BuildTarget) => void;
  onClose: () => void;
}) {
  return (
    <section className="ws">
      <div className="ws-head">
        <div className="ws-titles">
          <span className="eyebrow">作成</span>
          <span className="ws-when">{formatWhen(startedAt)}</span>
        </div>
        <button className="ghost" onClick={onClose} title="解析結果に戻る">
          キャンセル
        </button>
      </div>
      <div className="ws-body">
        <div className="sb-arch">
          <p className="sb-lead">この録画から何を作成しますか？</p>
          <div className="arch-grid">
            {TARGETS.map((t) => {
              const copy = japaneseTarget(t);
              return (
                <button
                  key={`${t.kind}:${t.architecture}`}
                  className="arch-card"
                  disabled={!t.enabled}
                  onClick={() => t.enabled && onPick(t)}
                >
                  <span className="arch-name">{copy.label}</span>
                  <span className="arch-note">{t.enabled ? copy.note : "対応予定"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- Skill builder ------------------------------------------------------- */

type BuildPhase = "loading" | "ready" | "planning" | "plan" | "creating" | "done";

function SkillBuilderView({
  sessionId,
  architecture: initialArch,
  startedAt,
  hasSkill,
  onClose,
}: {
  sessionId: string;
  architecture: SkillArchitecture;
  startedAt: number | null;
  hasSkill: boolean;
  onClose: () => void;
}) {
  const { ensureReady: ensureAiReady } = useAiConnection();
  const defaultPlacementFor = useCallback(
    (architecture: SkillArchitecture): SkillPlacement =>
      skillPlacementModel(skillTargetFor(architecture)).defaultPlacement,
    [],
  );
  // If this recording is already a skill, hold on a spinner until we've loaded it,
  // so we never flash the planning state before jumping to the skill.
  const [{ phase, preview, reviewOpen, statusLine, error }, dispatch] = useReducer(
    skillReviewReducer, hasSkill, initialSkillReviewState,
  );
  const [architecture, setArchitecture] = useState<SkillArchitecture>(initialArch);
  const [plan, setPlan] = useState<SkillPlan | null>(null);
  const [exportedPath, setExportedPath] = useState("");
  const [builtName, setBuiltName] = useState("");
  const operations = useRef(new SkillOperationGuard());
  const flowVersion = useRef(0);
  const stopping = useRef(false);
  const mounted = useRef(false);
  const previewRef = useRef<SkillPreview | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<SkillPlacement>(() => defaultPlacementFor(initialArch));
  const placementModel = useMemo(() => skillPlacementModel(skillTargetFor(architecture)), [architecture]);

  const discardPreview = useCallback(async (id: string, reportError = false) => {
    const version = flowVersion.current;
    try {
      const result = await window.skillRecorder.discardSkillPreview(sessionId, id);
      if (!result.ok) throw new Error(result.error ?? "プレビューを破棄できませんでした。");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (reportError && mounted.current && flowVersion.current === version) {
        dispatch({ type: "error", error: message });
      }
      else console.warn("Could not discard skill preview", cause);
    }
  }, [sessionId]);

  const invalidatePreview = useCallback(() => {
    flowVersion.current++;
    const previous = previewRef.current;
    previewRef.current = null;
    dispatch({ type: "invalidate" });
    if (previous) void discardPreview(previous.id, true);
  }, [discardPreview]);

  const updatePlan = useCallback((part: Partial<SkillPlan>) => {
    invalidatePreview();
    setPlan((prev) => (prev ? { ...prev, ...part } : prev));
  }, [invalidatePreview]);

  // Leaving the builder (session switch or Close) discards an in-progress plan —
  // we don't save drafts — so stop any run that's still going in the background.
  useEffect(() => {
    mounted.current = true;
    const guard = operations.current;
    return () => {
      mounted.current = false;
      flowVersion.current++;
      if (guard.invalidate()) {
        void window.skillRecorder.cancelSkill(sessionId).then((result) => {
          if (!result.ok) throw new Error("スキルの作成をキャンセルできませんでした。");
        }).catch((cause: unknown) => {
          console.warn("Could not cancel skill work on departure", cause);
        });
      }
      const previous = previewRef.current;
      previewRef.current = null;
      if (previous) void discardPreview(previous.id);
    };
  }, [sessionId, discardPreview]);

  // Reopen straight to the exported state if this recording already has a skill.
  useEffect(() => {
    let live = true;
    const version = flowVersion.current;
    void window.skillRecorder.getSkill(sessionId).then((s: BuiltSkill | null) => {
      if (!live || flowVersion.current !== version) return;
      if (s?.exportedPath) {
        setBuiltName(s.name);
        setExportedPath(s.exportedPath);
        setArchitecture(s.architecture);
        // We don't persist how it was placed, so reopening infers the architecture's
        // current default placement from the manifest.
        setPlacement(defaultPlacementFor(s.architecture));
        if (s.plan) setPlan(s.plan);
        dispatch({ type: "done" });
      } else if (hasSkill) {
        // We expected a skill but couldn't load it; fall back to the ready screen.
        dispatch({ type: "settle", phase: "ready" });
      }
    }).catch((cause: unknown) => {
      if (live && flowVersion.current === version) dispatch({
        type: "settle", phase: "ready",
        error: cause instanceof Error ? cause.message : "スキルを開けませんでした。",
      });
    });
    return () => {
      live = false;
    };
  }, [sessionId, hasSkill, defaultPlacementFor]);

  useEffect(() => {
    return window.skillRecorder.onSkillProgress((p: SkillBuildProgress) => {
      if (p.sessionId === sessionId && mounted.current && operations.current.busy && !stopping.current) {
        dispatch({ type: "progress", message: japaneseMessage(p.message) });
      }
    });
  }, [sessionId]);

  const runPlan = useCallback(async () => {
    const operation = operations.current.begin();
    if (!operation) return;
    invalidatePreview();
    flowVersion.current++;
    dispatch({ type: "start", phase: "planning", message: "スキルの手順を作成中…" });
    try {
      if (!await ensureAiReady() || !mounted.current || !operations.current.isCurrent(operation)) {
        if (mounted.current) dispatch({ type: "settle", phase: "ready" });
        return;
      }
      const res = await window.skillRecorder.buildSkill({ sessionId, architecture });
      if (!mounted.current || !operations.current.isCurrent(operation)) return;
      if (res.ok && res.plan) {
        setPlan(res.plan);
        dispatch({ type: "settle", phase: "plan" });
      } else {
        dispatch({ type: "settle", phase: "ready", error: res.error ?? "手順の作成に失敗しました。" });
      }
    } catch (cause) {
      if (mounted.current && operations.current.isCurrent(operation)) {
        dispatch({ type: "settle", phase: "ready", error: cause instanceof Error ? cause.message : "手順の作成に失敗しました。" });
      }
    } finally {
      operations.current.finish(operation);
    }
  }, [sessionId, architecture, invalidatePreview, ensureAiReady]);

  const review = useCallback(async () => {
    if (!plan) return;
    if (previewRef.current) {
      dispatch({ type: "visibility", open: true });
      return;
    }
    const operation = operations.current.begin();
    if (!operation) return;
    flowVersion.current++;
    dispatch({ type: "start", phase: "preparing", message: "SKILL.md のプレビューを準備中…" });
    try {
      if (!await ensureAiReady() || !mounted.current || !operations.current.isCurrent(operation)) {
        if (mounted.current) dispatch({ type: "settle", phase: "plan" });
        return;
      }
      dispatch({ type: "visibility", open: true });
      const res = await window.skillRecorder.prepareSkill(sessionId, plan);
      if (!mounted.current || !operations.current.isCurrent(operation)) {
        if (res.preview) void discardPreview(res.preview.id);
        return;
      }
      if (res.ok && res.preview) {
        previewRef.current = res.preview;
        dispatch({ type: "preview", preview: res.preview });
      } else {
        dispatch({ type: "settle", phase: "plan", error: res.error ?? "プレビューを準備できませんでした。" });
      }
    } catch (cause) {
      if (mounted.current && operations.current.isCurrent(operation)) {
        dispatch({ type: "settle", phase: "plan", error: cause instanceof Error ? cause.message : "プレビューを準備できませんでした。" });
      }
    } finally {
      operations.current.finish(operation);
    }
  }, [sessionId, plan, discardPreview, ensureAiReady]);

  const place = useCallback(
    async (which: SkillPlacement) => {
      if (!plan) return;
      const operation = operations.current.begin();
      if (!operation) return;
      flowVersion.current++;
      dispatch({ type: "start", phase: "creating", message: which === "export" ? "スキルをエクスポート中…" : "スキルを保存中…" });
      try {
        if ((!previewRef.current && !await ensureAiReady()) || !mounted.current || !operations.current.isCurrent(operation)) {
          if (mounted.current) dispatch({ type: "settle", phase: "plan" });
          return;
        }
        const res = await window.skillRecorder.createSkill(sessionId, plan, which, previewRef.current?.id);
        if (!mounted.current) return;
        if (res.ok && res.skill) {
          if (!operations.current.commit(operation)) return;
          setBuiltName(res.skill.name);
          setExportedPath(res.path ?? res.skill.exportedPath ?? "");
          setPlacement(res.placement ?? which);
          previewRef.current = null;
          dispatch({ type: "done" });
        } else {
          if (!operations.current.isCurrent(operation)) return;
          // Folder-picker cancellation and placement failures both retain the candidate.
          // An expired candidate must be reviewed again explicitly, never silently regenerated.
          if (res.previewExpired) previewRef.current = null;
          dispatch({
            type: "settle",
            phase: "plan",
            previewExpired: res.previewExpired,
            error: res.canceled ? undefined : res.error ?? "スキルを作成できませんでした。",
          });
        }
      } catch (cause) {
        if (mounted.current && operations.current.isCurrent(operation)) {
          dispatch({ type: "settle", phase: "plan", error: cause instanceof Error ? cause.message : "スキルを作成できませんでした。" });
        }
      } finally {
        operations.current.finish(operation);
      }
    },
    [sessionId, plan, ensureAiReady],
  );

  const cancelRun = useCallback(async () => {
    if (stopping.current || !operations.current.busy) return;
    const cancellation = operations.current.beginCancellation();
    if (!cancellation) return;
    stopping.current = true;
    flowVersion.current++;
    const { operation, originalSettled } = cancellation;
    dispatch({ type: "start", phase: "stopping", message: "停止中…" });
    let error: string | undefined;
    try {
      const res = await window.skillRecorder.cancelSkill(sessionId);
      if (!res.ok) throw new Error("スキルの作成をキャンセルできませんでした。");
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "スキルの作成をキャンセルできませんでした。";
    }
    // Acknowledging cancellation only marks the backend operation. Its original
    // request may still own a model turn or an open native folder picker.
    try {
      await originalSettled;
      if (mounted.current && operations.current.isCurrent(operation)) {
        dispatch({ type: "settle", phase: plan ? "plan" : "ready", error });
      }
    } finally {
      operations.current.finish(operation);
      stopping.current = false;
    }
  }, [sessionId, plan]);

  const restoreReviewFocus = useCallback(() => {
    if (mounted.current) (doneRef.current ?? reviewButtonRef.current ?? workspaceRef.current)?.focus();
  }, []);
  useEffect(() => {
    if (phase === "done") doneRef.current?.focus();
  }, [phase]);
  const busy = skillReviewBusy(phase);

  return (
    <section className="ws skill-builder" ref={workspaceRef} tabIndex={-1}>
      <div className="ws-head">
        <div className="ws-titles">
          <span className="eyebrow">{phase === "done" ? "スキル" : "スキルを作成"}</span>
          <span className="ws-when">{formatWhen(startedAt)}</span>
        </div>
        <button
          className="ghost"
          onClick={onClose}
          disabled={busy}
          title={phase === "done" ? "この録画の解析結果を表示" : "解析結果に戻る"}
        >
          {phase === "done" ? "解析結果" : "閉じる"}
        </button>
      </div>

      <div className="ws-body">
        {error && <AnalysisError error={error} />}

        {phase === "loading" && (
          <div className="status-line">
            <span className="spinner" />
            <span className="status-text">スキルを開いています…</span>
          </div>
        )}

        {phase === "ready" && (
          <div className="sb-arch">
            <p className="sb-lead">この録画から {archLabel(architecture)} 用のスキルを作ります。</p>
            <button className="record-cta" onClick={() => void runPlan()}>
              スキルの手順を作成 →
            </button>
          </div>
        )}

        {busy && (
          <div className="status-line" role="status">
            <span className="spinner" />
            <span className="status-text">{statusLine || "処理中…"}</span>
            <button className="linky status-cancel" onClick={cancelRun} disabled={phase === "stopping"}>
              キャンセル
            </button>
            {(phase === "preparing" || preview) && (
              <button className="ghost" ref={reviewButtonRef} onClick={() => dispatch({ type: "visibility", open: true })}>
                SKILL.md を確認
              </button>
            )}
          </div>
        )}

        {phase === "plan" && plan && (
          <div className="sb-plan">
            <div className="sb-planhead">
              <EditableText
                as="div"
                className="sb-title ed-title"
                value={plan.title}
                placeholder="スキルのタイトル"
                ariaLabel="Skill title"
                onChange={(v) => updatePlan({ title: v })}
              />
              <code className="sb-slug">{plan.name}</code>
            </div>
            <EditableText
              as="p"
              multiline
              className="sb-desc ed-desc"
              value={plan.description}
              placeholder="スキルの概要を一行で入力"
              ariaLabel="Skill description"
              onChange={(v) => updatePlan({ description: v })}
            />

            <div className="sb-sec">
              <span className="eyebrow">スキルの手順</span>
              <p className="sb-refine-hint">
                手順や強調表示された値をクリックして編集できます。手順の並べ替え、追加、削除もできます。
              </p>
              <SkillStepTiles
                steps={plan.steps}
                onChange={(steps) => updatePlan({ steps })}
                values={plan.values}
                onChangeValues={(values) => updatePlan({ values })}
              />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="sb-done" ref={doneRef} tabIndex={-1}>
            <div className="sb-check" aria-hidden>
              ✓
            </div>
            <h2 className="sb-title">
              {placement === "install" ? placementModel.installDoneTitle : "スキルをエクスポートしました"}
            </h2>
            <p>
              <code className="sb-slug">{builtName}</code>{" "}
              {placement === "install"
                ? placementModel.installDoneMessage
                : `は ${archLabel(architecture)} 用です。対応するスキルフォルダーに配置してください。`}
            </p>
            {exportedPath && <p className="sb-path">{exportedPath}</p>}
          </div>
        )}
      </div>

      {phase === "plan" && plan && (
        <div className="ws-foot">
          <span className="foot-status" />
          <div className="ws-foot-actions">
            <button className="ghost" ref={reviewButtonRef} onClick={() => void review()}>
              SKILL.md を確認
            </button>
            {placementModel.actions.map((action) => (
              <button
                key={action.placement}
                className={action.primary ? "record-cta" : "ghost"}
                onClick={() => void place(action.placement)}
                title={action.title}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="ws-foot">
          <span className="foot-status">スキルを作成しました</span>
          <div className="ws-foot-actions">
            {exportedPath && (
              <button className="record-cta" onClick={() => void window.skillRecorder.revealSkill(sessionId)}>
                ファイルの場所を開く
              </button>
            )}
          </div>
        </div>
      )}
      {reviewOpen && (
        <SkillReviewModal
          preview={preview}
          busy={busy}
          stopping={phase === "stopping"}
          statusLine={statusLine}
          error={error}
          placementModel={placementModel}
          onPlace={(which) => void place(which)}
          onPrepare={() => void review()}
          onCancel={() => void cancelRun()}
          onClose={() => dispatch({ type: "visibility", open: false })}
          restoreFocus={restoreReviewFocus}
        />
      )}
    </section>
  );
}

function archLabel(id: SkillArchitecture): string {
  return ARCHITECTURES.find((a) => a.id === id)?.label ?? id;
}

/* --- Automation builder --------------------------------------------------- */

function AutomationBuilderView({
  sessionId,
  architecture: initialArch,
  startedAt,
  hasAutomation,
  onClose,
}: {
  sessionId: string;
  architecture: SkillArchitecture;
  startedAt: number | null;
  hasAutomation: boolean;
  onClose: () => void;
}) {
  const { ensureReady: ensureAiReady } = useAiConnection();
  const [phase, setPhase] = useState<BuildPhase>(hasAutomation ? "loading" : "ready");
  const [architecture, setArchitecture] = useState<SkillArchitecture>(initialArch);
  const [plan, setPlan] = useState<AutomationPlan | null>(null);
  const [statusLine, setStatusLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exportedPath, setExportedPath] = useState("");
  const [builtName, setBuiltName] = useState("");
  const canceled = useRef(false);
  const inFlight = useRef(false);
  // The initial architecture can reflect a prior skill choice while a saved automation loads.
  const automationInstallTargetLabel =
    phase === "done"
      ? buildTargetFor(architecture, "automation").installTargetLabel
      : "";

  const updatePlan = useCallback((part: Partial<AutomationPlan>) => {
    setPlan((prev) => (prev ? { ...prev, ...part } : prev));
  }, []);

  useEffect(() => {
    return () => {
      canceled.current = true;
      if (inFlight.current) void window.skillRecorder.cancelAutomation(sessionId);
    };
  }, [sessionId]);

  // Reopen straight to the exported state if this recording already has one.
  useEffect(() => {
    let live = true;
    void window.skillRecorder.getAutomation(sessionId).then((a: BuiltAutomation | null) => {
      if (!live) return;
      if (a?.exportedPath) {
        setBuiltName(a.name);
        setExportedPath(a.exportedPath);
        setArchitecture(a.architecture);
        if (a.plan) setPlan(a.plan);
        setPhase("done");
      } else if (hasAutomation) {
        setPhase("ready");
      }
    });
    return () => {
      live = false;
    };
  }, [sessionId, hasAutomation]);

  useEffect(() => {
    return window.skillRecorder.onAutomationProgress((p: AutomationBuildProgress) => {
      if (p.sessionId === sessionId) setStatusLine(japaneseMessage(p.message));
    });
  }, [sessionId]);

  const runPlan = useCallback(async () => {
    if (inFlight.current) return;
    canceled.current = false;
    inFlight.current = true;
    setError(null);
    setStatusLine("自動化の手順を作成中…");
    setPhase("planning");
    try {
      if (!await ensureAiReady() || canceled.current) {
        if (!canceled.current) setPhase("ready");
        return;
      }
      const res = await window.skillRecorder.buildAutomation({ sessionId, architecture });
      if (canceled.current) return;
      if (res.ok && res.plan) { setPlan(res.plan); setPhase("plan"); }
      else { setError(res.error ?? "手順の作成に失敗しました。"); setPhase("ready"); }
    } catch {
      if (!canceled.current) { setError("自動化の手順を作成できませんでした。もう一度お試しください。"); setPhase("ready"); }
    } finally { inFlight.current = false; }
  }, [sessionId, architecture, ensureAiReady]);

  const create = useCallback(async () => {
    if (!plan || inFlight.current) return;
    canceled.current = false;
    inFlight.current = true;
    setError(null);
    setStatusLine("自動化を保存中…");
    setPhase("creating");
    try {
      if (!await ensureAiReady() || canceled.current) {
        if (!canceled.current) setPhase("plan");
        return;
      }
      const res = await window.skillRecorder.createAutomation(sessionId, plan);
      if (canceled.current) return;
      if (res.ok && res.automation) {
        setBuiltName(res.automation.name);
        setExportedPath(res.path ?? res.automation.exportedPath ?? "");
        setPhase("done");
      } else { setError(res.error ?? "自動化を作成できませんでした。"); setPhase("plan"); }
    } catch {
      if (!canceled.current) { setError("自動化を作成できませんでした。もう一度お試しください。"); setPhase("plan"); }
    } finally { inFlight.current = false; }
  }, [sessionId, plan, ensureAiReady]);

  const cancelRun = useCallback(async () => {
    canceled.current = true;
    inFlight.current = false;
    setStatusLine("停止中…");
    await window.skillRecorder.cancelAutomation(sessionId);
    setPhase(plan ? "plan" : "ready");
  }, [sessionId, plan]);

  const busy = phase === "planning" || phase === "creating";

  return (
    <section className="ws">
      <div className="ws-head">
        <div className="ws-titles">
          <span className="eyebrow">{phase === "done" ? "自動化" : "自動化を作成"}</span>
          <span className="ws-when">{formatWhen(startedAt)}</span>
        </div>
        <button
          className="ghost"
          onClick={onClose}
          disabled={busy}
          title={phase === "done" ? "この録画の解析結果を表示" : "解析結果に戻る"}
        >
          {phase === "done" ? "解析結果" : "閉じる"}
        </button>
      </div>

      <div className="ws-body">
        {error && <AnalysisError error={error} />}

        {phase === "loading" && (
          <div className="status-line">
            <span className="spinner" />
            <span className="status-text">自動化を開いています…</span>
          </div>
        )}

        {phase === "ready" && (
          <div className="sb-arch">
            <p className="sb-lead">この録画から {archLabel(architecture)} 用の自動化を作ります。</p>
            <button className="record-cta" onClick={() => void runPlan()}>
              自動化の手順を作成 →
            </button>
          </div>
        )}

        {busy && (
          <div className="status-line">
            <span className="spinner" />
            <span className="status-text">{statusLine || "処理中…"}</span>
            <button className="linky status-cancel" onClick={cancelRun}>
              キャンセル
            </button>
          </div>
        )}

        {phase === "plan" && plan && (
          <div className="sb-plan">
            <div className="sb-planhead">
              <EditableText
                as="div"
                className="sb-title ed-title"
                value={plan.title}
                placeholder="自動化のタイトル"
                ariaLabel="Automation title"
                onChange={(v) => updatePlan({ title: v })}
              />
              <code className="sb-slug">{plan.name}</code>
            </div>
            <EditableText
              as="p"
              multiline
              className="sb-desc ed-desc"
              value={plan.description}
              placeholder="自動化の概要を一行で入力"
              ariaLabel="Automation description"
              onChange={(v) => updatePlan({ description: v })}
            />

            <div className="sb-sec">
              <span className="eyebrow">実行スケジュール</span>
              <p className="sb-refine-hint">
                この自動化を実行する日時や間隔を設定してください。
              </p>
              <ScheduleEditor
                schedule={plan.trigger.schedule}
                onChange={(schedule) => updatePlan({ trigger: { ...plan.trigger, schedule } })}
              />
              {plan.trigger.type === "condition" && plan.trigger.condition && (
                <span className="trigger-cond">実行条件 {plan.trigger.condition}</span>
              )}
            </div>

            <div className="sb-sec">
              <span className="eyebrow">自動化の手順</span>
              <p className="sb-refine-hint">
                手順や強調表示された値をクリックして編集できます。手順の並べ替え、追加、削除もできます。
              </p>
              <AutomationStepTiles
                steps={plan.steps}
                onChange={(steps) => updatePlan({ steps })}
                values={plan.values}
                onChangeValues={(values) => updatePlan({ values })}
              />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="sb-done">
            <div className="sb-check" aria-hidden>
              ✓
            </div>
            <h2 className="sb-title">自動化の準備ができました</h2>
            <p>
              <code className="sb-slug">{builtName}</code> は {archLabel(architecture)} 用です。
            </p>
            {exportedPath && <p className="sb-path">{exportedPath}</p>}
            <p className="sb-import-hint">
              {automationInstallTargetLabel} で「Automations」→「Import」を開き、このフォルダーを選んでください。
            </p>
          </div>
        )}
      </div>

      {phase === "plan" && plan && (
        <div className="ws-foot">
          <span className="foot-status" />
          <div className="ws-foot-actions">
            <button
              className="record-cta"
              onClick={() => void create()}
              title="自動化のファイル一式を作成してエクスポートする"
            >
              自動化を作成してエクスポート
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="ws-foot">
          <span className="foot-status">自動化を作成しました</span>
          <div className="ws-foot-actions">
            {exportedPath && (
              <button
                className="record-cta"
                onClick={() => void window.skillRecorder.revealAutomation(sessionId)}
              >
                保存先を開く
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
