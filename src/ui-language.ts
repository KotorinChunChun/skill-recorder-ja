import { narrationLanguageLabel, type NarrationLanguage } from "../common/narration";
import type { BuildTarget } from "../common/architecture-registry";

const japaneseLanguages = new Intl.DisplayNames("ja", { type: "language", fallback: "none" });

export function japaneseNarrationLanguage(language: NarrationLanguage): string {
  return japaneseLanguages.of(language) ?? narrationLanguageLabel(language);
}

export function japaneseTarget({ architecture, kind, label, note }: BuildTarget) {
  if (architecture === "scout") {
    return kind === "automation"
      ? { label: "Scout の自動化", note: "設定した時刻や条件に合わせて Scout が複数の操作を実行します。" }
      : { label: "Scout のスキル", note: "スキルの説明に合うタスクを Scout が実行するときに使います。" };
  }
  if (architecture === "cowork") {
    return { label: "Cowork のスキル", note: "Microsoft 365 Copilot（Cowork）用のスキルをエクスポートします。" };
  }
  if (architecture === "agent-skill") {
    return { label: "汎用エージェントスキル", note: "スキルに対応するエージェントで使えます。実行に必要なツールが使えることを確認してください。" };
  }
  return { label, note };
}

export function japaneseDeviceLabel(label: string): string {
  return label === "System default" ? "システムの既定" : label.replace(/^Screen (?=\d)/, "画面 ");
}
