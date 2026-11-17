import { narrationLanguageLabel, type NarrationLanguage } from "../common/narration";

const japaneseLanguages = new Intl.DisplayNames("ja", { type: "language", fallback: "none" });

export function japaneseNarrationLanguage(language: NarrationLanguage): string {
  return japaneseLanguages.of(language) ?? narrationLanguageLabel(language);
}
