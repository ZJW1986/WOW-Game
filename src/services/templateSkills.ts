import type { TemplateFamily } from "../core/types";

export type TemplateHook = "setupEntities" | "setupCollisions" | "handleCustomRules" | "onWin" | "onLose";

export interface TemplateSkill {
  templateFamily: TemplateFamily;
  runtimeContract: {
    requiredMechanics: string[];
    supportedControls: string[];
    winModes: string[];
    failModes: string[];
  };
  allowedHooks: TemplateHook[];
  forbiddenActions: string[];
}

const ALLOWED_HOOKS: TemplateHook[] = [
  "setupEntities",
  "setupCollisions",
  "handleCustomRules",
  "onWin",
  "onLose"
];

const TEMPLATE_SKILLS: Record<TemplateFamily, TemplateSkill> = {
  platformer: templateSkill("platformer", {
    requiredMechanics: ["gravity", "jump", "platform collision", "hazards", "goal"],
    supportedControls: ["ArrowLeft", "ArrowRight", "Space"],
    winModes: ["reach_exit", "collect_score"],
    failModes: ["hit_hazard"]
  }),
  top_down: templateSkill("top_down", {
    requiredMechanics: ["free movement", "arena bounds", "collectibles", "chase hazards"],
    supportedControls: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"],
    winModes: ["collect_score", "survive_timer"],
    failModes: ["hit_hazard"]
  }),
  grid_logic: templateSkill("grid_logic", {
    requiredMechanics: ["grid", "discrete movement", "push", "switches", "target cells"],
    supportedControls: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"],
    winModes: ["solve_state"],
    failModes: ["moves_exhausted"]
  }),
  tower_defense: templateSkill("tower_defense", {
    requiredMechanics: ["path", "waves", "tower placement", "enemy health", "base health"],
    supportedControls: ["Mouse", "1", "2"],
    winModes: ["defend_base"],
    failModes: ["base_destroyed"]
  }),
  ui_heavy: templateSkill("ui_heavy", {
    requiredMechanics: ["cards", "choices", "state panel", "turns", "resource changes"],
    supportedControls: ["Mouse", "Enter"],
    winModes: ["survive_timer", "solve_state"],
    failModes: ["time_out"]
  })
};

export function getTemplateSkill(templateFamily: TemplateFamily): TemplateSkill {
  return TEMPLATE_SKILLS[templateFamily];
}

export function listTemplateSkills(): TemplateSkill[] {
  return Object.values(TEMPLATE_SKILLS);
}

function templateSkill(
  templateFamily: TemplateFamily,
  runtimeContract: TemplateSkill["runtimeContract"]
): TemplateSkill {
  return {
    templateFamily,
    runtimeContract,
    allowedHooks: ALLOWED_HOOKS,
    forbiddenActions: [
      "rewrite Phaser lifecycle",
      "register scenes dynamically",
      "load assets outside asset-pack",
      "generate arbitrary TypeScript runtime code"
    ]
  };
}
