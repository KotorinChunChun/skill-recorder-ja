import {
  buildTargetFor,
  type BuildTarget,
  type SkillArchitecture,
} from "../common/architecture-registry";
import type { SkillPlacement } from "../common/ipc";

export interface SkillPlacementAction {
  placement: SkillPlacement;
  primary: boolean;
  label: string;
  title: string;
}

export interface SkillPlacementModel {
  defaultPlacement: SkillPlacement;
  actions: readonly SkillPlacementAction[];
  installDoneTitle: string;
  installDoneMessage: string;
}

export function skillTargetFor(architecture: SkillArchitecture): BuildTarget {
  return buildTargetFor(architecture, "skill");
}

export function skillPlacementModel(target: BuildTarget): SkillPlacementModel {
  if (target.placements.length === 0) {
    throw new Error(`Skill target "${target.label}" must declare at least one placement.`);
  }

  const defaultPlacement = target.placements[0];
  const placements = [...target.placements.slice(1), defaultPlacement];
  const actions = placements.map((placement) => {
    const primary = placement === defaultPlacement;
    const label =
      placement === "install"
        ? `${target.installTargetLabel} に追加`
        : primary
          ? "スキルをエクスポート"
          : "エクスポート…";
    const title =
      placement === "install"
        ? `スキルを ${target.installTargetLabel} に追加して、自動で読み込めるようにする`
        : "選択したフォルダーにスキルを保存";
    return { placement, primary, label, title };
  });

  return {
    defaultPlacement,
    actions,
    installDoneTitle: `${target.installTargetLabel} に追加しました`,
    installDoneMessage: `は ${target.installTargetLabel} に追加され、自動で読み込まれます。`,
  };
}
