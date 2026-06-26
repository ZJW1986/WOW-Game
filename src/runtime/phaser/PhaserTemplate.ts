/**
 * @deprecated PhaserTemplate lifecycle hooks (preload/create/update/teardown)
 * are not invoked by the active runtime — the real Phaser scene lives in
 * `src/ui/PhaserPreview.tsx`. The interface is kept because the template
 * registry in `./registry.ts` still consumes it for id-only template lookups
 * via `src/core/start.ts`.
 */
import type { AssetPack, GameHooks, TemplateFamily } from "../../core/types";

export interface PhaserTemplateInput {
  assetPack?: AssetPack;
  hooks?: GameHooks;
}

export interface PhaserTemplateState {
  phase: "idle" | "playing" | "won" | "lost";
}

export interface PhaserTemplateValidation {
  ok: boolean;
  errors: string[];
}

export interface PhaserTemplate {
  id: TemplateFamily;
  preload(scene: unknown, assetPack?: AssetPack): void;
  create(scene: unknown, input: PhaserTemplateInput): unknown;
  update(scene: unknown, instance: unknown, dt: number, input?: unknown): PhaserTemplateState;
  teardown(scene: unknown, instance: unknown): void;
  validateHooks(hooks?: GameHooks): PhaserTemplateValidation;
}
