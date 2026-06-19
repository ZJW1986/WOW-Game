import type { TemplateFamily } from "../core/types";

export interface ReferenceGamePattern {
  id: string;
  templateFamily: TemplateFamily;
  designIntent: string;
  beats: string[];
  visualPrinciples: string[];
  feedbackPrinciples: string[];
  difficultyPrinciples: string[];
  avoidCopying: boolean;
}

const PATTERNS: Record<TemplateFamily, ReferenceGamePattern> = {
  platformer: {
    id: "pattern-platformer-first-run",
    templateFamily: "platformer",
    designIntent: "A short first-run platform route with a safe start, readable jump arc, reward path, risk, and finish.",
    beats: ["start safe", "tutorial collectible", "jump arc", "hazard timing", "finish gate"],
    visualPrinciples: ["parallax background", "clear ground silhouette", "coin trail guides jumps"],
    feedbackPrinciples: ["floating score", "collect burst", "hit flash", "finish celebration"],
    difficultyPrinciples: ["teach before punish", "one hazard after first reward", "finish visible before final jump"],
    avoidCopying: true
  },
  top_down: {
    id: "pattern-top-down-pressure-loop",
    templateFamily: "top_down",
    designIntent: "A compact arena loop with immediate movement, safe zone, collect route, enemy pressure, and near miss recovery.",
    beats: ["safe zone", "first collectible", "enemy pressure", "near miss escape", "reward feedback"],
    visualPrinciples: ["high contrast arena", "readable player silhouette", "visible threat lanes"],
    feedbackPrinciples: ["collect burst", "screen shake on hit", "danger flash near hazards"],
    difficultyPrinciples: ["enemy pressure ramps after two pickups", "leave escape lanes open", "keep target visible"],
    avoidCopying: true
  },
  tower_defense: {
    id: "pattern-tower-defense-first-wave",
    templateFamily: "tower_defense",
    designIntent: "A readable first wave with visible route, base health, enemy preview, and defensive feedback.",
    beats: ["route preview", "base health", "first wave", "enemy pressure", "victory wave"],
    visualPrinciples: ["clear path contrast", "base anchor", "enemy wave readability"],
    feedbackPrinciples: ["wave alert", "base hit flash", "enemy defeat burst"],
    difficultyPrinciples: ["slow first wave", "second wave faster", "base survives several mistakes"],
    avoidCopying: true
  },
  grid_logic: {
    id: "pattern-grid-logic-first-puzzle",
    templateFamily: "grid_logic",
    designIntent: "A small puzzle board with visible goal, blocked cells, and early-state clarity.",
    beats: ["state preview", "first move", "blocked choice", "goal reveal", "solve feedback"],
    visualPrinciples: ["clean grid", "strong goal marker", "distinct blockers"],
    feedbackPrinciples: ["valid move pulse", "invalid move shake", "solve celebration"],
    difficultyPrinciples: ["few moves", "one obvious first action", "no hidden rules"],
    avoidCopying: true
  },
  ui_heavy: {
    id: "pattern-ui-heavy-rule-prototype",
    templateFamily: "ui_heavy",
    designIntent: "A compact rule prototype with clear choice, result feedback, and progress state.",
    beats: ["choice prompt", "resource change", "risk reveal", "reward feedback", "summary state"],
    visualPrinciples: ["clear hierarchy", "strong status badges", "minimal panels"],
    feedbackPrinciples: ["button click feedback", "reward pulse", "risk warning"],
    difficultyPrinciples: ["one core decision", "immediate consequence", "short loop"],
    avoidCopying: true
  }
};

export function getReferenceGamePattern(templateFamily: TemplateFamily): ReferenceGamePattern {
  return PATTERNS[templateFamily];
}
