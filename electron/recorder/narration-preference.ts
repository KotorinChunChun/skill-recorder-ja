import { readFileSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";

import {
  isNarrationLanguagePreference,
  SYSTEM_NARRATION_LANGUAGE,
  type NarrationLanguagePreference,
} from "../../common/narration";
import { createLogger } from "../logger";

const log = createLogger("Narration preference");

export function loadNarrationPreference(file: string): NarrationLanguagePreference {
  try {
    const preference: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (isNarrationLanguagePreference(preference)) return preference;
    log.warn("Ignoring invalid narration preference");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn("Could not read narration preference:", error);
    }
  }
  return SYSTEM_NARRATION_LANGUAGE;
}

export async function saveNarrationPreference(file: string, preference: NarrationLanguagePreference): Promise<void> {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(preference) + "\n");
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
