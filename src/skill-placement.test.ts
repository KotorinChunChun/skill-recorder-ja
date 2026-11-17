import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_TARGET, TARGETS } from "../common/skill";
import { skillPlacementModel, skillTargetFor } from "./skill-placement";

test("placement model preserves Scout and Cowork action ordering", () => {
  const defaultSkill = skillPlacementModel(skillTargetFor(DEFAULT_TARGET.architecture));
  assert.equal(defaultSkill.defaultPlacement, "install");
  assert.deepEqual(
    defaultSkill.actions.map(({ placement, primary, label }) => [placement, primary, label]),
    [
      ["export", false, "エクスポート…"],
      ["install", true, "Scout に追加"],
    ],
  );
  assert.equal(defaultSkill.installDoneTitle, "Scout に追加しました");
  assert.equal(defaultSkill.installDoneMessage, "は Scout に追加され、自動で読み込まれます。");

  const exportOnlyTarget = TARGETS.find(
    (target) =>
      target.kind === "skill" &&
      target.enabled &&
      target.placements.length === 1 &&
      target.placements[0] === "export" &&
      target.architecture !== DEFAULT_TARGET.architecture,
  );
  assert.ok(exportOnlyTarget);

  const exportOnly = skillPlacementModel(skillTargetFor(exportOnlyTarget.architecture));
  assert.equal(exportOnly.defaultPlacement, "export");
  assert.deepEqual(
    exportOnly.actions.map(({ placement, primary, label }) => [placement, primary, label]),
    [["export", true, "スキルをエクスポート"]],
  );
});
