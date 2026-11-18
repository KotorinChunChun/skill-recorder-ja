import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_NARRATION_LANGUAGE,
  isNarrationLanguage,
  NARRATION_LANGUAGES,
  narrationLanguageLabel,
  resolveSystemNarrationLanguage,
} from "./narration";

test("narration exposes all Whisper languages alphabetically with English as the fallback", () => {
  const codes = NARRATION_LANGUAGES.map(({ code }) => code);
  const labels = NARRATION_LANGUAGES.map(({ label }) => label);

  assert.equal(NARRATION_LANGUAGES.length, 99);
  assert.equal(new Set(codes).size, NARRATION_LANGUAGES.length);
  assert.deepEqual(labels, [...labels].sort((left, right) => left.localeCompare(right, "en")));
  assert.equal(DEFAULT_NARRATION_LANGUAGE, "en");
  assert.equal(narrationLanguageLabel(DEFAULT_NARRATION_LANGUAGE), "English");
  assert.equal(isNarrationLanguage("haw"), true);
  assert.equal(isNarrationLanguage("xx"), false);
});

test("the first supported system language is used for narration", () => {
  assert.equal(resolveSystemNarrationLanguage(["ja-JP", "en-US"]), "ja");
  assert.equal(resolveSystemNarrationLanguage(["en-US", "ja-JP"]), "en");
  assert.equal(resolveSystemNarrationLanguage(["fake_locale_!", "zu-ZA", "fr_CA"]), "fr");
  assert.equal(resolveSystemNarrationLanguage(["fil-PH"]), "tl");
  assert.equal(resolveSystemNarrationLanguage(["jv-ID"]), "jw");
  assert.equal(resolveSystemNarrationLanguage(["nb-NO"]), "no");
  assert.equal(resolveSystemNarrationLanguage(["zu-ZA"]), "en");
  assert.equal(resolveSystemNarrationLanguage([]), "en");
});
