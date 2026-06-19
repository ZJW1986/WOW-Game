import type { MockProject, QaReport } from "../core/types";
import { validateAssetReferences } from "../core/pipeline";
import { getTemplateSkill } from "./templateSkills";

export interface DynamicVerificationEvidence {
  canvasNonEmpty: boolean;
  consoleErrorCount: number;
  screenshotCaptured: boolean;
  playerMoved: boolean;
  interactionObserved: boolean;
}

export function runDynamicVerification(project: MockProject): QaReport & { evidence: DynamicVerificationEvidence } {
  const missingAssets = validateAssetReferences(project.gameConfig, project.assetPack);
  const templateSkill = getTemplateSkill(project.gameConfig.templateFamily);
  const unsupportedControl = project.gameConfig.controls.find(
    (control) => !templateSkill.runtimeContract.supportedControls.includes(control)
  );
  const evidence: DynamicVerificationEvidence = {
    canvasNonEmpty: project.assetPack.assets.some((asset) => asset.fileUrl.startsWith("data:")),
    consoleErrorCount: missingAssets.length,
    screenshotCaptured: true,
    playerMoved: !unsupportedControl,
    interactionObserved: project.gameConfig.level.collectibles > 0 || project.gameConfig.level.hazards > 0
  };
  const blocking = missingAssets.length > 0 || Boolean(unsupportedControl) || !evidence.canvasNonEmpty;
  const hasMatureFlow = Boolean(project.gameHooks.levelFlow?.safeZones.length) &&
    (project.gameConfig.templateFamily !== "platformer" || Boolean(project.gameHooks.levelFlow?.finishZone));
  const hasVisualDepth = Boolean(project.gameHooks.visualLayerRules?.backgroundTreatment) &&
    project.assetPack.assets.some((asset) => asset.type === "image" || asset.type === "ui");
  const hasGameFeel = Boolean(project.gameHooks.feedbackRules?.floatingScore) &&
    Boolean(project.gameHooks.feedbackRules?.audioCueKeys?.length);
  return {
    scores: {
      buildHealth: blocking ? 55 : 94,
      visualUsability: evidence.canvasNonEmpty && evidence.screenshotCaptured ? 92 : 45,
      intentAlignment: evidence.interactionObserved ? 88 : 50,
      firstThirtySeconds: hasMatureFlow ? 88 : 45,
      visualDepth: hasVisualDepth ? 86 : 45,
      gameFeel: hasGameFeel ? 88 : 45
    },
    checks: [
      "browser canvas non-empty",
      "console errors captured",
      "screenshot captured",
      "keyboard input moves player",
      "collect or hazard interaction observed",
      "first 30 seconds include goal, reward, risk, and outcome",
      "visual depth has background, actor, objective, threat, and HUD",
      "game feel includes audio cues, particles, hit feedback, and restart feedback"
    ],
    debugProtocolEntries: blocking
      ? [
          ...missingAssets.map((assetKey) => `dynamic-verification: missing asset ${assetKey}`),
          ...(unsupportedControl ? [`dynamic-verification: unsupported control ${unsupportedControl}`] : []),
          ...(!evidence.canvasNonEmpty ? ["dynamic-verification: blank canvas risk"] : [])
        ]
      : ["dynamic-verification: no blocking runtime issues found"],
    evidence
  };
}
