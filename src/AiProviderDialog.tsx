import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { japaneseMessage } from "./ui-messages";
import {
  MEMORY_KEY_NOTICE, PROVIDERS, aiConnectionReady, aiDestination, parseByomConfig, sameCredentialDestination,
  type AiConnectionResult, type AiConnectionStatus, type ByomConfig,
} from "../common/ai-provider";

interface ConnectionContext {
  status: AiConnectionStatus | null;
  notice: string | null;
  request(owner: string): Promise<boolean>;
  cancel(owner: string): void;
}

const Context = createContext<ConnectionContext | null>(null);

export function AiConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiConnectionStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AiConnectionStatus | null>(null);
  const pending = useRef<{ owner: string; resolve: (value: boolean) => void } | null>(null);

  const finish = useCallback((success: boolean) => {
    const request = pending.current;
    pending.current = null;
    setDialog(null);
    request?.resolve(success);
  }, []);

  useEffect(() => {
    let live = true;
    void window.skillRecorder.aiConnectionStatus().then((next) => {
      if (live) setStatus(next);
    }).catch(() => { if (live) setNotice("AI 接続を読み込めませんでした。AI 接続の画面を開き直してください。"); });
    const off = window.skillRecorder.onAiConnectionChanged((next) => {
      if (live) { setStatus(next); setNotice(next.warning ?? null); }
    });
    return () => { live = false; off(); finish(false); };
  }, [finish]);

  const request = useCallback((owner: string): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      const current = { owner, resolve };
      pending.current = current;
      void window.skillRecorder.aiConnectionStatus().then((next) => {
        if (pending.current !== current) return;
        setStatus(next);
        setDialog(next);
      }).catch(() => {
        if (pending.current !== current) return;
        setNotice("AI 接続の設定を開けませんでした。もう一度お試しください。");
        finish(false);
      });
    });
  }, [finish]);

  const cancel = useCallback((owner: string) => {
    if (pending.current?.owner === owner) finish(false);
  }, [finish]);

  return (
    <Context.Provider value={{ status, notice, request, cancel }}>
      {children}
      {dialog && <AiProviderDialog initial={dialog} onClose={() => finish(false)} onSaved={(next) => {
        setStatus(next);
        setNotice(next.warning ?? (next.mode === "byom" && next.keyPersistence === "memory"
          ? MEMORY_KEY_NOTICE : "AI 接続を保存しました。"));
        finish(true);
      }} />}
    </Context.Provider>
  );
}

export function useAiConnection() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing AI connection provider");
  const owner = useId();
  const live = useRef(false);
  const { request, cancel } = context;
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; cancel(owner); };
  }, [cancel, owner]);
  const ensureReady = useCallback(async (continueAfterSetup = false) => {
    const status = await window.skillRecorder.aiConnectionStatus();
    if (!live.current) return false;
    if (aiConnectionReady(status)) return true;
    const saved = await request(owner);
    return saved && continueAfterSetup;
  }, [request, owner]);
  const configure = useCallback(() => request(owner), [request, owner]);
  return { ...context, ensureReady, configure };
}

export function AiConnectionButton() {
  const { status, notice, configure } = useAiConnection();
  return (
    <div className="ai-connection-summary">
      <button className="row-action" onClick={() => void configure()}>AI 接続</button>
      <span title={aiDestination(status)}>{status?.mode === "byom" ? status.hasKey ? status.profile?.model : "API キーが必要です" : status?.mode === "github" ? "GitHub Copilot" : "未設定"}</span>
      {notice && <small role="status">{japaneseMessage(notice)}</small>}
    </div>
  );
}

function AiProviderDialog({
  initial, onSaved, onClose,
}: {
  initial: AiConnectionStatus;
  onSaved(status: AiConnectionStatus): void;
  onClose(): void;
}) {
  const [step, setStep] = useState<"choice" | "byom">(initial.mode === "byom" ? "byom" : "choice");
  const [profile, setProfile] = useState<ByomConfig>(initial.profile ?? {
    provider: "foundry", baseUrl: "", model: "", wireApi: "responses", apiVersion: undefined,
  });
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(initial.warning ?? null);
  const [manualCommand, setManualCommand] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const attempt = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const titleId = useId();

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current!;
    element.showModal();
    return () => {
      mounted.current = false;
      element.close();
      const id = attempt.current;
      attempt.current = null;
      if (id) void window.skillRecorder.aiConnectionCancel(id).catch(() => {
        console.warn("AI 接続の設定をキャンセルできませんでした。");
      });
    };
  }, []);

  const cancel = async () => {
    const id = attempt.current;
    if (!id) { onClose(); return; }
    setCanceling(true);
    try { await window.skillRecorder.aiConnectionCancel(id); }
    catch { if (mounted.current) setError("接続の設定をキャンセルできませんでした。完了までお待ちください。"); }
    finally { if (mounted.current) setCanceling(false); }
  };

  const perform = async (operation: (id: string) => Promise<AiConnectionResult>, close = true) => {
    if (attempt.current) return;
    const id = crypto.randomUUID();
    attempt.current = id;
    setBusy(true);
    setError(null);
    setManualCommand(undefined);
    try {
      const result = await operation(id);
      if (!mounted.current || attempt.current !== id) return;
      if (result.ok) {
        setApiKey("");
        setStatus(result.status);
        if (close) onSaved(result.status);
      } else {
        setError(result.error);
        setManualCommand(result.command);
      }
    } catch {
      if (mounted.current) setError("AI 接続の設定を完了できませんでした。もう一度お試しください。");
    } finally {
      if (attempt.current === id) attempt.current = null;
      if (mounted.current) setBusy(false);
    }
  };

  const save = () => {
    let parsed: ByomConfig;
    try { parsed = parseByomConfig(profile); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "接続設定の入力内容を確認してください。"); return; }
    void perform((id) => window.skillRecorder.aiConnectionSave(id, parsed, apiKey || undefined));
  };

  const savedKey = status.hasKey && sameCredentialDestination(status.profile, profile);
  return createPortal(
    <dialog ref={dialog} className="sheet ai-connection-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); void cancel(); }}>
      <div className="sheet-head">
        <h2 id={titleId}>{step === "choice" ? "AI の接続方法を選ぶ" : "独自のモデルを使う"}</h2>
        <button className="ghost" onClick={() => void cancel()} disabled={canceling}>{busy ? "キャンセル" : "閉じる"}</button>
      </div>
      {step === "choice" ? <>
        <p className="sheet-lead">解析と生成に使う接続方法を選びます。接続方法はあとから「AI 接続」で変更できます。</p>
        <button className="row-action ai-choice" disabled={busy} onClick={() => setStep("byom")}>
          <strong>独自のモデルを使う</strong><span>Microsoft Foundry、OpenAI、Anthropic など、利用するプロバイダーの API キーを使います。GitHub へのログインは不要です。プロバイダーの利用料金がかかります。</span>
        </button>
        <button className="row-action ai-choice" disabled={busy}
          onClick={() => void perform((id) => window.skillRecorder.aiConnectionGitHub(id))}>
          <strong>GitHub で認証</strong><span>GitHub アカウントで GitHub Copilot に接続します。GitHub のサブスクリプションをお持ちの方や Microsoft の従業員が利用できます。</span>
        </button>
      </> : <>
        <button className="linky" disabled={busy} onClick={() => { setStep("choice"); setError(null); }}>接続方法の選択に戻る</button>
        <form className="ai-provider-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <fieldset disabled={busy}>
            <label>プロバイダー<select value={profile.provider} onChange={(event) => {
              const preset = PROVIDERS.find((item) => item.id === event.target.value)!;
              setProfile({ provider: preset.id, baseUrl: preset.baseUrl, model: "", wireApi: preset.wireApi,
                apiVersion: preset.id === "azure" ? "2024-10-21" : undefined });
              setApiKey("");
              setError(null);
            }}>{PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
            <label>ベース URL<input type="url" required value={profile.baseUrl} placeholder="https://your-resource.openai.azure.com/openai/v1/"
              onChange={(event) => { setProfile({ ...profile, baseUrl: event.target.value }); setApiKey(""); }} /></label>
            <label>{profile.provider === "foundry" || profile.provider === "azure" ? "デプロイ名" : "モデル ID"}
              <input required value={profile.model} autoComplete="off" onChange={(event) => setProfile({ ...profile, model: event.target.value })} /></label>
            <label>API キー<input type="password" autoComplete="new-password" spellCheck={false} value={apiKey} required={!savedKey}
              placeholder={savedKey ? "保存済みのキーを使う場合は空欄" : "プロバイダーの API キーを入力"}
              onChange={(event) => setApiKey(event.target.value)} /></label>
            <details><summary>詳細設定</summary>
              {profile.provider !== "anthropic" && <label>API 形式<select value={profile.wireApi}
                onChange={(event) => setProfile({ ...profile, wireApi: event.target.value === "responses" ? "responses" : "completions" })}>
                <option value="responses">Responses API</option><option value="completions">Chat Completions API</option>
              </select></label>}
              {profile.provider === "azure" && <label>Azure API バージョン<input required value={profile.apiVersion ?? ""}
                onChange={(event) => setProfile({ ...profile, apiVersion: event.target.value })} /></label>}
              <p className="sheet-lead">Foundry v1 の URL は /openai/v1/ で終わります。バージョン指定型の Azure エンドポイントではリソースのホスト名だけを指定します。デプロイが対応する API 形式を選んでください。</p>
            </details>
          </fieldset>
          <p className="sheet-lead">モデルは画像入力とツール呼び出しに対応している必要があります。「テストして保存」では、テスト用の小さな画像とツール呼び出しを送信します。録画は送信しません。テストにはプロバイダーの利用料金がかかります。</p>
          <div className="sheet-actions">
            <button type="submit" className="row-action" disabled={busy}>テストして保存</button>
            {status.hasKey && <button type="button" className="linky" disabled={busy}
              onClick={() => void perform((id) => window.skillRecorder.aiConnectionForget(id), false)}>キーを削除</button>}
          </div>
        </form>
        <small className="ai-storage-notice" role="status">{status.storage === "memory" ? MEMORY_KEY_NOTICE
          : "API キーは OS の安全なストレージに保存されます。「キーを削除」はこのアプリに保存されたキーを削除します。プロバイダー側のキーは有効なままです。"}</small>
      </>}
      {busy && <p role="status" className="sheet-lead">{canceling ? "キャンセル中…" : step === "choice" ? "GitHub へのアクセスを確認中です。サインインの案内が表示されたら手順を完了してください。" : "接続を確認中…"}</p>}
      {error && <p role="alert" className="sheet-caution">{japaneseMessage(error)}</p>}
      {manualCommand && <p className="sheet-lead">以下のコマンドでもサインインできます。完了したら「GitHub で認証」を選び直してください。
        <code className="signin-command">{manualCommand}</code>
      </p>}
    </dialog>, document.body,
  );
}
