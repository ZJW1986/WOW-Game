import { useEffect, useId, useRef, useState } from "react";
import type { AssetPack, GameConfig, GameHooks } from "../core/types";
import {
  collectPlayableItem,
  createFeedbackRules,
  createPlayableRules,
  createPlayableRuntimeState,
  hitPlayableHazard,
  PREVIEW_PRIMARY_ACTION_EVENT,
  readPreviewActionLabel,
  restartPlayableRuntime,
  startPlayableRuntime,
  type PlayablePhase,
  type PlayableRuntimeState
} from "./playableRuntime";
import { createRuntimeAssetReport, selectPreviewRuntimeAssets } from "./previewAssets";
import {
  createGridLogicRuntime,
  moveGridCursor,
  stepGridLogicRuntime,
  type GridDirection,
  type GridLogicRuntime
} from "../runtime/phaser/gridLogic";
import {
  createTowerDefenseRuntime,
  placeTower,
  stepTowerDefenseRuntime,
  type TowerDefenseRuntime,
  type TowerDefenseRuntimeInput
} from "../runtime/phaser/towerDefense";
import { ScoreTierOverlay, type ScoreTierRunResult } from "./ScoreTierOverlay";

type RuntimeEnemyKind = "chaser" | "patroller" | "charger" | "shooter" | "orbiter" | "mine" | "legacy";
const START_GRACE_MS = 800;
const SPAWN_SAFE_RADIUS = 150;

interface RuntimeEnemy {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  kind: RuntimeEnemyKind;
  originX: number;
  originY: number;
  speed: number;
  spawnedAt: number;
  nextAttackAt: number;
  chargeUntil: number;
  warned: boolean;
}

interface RuntimeProjectile {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  spawnedAt: number;
}

type TowerDefenseViewObject = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
type GridLogicViewObject = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;
type UiHeavyChoiceCard = {
  card: Phaser.GameObjects.Rectangle;
  quality: number;
  label: Phaser.GameObjects.Text;
};

export function PhaserPreview({
  config,
  assetPack,
  gameHooks,
  compact = false,
  onSubmitFeedback,
  iterationHint
}: {
  config: GameConfig;
  assetPack?: AssetPack;
  gameHooks?: GameHooks;
  compact?: boolean;
  onSubmitFeedback?: (input: { rating: number; comment: string }) => Promise<void> | void;
  iterationHint?: string;
}) {
  const id = useId().replace(/:/g, "");
  const containerId = `phaser-${id}`;
  const gameRef = useRef<import("phaser").Game | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [runtimePhase, setRuntimePhase] = useState<PlayablePhase | "loading_assets" | "asset_error">("loading_assets");
  const [runtimeResult, setRuntimeResult] = useState<ScoreTierRunResult | null>(null);
  const [assetErrors, setAssetErrors] = useState<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const actionLabel = isPlayablePhase(runtimePhase) ? readPreviewActionLabel(runtimePhase) : "";
  const runtimeAssetReport = createRuntimeAssetReport(assetPack);
  const shouldShowDiagnostics = runtimePhase === "loading_assets" || runtimePhase === "asset_error" || showDiagnostics;

  useEffect(() => {
    let disposed = false;
    const emitRuntimePhase = (phase: PlayablePhase | "loading_assets" | "asset_error") => {
      if (disposed) return;
      setRuntimePhase(phase);
      frameRef.current?.setAttribute("data-runtime-phase", phase);
    };
    const emitRuntimeResult = (result: ScoreTierRunResult | null) => {
      if (disposed) return;
      setRuntimeResult(result);
    };
    const runtimeAssets = selectPreviewRuntimeAssets(assetPack);
    const initialAssetReport = createRuntimeAssetReport(assetPack);
    setAssetErrors(initialAssetReport.errors);
    emitRuntimePhase(initialAssetReport.ready ? "loading_assets" : "asset_error");
    const audio = createDemoAudio(runtimeAssets);
    const feedbackRules = createFeedbackRules({
      ...gameHooks?.collisionRules,
      ...gameHooks?.feedbackRules
    });
    const rules = createPlayableRules({
      configWinScore: config.level.winScore,
      hookWinTarget: gameHooks?.winCondition.target,
      collectibleValue: gameHooks?.collectibleRules.value,
      hookLives: gameHooks?.failCondition.lives
    });

    async function mountGame() {
      if (!initialAssetReport.ready) return;
      const Phaser = await import("phaser");
      if (disposed) return;
      const loaderErrors: string[] = [];
      const requiredTextures = new Set([
        "generated-player",
        "generated-collectible",
        "generated-hazard",
        "generated-background"
      ]);

      class DemoScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
        private runtimeState: PlayableRuntimeState = createPlayableRuntimeState();
        private status!: Phaser.GameObjects.Text;
        private scoreText!: Phaser.GameObjects.Text;
        private flash!: Phaser.GameObjects.Rectangle;
        private collectibles: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
        private hazards: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
        private enemies: RuntimeEnemy[] = [];
        private projectiles: RuntimeProjectile[] = [];
        private activeWarnings: Phaser.GameObjects.GameObject[] = [];
        private finishGate?: Phaser.GameObjects.Rectangle;
        private overlay?: Phaser.GameObjects.Container;
        private worldObjects: Phaser.GameObjects.GameObject[] = [];
        private towerDefenseRuntime?: TowerDefenseRuntime;
        private towerDefenseVisuals = new Map<string, TowerDefenseViewObject>();
        private towerDefenseBuildSites: Phaser.GameObjects.Rectangle[] = [];
        private towerDefenseLastPhase: TowerDefenseRuntime["phase"] = "playing";
        private gridLogicRuntime?: GridLogicRuntime;
        private gridLogicVisuals = new Map<string, GridLogicViewObject>();
        private gridLogicLastPhase: GridLogicRuntime["phase"] = "playing";
        private uiHeavyChoiceCards: UiHeavyChoiceCard[] = [];
        private uiHeavyMood = 3;
        private uiHeavyIncome = 0;
        private uiHeavyDeadline = 0;
        private lastHitAt = 0;
        private lastDashAt = 0;
        private dashUntil = 0;
        private startedAt = 0;
        private deathCount = 0;
        private activeStageId = "";
        private stageSpeedMultiplier = 1;
        private stageEnemySpawnDelta = 0;
        private triggeredTimeline = new Set<string>();

        constructor() {
          super("DemoScene");
        }

        preload() {
          this.load.on("loaderror", (file: { key?: string; src?: string }) => {
            if (!file.key || !requiredTextures.has(file.key)) return;
            const detail = describeTextureLoadError(file.key, file.src, initialAssetReport);
            loaderErrors.push(detail);
          });
          loadImage(this, "generated-player", runtimeAssets.player);
          loadImage(this, "generated-collectible", runtimeAssets.collectible);
          loadImage(this, "generated-hazard", runtimeAssets.hazard);
          loadImage(this, "generated-background", runtimeAssets.background);
          loadImage(this, "generated-tile", runtimeAssets.tile);
        }

        create() {
          const missingTextures = Array.from(requiredTextures).filter((key) => !this.textures.exists(key));
          const errors = [...loaderErrors, ...missingTextures.map((key) => describeTextureLoadError(key, undefined, initialAssetReport))];
          if (errors.length > 0) {
            setAssetErrors(errors);
            emitRuntimePhase("asset_error");
            this.showAssetErrorScreen(errors);
            return;
          }
          emitRuntimePhase("idle");
          this.cameras.main.setBackgroundColor("#15202b");
          this.flash = this.add.rectangle(0, 0, 960, 540, 0xffffff, 0).setOrigin(0).setDepth(20);
          this.cursors = this.input.keyboard?.createCursorKeys();
          this.input.keyboard?.on("keydown-ENTER", () => this.handlePrimaryAction(Phaser));
          this.input.keyboard?.on("keydown-UP", () => this.handleGridLogicMove("up", Phaser));
          this.input.keyboard?.on("keydown-DOWN", () => this.handleGridLogicMove("down", Phaser));
          this.input.keyboard?.on("keydown-LEFT", () => this.handleGridLogicMove("left", Phaser));
          this.input.keyboard?.on("keydown-RIGHT", () => this.handleGridLogicMove("right", Phaser));
          this.input.keyboard?.on("keydown-SPACE", () => {
            if (config.templateFamily === "grid_logic") {
              this.handleGridLogicMove("right", Phaser);
            } else if (this.runtimeState.phase === "playing" && config.templateFamily !== "platformer") {
              this.tryDash(Phaser);
            } else if (this.runtimeState.phase !== "playing") {
              this.handlePrimaryAction(Phaser);
            }
          });
          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (this.handleTowerDefensePointer(pointer, Phaser)) return;
            if (this.handleUiHeavyPointer(pointer, Phaser)) return;
            this.handlePrimaryAction(Phaser);
          });
          const handleDomPrimaryAction = () => this.handlePrimaryAction(Phaser);
          window.addEventListener(PREVIEW_PRIMARY_ACTION_EVENT, handleDomPrimaryAction);
          this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener(PREVIEW_PRIMARY_ACTION_EVENT, handleDomPrimaryAction);
          });
          this.showStartScreen();
        }

        private showAssetErrorScreen(errors: string[]) {
          this.cameras.main.setBackgroundColor("#161b22");
          this.add.text(36, 42, "素材加载失败，已阻止色块预览", {
            color: "#ffb4b4",
            fontFamily: "Arial",
            fontSize: "24px"
          });
          this.add.text(36, 88, errors.slice(0, 5).join("\n"), {
            color: "#f6f8fb",
            fontFamily: "Arial",
            fontSize: "13px",
            wordWrap: { width: 780 }
          });
        }

        update() {
          if (config.templateFamily === "tower_defense") {
            this.updateTowerDefenseWorld(Phaser);
            return;
          }
          if (config.templateFamily === "grid_logic") {
            this.updateGridLogicWorld(Phaser);
            return;
          }
          if (config.templateFamily === "ui_heavy") {
            this.updateUiHeavyWorld(Phaser);
            return;
          }
          if (this.runtimeState.phase !== "playing" || !this.player?.body) return;
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          const baseSpeed = gameHooks?.numberTuning.playerSpeed ?? (config.templateFamily === "platformer" ? 210 : 250);
          const speed = this.time.now < this.dashUntil ? baseSpeed * 1.75 : baseSpeed;
          body.setVelocityX(0);

          if (this.cursors?.left.isDown) body.setVelocityX(-speed);
          if (this.cursors?.right.isDown) body.setVelocityX(speed);

          if (config.templateFamily === "platformer") {
            if (this.cursors?.space.isDown && body.blocked.down) {
              body.setVelocityY(-(gameHooks?.numberTuning.jumpVelocity || 430));
            }
            if (this.player.y > 590) {
              this.hitHazard(Phaser);
              const spawn = this.getSpawnPoint();
              this.player.setPosition(spawn.x, spawn.y);
            }
          } else {
            body.setVelocityY(0);
            if (this.cursors?.up.isDown) body.setVelocityY(-speed);
            if (this.cursors?.down.isDown) body.setVelocityY(speed);
          }

          this.updateStageDirector(Phaser);
          const startupGraceActive = this.isStartupGraceActive();

          this.collectibles = this.collectibles.filter((item) => {
            if (startupGraceActive) return true;
            if (isNear(this.player, item, feedbackRules.collisionRadius)) {
              this.collectItem(item, Phaser);
              return false;
            }
            return true;
          });

          for (const enemy of this.enemies) {
            this.updateEnemyBehavior(enemy, Phaser);
            if (!startupGraceActive && isNear(this.player, enemy.sprite, feedbackRules.collisionRadius)) {
              this.hitHazard(Phaser);
              break;
            }
          }
          this.updateProjectiles(Phaser);
          if (!startupGraceActive && this.finishGate && isNear(this.player, this.finishGate, 42)) {
            this.reachFinish(Phaser);
          }
        }

        private handlePrimaryAction(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase === "idle") {
            this.startGame(Phaser);
            return;
          }
          if (this.runtimeState.phase === "won" || this.runtimeState.phase === "lost") {
            this.restartGame(Phaser);
          }
        }

        private startGame(Phaser: typeof import("phaser")) {
          this.runtimeState = startPlayableRuntime(this.runtimeState, rules);
          emitRuntimePhase("playing");
          emitRuntimeResult(null);
          this.overlay?.destroy(true);
          this.overlay = undefined;
          this.clearWorld();
          this.startedAt = this.time.now;
          this.deathCount = 0;
          this.activeStageId = "";
          this.stageSpeedMultiplier = 1;
          this.stageEnemySpawnDelta = 0;
          this.triggeredTimeline.clear();
          audio.startBgm();
          this.createWorld(Phaser);
          this.updateHud();
        }

        private restartGame(Phaser: typeof import("phaser")) {
          this.runtimeState = restartPlayableRuntime(this.runtimeState);
          this.showStartScreen();
          this.startGame(Phaser);
        }

        private createWorld(Phaser: typeof import("phaser")) {
          this.addWorldObject(
            runtimeAssets.background && this.textures.exists("generated-background")
              ? this.createCoverBackground("generated-background")
              : this.add.rectangle(0, 0, 960, 540, 0x17212f).setOrigin(0).setDepth(-20)
          );
          this.createVisualDepth();
          this.addWorldObject(this.add.text(24, 20, config.title, {
            color: "#f6f8fb",
            fontFamily: "Arial",
            fontSize: "24px"
          }));
          this.status = this.add.text(24, 54, config.playerGoal, {
            color: "#b9c4d4",
            fontFamily: "Arial",
            fontSize: "14px"
          });
          this.scoreText = this.add.text(24, 78, "", {
            color: "#89f7c6",
            fontFamily: "Arial",
            fontSize: "13px"
          });
          this.addWorldObject(this.status);
          this.addWorldObject(this.scoreText);
          this.addWorldObject(this.add.text(24, 102, controlsLabel(config), {
            color: "#facc15",
            fontFamily: "Arial",
            fontSize: "12px"
          }));

          if (config.templateFamily === "tower_defense") {
            this.createTowerDefenseWorld(Phaser);
            return;
          }
          if (config.templateFamily === "grid_logic") {
            this.createGridLogicWorld(Phaser);
            return;
          }
          if (config.templateFamily === "ui_heavy") {
            this.createUiHeavyWorld(Phaser);
            return;
          }

          const spawn = this.getSpawnPoint();
          this.player = this.createRuntimeImage(spawn.x, spawn.y, "generated-player", 64, 64, 0x5eead4, 8);
          this.addWorldObject(this.player);
          this.physics.add.existing(this.player);
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          body.setCollideWorldBounds(true);

          if (config.templateFamily === "platformer") {
            body.setGravityY(480);
            const platforms = this.physics.add.staticGroup();
            const layoutPlatforms =
              gameHooks?.levelLayout.platforms.length
                ? gameHooks.levelLayout.platforms
                : [
                    { x: 480, y: 510, width: 920, height: 28 },
                    { x: 360, y: 390, width: 180, height: 20 },
                    { x: 680, y: 290, width: 180, height: 20 }
                  ];
            for (const platform of layoutPlatforms) {
              const tile = this.createRuntimeImage(platform.x, platform.y, "generated-tile", platform.width, platform.height, 0x334155, 1, "stretch");
              platforms.add(tile);
              this.addWorldObject(tile);
            }
            this.physics.add.collider(this.player, platforms);
            this.createFinishGate();
          }

          this.createCollectibles(Phaser);
          this.createHazards(Phaser);
        }

        private isStartupGraceActive() {
          return this.runtimeState.phase === "playing" && this.time.now - this.startedAt < START_GRACE_MS;
        }

        private getSpawnPoint() {
          return gameHooks?.levelFlow?.spawnPoint ?? { x: 120, y: config.templateFamily === "platformer" ? 430 : 300 };
        }

        private createGridLogicWorld(Phaser: typeof import("phaser")) {
          this.gridLogicRuntime = createGridLogicRuntime({
            columns: gameHooks?.levelLayout.grid.columns || 5,
            rows: gameHooks?.levelLayout.grid.rows || 3,
            gridState: gameHooks?.levelLayout.gridState,
            maxMoves: gameHooks?.failCondition.lives || 12
          });
          this.gridLogicLastPhase = "playing";
          this.gridLogicVisuals.clear();
          this.status.setText("格子解谜：方向键推动方块，把方块推到发光目标格。");
          this.drawGridBoard();
          this.syncGridLogicVisuals(Phaser);
          this.updateGridLogicHud();
        }

        private handleGridLogicMove(direction: GridDirection, Phaser: typeof import("phaser")) {
          if (config.templateFamily !== "grid_logic" || this.runtimeState.phase !== "playing" || !this.gridLogicRuntime) return;
          const beforeMoves = this.gridLogicRuntime.movesUsed;
          this.gridLogicRuntime = moveGridCursor(this.gridLogicRuntime, direction);
          if (this.gridLogicRuntime.movesUsed !== beforeMoves) {
            audio.playCollect();
            this.syncGridLogicVisuals(Phaser);
            this.updateGridLogicWorld(Phaser);
          }
        }

        private updateGridLogicWorld(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing" || !this.gridLogicRuntime) return;
          this.gridLogicRuntime = stepGridLogicRuntime(this.gridLogicRuntime, this.game.loop.delta);
          this.syncGridLogicVisuals(Phaser);
          this.updateGridLogicHud();
          if (this.gridLogicRuntime.phase === this.gridLogicLastPhase) return;
          this.gridLogicLastPhase = this.gridLogicRuntime.phase;
          if (this.gridLogicRuntime.phase === "won") {
            this.runtimeState.phase = "won";
            this.finalizeRun("won");
            emitRuntimePhase("won");
            audio.playWin();
            this.status.setText("胜利！目标格已全部完成。");
            this.showEndScreen("won");
          } else if (this.gridLogicRuntime.phase === "lost") {
            this.runtimeState.phase = "lost";
            this.finalizeRun("lost");
            emitRuntimePhase("lost");
            audio.playLose();
            this.status.setText("失败：步数用尽，重新规划路线。");
            this.showEndScreen("lost");
          }
        }

        private drawGridBoard() {
          if (!this.gridLogicRuntime) return;
          const metrics = gridMetrics(this.gridLogicRuntime);
          for (let row = 0; row < this.gridLogicRuntime.rows; row += 1) {
            for (let column = 0; column < this.gridLogicRuntime.columns; column += 1) {
              const point = gridCellCenter(this.gridLogicRuntime, column, row);
              const tile = this.add.rectangle(point.x, point.y, metrics.cellSize - 6, metrics.cellSize - 6, 0x172554, 0.72)
                .setStrokeStyle(1, 0x38bdf8, 0.32)
                .setDepth(2);
              this.addWorldObject(tile);
            }
          }
          for (const target of this.gridLogicRuntime.targets) {
            const point = gridCellCenter(this.gridLogicRuntime, target.column, target.row);
            this.addWorldObject(this.add.circle(point.x, point.y, metrics.cellSize * 0.24, 0xfacc15, 0.18).setStrokeStyle(3, 0xfacc15).setDepth(3));
          }
          for (const wall of this.gridLogicRuntime.walls) {
            const point = gridCellCenter(this.gridLogicRuntime, wall.column, wall.row);
            this.addWorldObject(this.add.rectangle(point.x, point.y, metrics.cellSize - 12, metrics.cellSize - 12, 0x334155, 0.95).setDepth(4));
          }
        }

        private syncGridLogicVisuals(Phaser: typeof import("phaser")) {
          if (!this.gridLogicRuntime) return;
          const liveIds = new Set<string>();
          this.syncGridObject("grid-player", this.gridLogicRuntime.player, "generated-player", 48, 48, 0x5eead4, liveIds);
          this.gridLogicRuntime.blocks.forEach((block, index) => {
            this.syncGridObject(`grid-block-${index}`, block, "generated-hazard", 52, 52, 0xfb7185, liveIds);
          });
          for (const [id, object] of Array.from(this.gridLogicVisuals.entries())) {
            if (liveIds.has(id)) continue;
            object.destroy();
            this.gridLogicVisuals.delete(id);
          }
          if (this.gridLogicRuntime.phase === "won") {
            const center = gridCellCenter(this.gridLogicRuntime, this.gridLogicRuntime.player.column, this.gridLogicRuntime.player.row);
            this.burst(center.x, center.y, 0xfacc15, Phaser, 14);
          }
        }

        private syncGridObject(
          id: string,
          cell: { column: number; row: number },
          textureKey: string,
          width: number,
          height: number,
          color: number,
          liveIds: Set<string>
        ) {
          liveIds.add(id);
          const point = gridCellCenter(this.gridLogicRuntime!, cell.column, cell.row);
          let object = this.gridLogicVisuals.get(id);
          if (!object) {
            object = this.createRuntimeImage(point.x, point.y, textureKey, width, height, color, 6);
            this.gridLogicVisuals.set(id, object);
            this.addWorldObject(object);
          }
          object.setPosition(point.x, point.y);
        }

        private updateGridLogicHud() {
          if (!this.gridLogicRuntime) return;
          this.scoreText?.setText(
            `步数 ${this.gridLogicRuntime.movesUsed}/${this.gridLogicRuntime.maxMoves} | 方块 ${this.gridLogicRuntime.blocks.length} | 目标 ${this.gridLogicRuntime.targets.length} | ${assetPackSummary(assetPack)}`
          );
        }

        private createUiHeavyWorld(Phaser: typeof import("phaser")) {
          this.uiHeavyChoiceCards = [];
          this.uiHeavyMood = 3;
          this.uiHeavyIncome = 0;
          this.uiHeavyDeadline = this.time.now + Math.max(18000, (gameHooks?.failCondition.lives ?? 60) * 1000);
          this.status.setText("Management: click the best order cards, keep mood above zero, and hit the income target.");
          this.addWorldObject(this.add.rectangle(480, 292, 760, 300, 0x0f172a, 0.82).setStrokeStyle(2, 0x38bdf8, 0.6).setDepth(2));
          const avatar = this.createRuntimeImage(170, 292, "generated-player", 92, 92, 0x5eead4, 4);
          this.addWorldObject(avatar);
          this.addWorldObject(this.add.text(170, 365, "Operator", {
            color: "#b9e8ee",
            fontFamily: "Arial",
            fontSize: "13px"
          }).setOrigin(0.5).setDepth(5));
          const cardSpecs = [
            { x: 370, quality: 1, title: "Fast Order", color: 0x334155 },
            { x: 530, quality: 2, title: "Combo Order", color: 0x0f766e },
            { x: 690, quality: -1, title: "Risk Order", color: 0x7f1d1d }
          ];
          for (const spec of cardSpecs) {
            const card = this.add.rectangle(spec.x, 292, 126, 168, spec.color, 0.92).setStrokeStyle(2, 0xfacc15, 0.55).setDepth(5);
            const icon = this.createRuntimeImage(spec.x, 252, spec.quality < 0 ? "generated-hazard" : "generated-collectible", 44, 44, spec.quality < 0 ? 0xfb7185 : 0xfacc15, 6);
            const label = this.add.text(spec.x, 326, `${spec.title}\n${spec.quality > 0 ? `+${spec.quality} income` : "-1 mood"}`, {
              align: "center",
              color: "#f8fafc",
              fixedWidth: 110,
              fontFamily: "Arial",
              fontSize: "13px"
            }).setOrigin(0.5).setDepth(7);
            this.uiHeavyChoiceCards.push({ card, quality: spec.quality, label });
            this.addWorldObject(card);
            this.addWorldObject(icon);
            this.addWorldObject(label);
          }
          this.updateUiHeavyHud();
        }

        private handleUiHeavyPointer(pointer: Phaser.Input.Pointer, Phaser: typeof import("phaser")): boolean {
          if (config.templateFamily !== "ui_heavy" || this.runtimeState.phase !== "playing") return false;
          const selected = this.uiHeavyChoiceCards.find(({ card }) => Phaser.Geom.Rectangle.Contains(card.getBounds(), pointer.x, pointer.y));
          if (!selected) return true;
          if (selected.quality > 0) {
            this.uiHeavyIncome += selected.quality;
            this.runtimeState = collectPlayableItem(this.runtimeState, rules.winScore, selected.quality);
            this.floatText(selected.card.x, selected.card.y - 92, `+$${selected.quality}`, "#facc15");
            this.burst(selected.card.x, selected.card.y, 0xfacc15, Phaser, feedbackRules.collectBurstCount);
            audio.playCollect();
          } else {
            this.uiHeavyMood -= 1;
            this.floatText(selected.card.x, selected.card.y - 92, "Mood -1", "#fb7185");
            this.burst(selected.card.x, selected.card.y, 0xfb7185, Phaser, 8);
            audio.playHit();
          }
          this.updateUiHeavyHud();
          if (this.uiHeavyIncome >= rules.winScore || this.runtimeState.score >= rules.winScore) {
            this.runtimeState.phase = "won";
            this.finalizeRun("won");
            emitRuntimePhase("won");
            audio.playWin();
            this.status.setText("Victory: income target reached and the rush is under control.");
            this.showEndScreen("won");
          } else if (this.uiHeavyMood <= 0) {
            this.runtimeState.phase = "lost";
            this.finalizeRun("lost");
            emitRuntimePhase("lost");
            audio.playLose();
            this.status.setText("Failed: customer mood collapsed.");
            this.showEndScreen("lost");
          }
          return true;
        }

        private updateUiHeavyWorld(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing") return;
          this.updateStageDirector(Phaser);
          const remainingMs = this.uiHeavyDeadline - this.time.now;
          if (remainingMs <= 0) {
            const outcome = this.uiHeavyIncome >= rules.winScore ? "won" : "lost";
            this.runtimeState.phase = outcome;
            this.finalizeRun(outcome);
            emitRuntimePhase(outcome);
            if (outcome === "won") {
              audio.playWin();
              this.status.setText("Victory: daily summary passed.");
            } else {
              audio.playLose();
              this.status.setText("Failed: rush timer ended before the target.");
            }
            this.showEndScreen(outcome);
            return;
          }
          this.updateUiHeavyHud();
        }

        private updateUiHeavyHud() {
          const remainingSeconds = Math.max(0, Math.ceil((this.uiHeavyDeadline - this.time.now) / 1000));
          this.scoreText?.setText(
            `Income ${this.uiHeavyIncome}/${rules.winScore} | Mood ${this.uiHeavyMood} | Time ${remainingSeconds}s | ${assetPackSummary(assetPack)}`
          );
        }

        private createTowerDefenseWorld(Phaser: typeof import("phaser")) {
          const input = createTowerDefenseInput(config, gameHooks);
          this.towerDefenseRuntime = createTowerDefenseRuntime(input);
          this.towerDefenseLastPhase = "playing";
          this.towerDefenseVisuals.clear();
          this.towerDefenseBuildSites = [];

          const graphics = this.add.graphics().setDepth(1);
          graphics.lineStyle(34, 0x334155, 0.72);
          graphics.beginPath();
          input.path.forEach((point, index) => {
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
          });
          graphics.strokePath();
          graphics.lineStyle(4, 0x67e8f9, 0.8);
          graphics.strokePath();
          this.addWorldObject(graphics);

          const basePoint = input.path[input.path.length - 1];
          this.addWorldObject(this.add.rectangle(basePoint.x, basePoint.y, 72, 86, 0x0f766e, 0.92).setStrokeStyle(3, 0x5eead4).setDepth(4));
          this.addWorldObject(this.add.text(basePoint.x, basePoint.y - 58, "BASE", {
            color: "#b9fff2",
            fontFamily: "Arial",
            fontSize: "12px",
            fontStyle: "bold"
          }).setOrigin(0.5).setDepth(5));

          const buildSites = [
            { x: 270, y: 190 },
            { x: 420, y: 390 },
            { x: 575, y: 180 },
            { x: 710, y: 380 }
          ];
          for (const site of buildSites) {
            const marker = this.add.rectangle(site.x, site.y, 58, 58, 0x0f172a, 0.58).setStrokeStyle(2, 0xfacc15, 0.82).setDepth(3);
            this.towerDefenseBuildSites.push(marker);
            this.addWorldObject(marker);
            this.addWorldObject(this.add.text(site.x, site.y + 42, "建塔", {
              color: "#facc15",
              fontFamily: "Arial",
              fontSize: "11px"
            }).setOrigin(0.5).setDepth(5));
          }
          this.status.setText("塔防：点击黄色建造点放置炮塔，阻止敌人进入基地。");
          this.updateTowerDefenseHud();
          this.placeStartingTower(Phaser);
        }

        private placeStartingTower(Phaser: typeof import("phaser")) {
          if (!this.towerDefenseRuntime || this.towerDefenseBuildSites.length === 0) return;
          const site = this.towerDefenseBuildSites[0];
          const before = this.towerDefenseRuntime.towers.length;
          this.towerDefenseRuntime = placeTower(this.towerDefenseRuntime, "basic", site.x, site.y);
          if (this.towerDefenseRuntime.towers.length > before) {
            this.burst(site.x, site.y, 0xfacc15, Phaser, 8);
            audio.playCollect();
          }
          this.updateTowerDefenseHud();
        }

        private handleTowerDefensePointer(pointer: Phaser.Input.Pointer, Phaser: typeof import("phaser")): boolean {
          if (config.templateFamily !== "tower_defense" || this.runtimeState.phase !== "playing" || !this.towerDefenseRuntime) return false;
          const site = this.towerDefenseBuildSites.find((candidate) => Math.hypot(candidate.x - pointer.x, candidate.y - pointer.y) <= 40);
          if (!site) return true;
          const before = this.towerDefenseRuntime.towers.length;
          this.towerDefenseRuntime = placeTower(this.towerDefenseRuntime, "basic", site.x, site.y);
          if (this.towerDefenseRuntime.towers.length > before) {
            this.burst(site.x, site.y, 0xfacc15, Phaser, 8);
            audio.playCollect();
          } else {
            this.floatText(site.x, site.y - 40, "金币不足", "#fb7185");
          }
          this.updateTowerDefenseHud();
          return true;
        }

        private updateTowerDefenseWorld(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing" || !this.towerDefenseRuntime) return;
          this.towerDefenseRuntime = stepTowerDefenseRuntime(this.towerDefenseRuntime, this.game.loop.delta);
          this.syncTowerDefenseVisuals(Phaser);
          this.updateTowerDefenseHud();

          if (this.towerDefenseRuntime.phase === this.towerDefenseLastPhase) return;
          this.towerDefenseLastPhase = this.towerDefenseRuntime.phase;
          if (this.towerDefenseRuntime.phase === "won") {
            this.runtimeState.phase = "won";
            this.finalizeRun("won");
            emitRuntimePhase("won");
            audio.playWin();
            this.status.setText("胜利！全部波次已清除，基地守住了。");
            this.showEndScreen("won");
          } else if (this.towerDefenseRuntime.phase === "lost") {
            this.runtimeState.phase = "lost";
            this.finalizeRun("lost");
            emitRuntimePhase("lost");
            audio.playLose();
            this.status.setText("失败：敌人突破路线，基地被摧毁。");
            this.showEndScreen("lost");
          }
        }

        private syncTowerDefenseVisuals(Phaser: typeof import("phaser")) {
          if (!this.towerDefenseRuntime) return;
          const liveIds = new Set<string>();

          for (const tower of this.towerDefenseRuntime.towers) {
            liveIds.add(tower.id);
            if (!this.towerDefenseVisuals.has(tower.id)) {
              const turret = this.createRuntimeImage(tower.x, tower.y, "generated-player", 56, 56, 0x5eead4, 7);
              this.towerDefenseVisuals.set(tower.id, turret);
              this.addWorldObject(turret);
            }
          }

          for (const enemy of this.towerDefenseRuntime.enemies) {
            liveIds.add(enemy.id);
            const point = pointOnPolyline(this.towerDefenseRuntime.path, enemy.progress);
            let enemyView = this.towerDefenseVisuals.get(enemy.id);
            if (!enemyView) {
              enemyView = this.createRuntimeImage(point.x, point.y, "generated-hazard", 46, 46, 0xfb7185, 6);
              this.towerDefenseVisuals.set(enemy.id, enemyView);
              this.addWorldObject(enemyView);
            }
            enemyView.setPosition(point.x, point.y);
          }

          for (const [id, object] of Array.from(this.towerDefenseVisuals.entries())) {
            if (liveIds.has(id)) continue;
            this.burst((object as { x: number }).x, (object as { y: number }).y, 0xff8a3d, Phaser, 10);
            audio.playHit();
            object.destroy();
            this.towerDefenseVisuals.delete(id);
          }
        }

        private updateTowerDefenseHud() {
          if (!this.towerDefenseRuntime) return;
          const remainingEnemies = this.towerDefenseRuntime.enemies.length;
          const totalSpawned = this.towerDefenseRuntime.spawnedByWave.reduce((sum, count) => sum + count, 0);
          this.scoreText?.setText(
            `金币 ${this.towerDefenseRuntime.gold} | 基地 ${this.towerDefenseRuntime.baseHp} | 击杀 ${this.towerDefenseRuntime.kills} | 场上 ${remainingEnemies} | 已出怪 ${totalSpawned}`
          );
        }

        private collectItem(item: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, Phaser: typeof import("phaser")) {
          item.destroy();
          this.worldObjects = this.worldObjects.filter((object) => object !== item);
          this.runtimeState = collectPlayableItem(this.runtimeState, rules.winScore, rules.collectibleValue);
          audio.playCollect();
          this.floatText(item.x, item.y - 28, `+${rules.collectibleValue}`, "#facc15");
          this.burst(item.x, item.y, 0xfacc15, Phaser, feedbackRules.collectBurstCount);
          this.updateHud();
          if (this.runtimeState.phase === "won") {
            this.finalizeRun("won");
            emitRuntimePhase("won");
            audio.playWin();
            this.stopPlayer();
            this.status.setText("胜利！目标已完成。");
            this.cameras.main.flash(360, 58, 255, 210);
            this.burst(this.player.x, this.player.y, 0x5eead4, Phaser, feedbackRules.particleCount);
            this.showEndScreen("won");
          }
        }

        private reachFinish(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing") return;
          this.runtimeState = collectPlayableItem(this.runtimeState, rules.winScore, rules.winScore);
          this.finalizeRun("won");
          emitRuntimePhase("won");
          audio.playWin();
          this.stopPlayer();
          this.status.setText("胜利！抵达终点。");
          this.floatText(this.player.x, this.player.y - 40, "FINISH", "#45f6c8");
          this.burst(this.player.x, this.player.y, 0x5eead4, Phaser, feedbackRules.particleCount);
          this.showEndScreen("won");
        }

        private createVisualDepth() {
          const treatment = gameHooks?.visualLayerRules?.backgroundTreatment ?? "";
          if (!treatment.includes("parallax")) return;
          const far = this.add.rectangle(710, 94, 260, 46, 0x164e63, 0.26).setDepth(0);
          const mid = this.add.rectangle(230, 132, 210, 34, 0x0f766e, 0.18).setDepth(0);
          this.addWorldObject(far);
          this.addWorldObject(mid);
          this.tweens.add({ targets: far, x: 690, duration: 4200, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: mid, x: 250, duration: 3600, yoyo: true, repeat: -1 });
        }

        private createFinishGate() {
          const finish = gameHooks?.levelFlow?.finishZone;
          if (!finish || config.templateFamily !== "platformer") return;
          const point = avoidSpawnPoint(finish.x, finish.y, this.getSpawnPoint(), config.templateFamily);
          this.finishGate = this.add
            .rectangle(point.x, point.y, finish.width, finish.height, 0x45f6c8, 0.18)
            .setStrokeStyle(2, 0x45f6c8);
          this.addWorldObject(this.finishGate);
          this.addWorldObject(this.add.text(point.x, point.y - finish.height / 2 - 18, "GOAL", {
            color: "#45f6c8",
            fontFamily: "Arial",
            fontSize: "12px",
            fontStyle: "bold"
          }).setOrigin(0.5));
        }

        private floatText(x: number, y: number, text: string, color: string) {
          if (!gameHooks?.feedbackRules?.floatingScore) return;
          const label = this.add.text(x, y, text, {
            color,
            fontFamily: "Arial",
            fontSize: "16px",
            fontStyle: "bold"
          }).setOrigin(0.5).setDepth(12);
          this.tweens.add({
            targets: label,
            y: y - 32,
            alpha: 0,
            duration: 620,
            ease: Phaser.Math.Easing.Cubic.Out,
            onComplete: () => label.destroy()
          });
        }

        private finalizeRun(outcome: "won" | "lost") {
          const durationMs = Math.max(0, this.time.now - this.startedAt);
          emitRuntimeResult({
            outcome,
            score: this.runtimeState.score,
            deaths: this.deathCount,
            durationMs
          });
        }

        private hitHazard(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing") return;
          const now = this.time.now;
          if (now - this.lastHitAt < feedbackRules.invulnerabilityMs) return;
          this.lastHitAt = now;
          this.deathCount += 1;
          this.runtimeState = hitPlayableHazard(this.runtimeState);
          audio.playHit();
          if (gameHooks?.impactRules?.hitStopMs) {
            this.time.timeScale = 0.35;
            this.time.delayedCall(gameHooks.impactRules.hitStopMs, () => {
              this.time.timeScale = 1;
            });
          }
          this.applyKnockback();
          if (this.runtimeState.phase === "playing") {
            this.status.setText(`受伤！剩余生命 ${this.runtimeState.lives}`);
            this.burst(this.player.x, this.player.y, 0xffb020, Phaser, feedbackRules.particleCount);
            this.updateHud();
            return;
          }
          this.finalizeRun("lost");
          emitRuntimePhase("lost");
          audio.playLose();
          this.stopPlayer();
          this.status.setText("失败！碰到了危险物。");
          this.cameras.main.shake(180, feedbackRules.screenShakeIntensity);
          this.flash.setFillStyle(0xff315a, 0.34);
          this.tweens.add({
            targets: this.flash,
            alpha: 0,
            duration: 260,
            onComplete: () => this.flash.setAlpha(0)
          });
          this.burst(this.player.x, this.player.y, 0xfb7185, Phaser, feedbackRules.particleCount);
          this.showEndScreen("lost");
        }

        private applyKnockback() {
          const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
          if (!body || feedbackRules.knockbackForce <= 0) return;
          const xDirection = this.player.x > 480 ? 1 : -1;
          body.setVelocity(xDirection * feedbackRules.knockbackForce, -feedbackRules.knockbackForce * 0.45);
          this.tweens.add({
            targets: this.player,
            alpha: { from: 0.35, to: 1 },
            duration: Math.max(120, feedbackRules.invulnerabilityMs / 4),
            repeat: 2,
            yoyo: true
          });
        }

        private tryDash(Phaser: typeof import("phaser")) {
          const now = this.time.now;
          if (now - this.lastDashAt < 650) return;
          this.lastDashAt = now;
          this.dashUntil = now + 180;
          audio.playCollect();
          this.floatText(this.player.x, this.player.y - 38, "DASH", "#38bdf8");
          this.burst(this.player.x, this.player.y, 0x38bdf8, Phaser, 10);
          this.tweens.add({
            targets: this.player,
            alpha: { from: 0.55, to: 1 },
            duration: 90,
            repeat: 1,
            yoyo: true
          });
        }

        private createCollectibles(Phaser: typeof import("phaser")) {
          const placement = gameHooks?.collectibleRules.placement ?? (config.templateFamily === "platformer" ? "arc" : "line");
          const lanes = expandHookLanes(gameHooks, config.level.collectibles);
          const count = Math.max(1, config.level.collectibles);
          for (let index = 0; index < count; index += 1) {
            const lane = config.templateFamily === "top_down" && lanes.length > 0 ? lanes[index % lanes.length] : undefined;
            const x = placement === "grid" ? 230 + (index % 4) * 110 : 230 + index * 95;
            const y =
              lane
                ? lane.y - 36
                : placement === "grid"
                ? 150 + Math.floor(index / 4) * 90
                : placement === "arc" || config.templateFamily === "platformer"
                  ? 330 - (index % 3) * 70
                  : 150 + (index % 3) * 90;
            const point = avoidSpawnPoint(x, y, this.getSpawnPoint(), config.templateFamily);
            const item = this.createRuntimeImage(point.x, point.y, "generated-collectible", 42, 42, 0xfacc15, 4);
            this.collectibles.push(item);
            this.addWorldObject(item);
            this.tweens.add({
              targets: item,
              angle: 360,
              scale: { from: 0.9, to: 1.18 },
              duration: 1600,
              repeat: -1,
              yoyo: true,
              ease: Phaser.Math.Easing.Sine.InOut
            });
          }
        }

        private createHazards(Phaser: typeof import("phaser")) {
          if (gameHooks?.enemyArchetypes?.length) {
            this.createArchetypeEnemies(Phaser);
            return;
          }
          const hookMovement = gameHooks?.enemyRules.movement;
          const hazardCount = Math.max(config.level.hazards, gameHooks?.spawnRules?.maxActiveHazards ?? config.level.hazards);
          const hookLanes = expandHookLanes(gameHooks, hazardCount);
          for (let index = 0; index < hazardCount; index += 1) {
            const lane = hookLanes.length > 0 ? hookLanes[index % hookLanes.length] : undefined;
            const x =
              hookMovement === "wave" || config.gameplay.spawnPattern === "waves"
                ? 960 + index * 70
                : config.gameplay.spawnPattern === "grid"
                  ? 250 + (index % 4) * 110
                  : 310 + index * 140;
            const y =
              lane
                ? lane.y
                : config.gameplay.spawnPattern === "lanes" || config.gameplay.spawnPattern === "waves"
                  ? 150 + (index % 3) * 95
                  : config.templateFamily === "platformer"
                    ? 480
                    : 250 + (index % 2) * 110;
            const movement = hookMovement ?? (config.gameplay.enemyBehavior === "timer" ? "static" : config.gameplay.enemyBehavior);
            const point = avoidSpawnPoint(x, y, this.getSpawnPoint(), config.templateFamily);
            const hazard = this.createRuntimeImage(point.x, point.y, "generated-hazard", 58, 58, 0xfb7185, 6);
            this.hazards.push(hazard);
            this.enemies.push({
              sprite: hazard,
              kind: movement === "chase" ? "chaser" : movement === "patrol" ? "patroller" : "legacy",
              originX: point.x,
              originY: point.y,
              speed: gameHooks?.enemyRules.speed ?? 120,
              spawnedAt: this.time.now,
              nextAttackAt: this.time.now + 1400,
              chargeUntil: 0,
              warned: false
            });
            this.addWorldObject(hazard);
            if (movement === "patrol") {
              this.tweens.add({
                targets: hazard,
                x: point.x + (index % 2 === 0 ? 58 : -58),
                angle: 12,
                duration: 900 + index * 140,
                yoyo: true,
                repeat: -1,
                ease: Phaser.Math.Easing.Sine.InOut
              });
            } else if (movement === "wave") {
              this.tweens.add({
                targets: hazard,
                x: -40,
                duration: Math.max(900, (960 / (lane?.speed ?? gameHooks?.enemyRules.speed ?? 95)) * 1000),
                repeat: -1,
                delay: index * (gameHooks?.enemyRules.waveIntervalMs || 320),
                ease: "Linear"
              });
            } else if (movement !== "chase") {
              this.tweens.add({
                targets: hazard,
                y: y - 28,
                angle: 12,
                duration: 900 + index * 140,
                yoyo: true,
                repeat: -1,
                ease: Phaser.Math.Easing.Sine.InOut
              });
            }
          }
        }

        private createArchetypeEnemies(Phaser: typeof import("phaser")) {
          const archetypes = gameHooks?.enemyArchetypes ?? [];
          let created = 0;
          for (const archetype of archetypes) {
            for (let index = 0; index < archetype.count; index += 1) {
              const laneY = archetype.laneY ?? 145 + ((created + index) % 3) * 115;
              const x =
                archetype.type === "mine"
                  ? 360 + ((created + index) % 4) * 130
                  : archetype.type === "charger" || archetype.type === "shooter"
                    ? 930 + (created + index) * 75
                    : 300 + (created + index) * 115;
              const y = config.templateFamily === "platformer" ? 470 - ((created + index) % 2) * 95 : laneY;
              const point = avoidSpawnPoint(x, y, this.getSpawnPoint(), config.templateFamily);
              const enemy = this.createRuntimeImage(point.x, point.y, "generated-hazard", archetype.type === "mine" ? 46 : 58, archetype.type === "mine" ? 46 : 58, 0xfb7185, 6);
              this.hazards.push(enemy);
              this.enemies.push({
                sprite: enemy,
                kind: archetype.type,
                originX: point.x,
                originY: point.y,
                speed: archetype.speed,
                spawnedAt: this.time.now + archetype.spawnAfterMs,
                nextAttackAt: this.time.now + archetype.spawnAfterMs + 900,
                chargeUntil: 0,
                warned: false
              });
              enemy.setVisible(archetype.spawnAfterMs === 0);
              this.addWorldObject(enemy);
              if (archetype.type === "mine") this.createWarning(enemy.x, enemy.y, runtimeEffectRadius(gameHooks?.attackRules?.explosionRadius ?? 72), Phaser, archetype.spawnAfterMs);
            }
            created += archetype.count;
          }
        }

        private updateEnemyBehavior(enemy: RuntimeEnemy, Phaser: typeof import("phaser")) {
          const hazard = enemy.sprite;
          if (this.time.now < enemy.spawnedAt) return;
          hazard.setVisible(true);
          if (enemy.kind === "mine") {
            this.updateMine(enemy, Phaser);
            return;
          }
          if (enemy.kind === "shooter") {
            this.updateShooter(enemy, Phaser);
          }
          if (enemy.kind === "charger") {
            this.updateCharger(enemy, Phaser);
            return;
          }
          if (enemy.kind === "orbiter") {
            const elapsed = (this.time.now - enemy.spawnedAt) / 1000;
            hazard.x = 480 + Math.cos(elapsed * 1.3 + enemy.originX) * 220;
            hazard.y = enemy.originY + Math.sin(elapsed * 1.8) * 60;
            return;
          }
          if (enemy.kind === "patroller" || enemy.kind === "legacy") return;
          if (!this.player) return;
          const dx = this.player.x - hazard.x;
          const dy = this.player.y - hazard.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const speed = ((enemy.speed ?? gameHooks?.numberTuning.hazardSpeed ?? 130) / 120) * this.stageSpeedMultiplier;
          hazard.x += (dx / distance) * speed;
          hazard.y += (dy / distance) * speed;
        }

        private updateShooter(enemy: RuntimeEnemy, Phaser: typeof import("phaser")) {
          if (this.time.now < enemy.nextAttackAt || !this.player) return;
          enemy.nextAttackAt = this.time.now + (gameHooks?.attackRules?.projectileCooldownMs ?? 1400);
          this.spawnProjectile(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y, Phaser);
        }

        private updateCharger(enemy: RuntimeEnemy, Phaser: typeof import("phaser")) {
          if (!this.player) return;
          if (this.time.now > enemy.nextAttackAt && !enemy.warned) {
            enemy.warned = true;
            this.createWarning(this.player.x, this.player.y, 44, Phaser, 0);
          }
          if (enemy.warned && this.time.now > enemy.nextAttackAt + (gameHooks?.attackRules?.warningMs ?? 420)) {
            enemy.warned = false;
            enemy.chargeUntil = this.time.now + 520;
            enemy.nextAttackAt = this.time.now + 2400;
          }
          const dx = this.player.x - enemy.sprite.x;
          const dy = this.player.y - enemy.sprite.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const speed = (this.time.now < enemy.chargeUntil ? enemy.speed / 34 : enemy.speed / 150) * this.stageSpeedMultiplier;
          enemy.sprite.x += (dx / distance) * speed;
          enemy.sprite.y += (dy / distance) * speed;
        }

        private updateMine(enemy: RuntimeEnemy, Phaser: typeof import("phaser")) {
          if (!this.player || enemy.warned) return;
          const radius = runtimeEffectRadius(gameHooks?.attackRules?.explosionRadius ?? 72);
          if (!isNear(this.player, enemy.sprite, radius)) return;
          enemy.warned = true;
          this.createWarning(enemy.sprite.x, enemy.sprite.y, radius, Phaser, 0);
          this.time.delayedCall(gameHooks?.attackRules?.explosionDelayMs ?? 650, () => {
            this.explodeAt(enemy.sprite.x, enemy.sprite.y, radius, Phaser);
            enemy.sprite.destroy();
            this.enemies = this.enemies.filter((item) => item !== enemy);
            this.hazards = this.hazards.filter((item) => item !== enemy.sprite);
          });
        }

        private spawnProjectile(x: number, y: number, targetX: number, targetY: number, Phaser: typeof import("phaser")) {
          const dx = targetX - x;
          const dy = targetY - y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const speed = gameHooks?.attackRules?.projectileSpeed ?? 180;
          const projectile = this.add.circle(x, y, 7, 0xfff3b0, 0.95).setStrokeStyle(2, 0xff8a3d).setDepth(7);
          this.projectiles.push({
            sprite: projectile,
            velocityX: (dx / distance) * speed,
            velocityY: (dy / distance) * speed,
            spawnedAt: this.time.now
          });
          this.addWorldObject(projectile);
          this.burst(x, y, 0xfff3b0, Phaser, 6);
        }

        private updateProjectiles(Phaser: typeof import("phaser")) {
          const delta = this.game.loop.delta / 1000;
          this.projectiles = this.projectiles.filter((projectile) => {
            projectile.sprite.x += projectile.velocityX * delta;
            projectile.sprite.y += projectile.velocityY * delta;
            const expired =
              this.time.now - projectile.spawnedAt > 5000 ||
              projectile.sprite.x < -40 ||
              projectile.sprite.x > 1000 ||
              projectile.sprite.y < -40 ||
              projectile.sprite.y > 580;
            if (!expired && !this.isStartupGraceActive() && isNear(this.player, projectile.sprite, 8)) {
              this.explodeAt(projectile.sprite.x, projectile.sprite.y, runtimeEffectRadius(gameHooks?.attackRules?.explosionRadius ?? 52), Phaser);
              projectile.sprite.destroy();
              return false;
            }
            if (expired) projectile.sprite.destroy();
            return !expired;
          });
        }

        private createWarning(x: number, y: number, radius: number, Phaser: typeof import("phaser"), delayMs: number) {
          const safeRadius = runtimeEffectRadius(radius);
          const warning = this.add.circle(x, y, safeRadius, 0xff315a, 0.1).setStrokeStyle(2, 0xff8a3d, 0.75).setDepth(6);
          warning.setVisible(delayMs === 0);
          this.activeWarnings.push(warning);
          this.addWorldObject(warning);
          if (delayMs > 0) {
            this.time.delayedCall(delayMs, () => warning.setVisible(true));
          }
          this.tweens.add({
            targets: warning,
            scale: { from: 0.85, to: 1.16 },
            alpha: { from: 0.2, to: 0.02 },
            duration: gameHooks?.attackRules?.warningMs ?? 420,
            yoyo: true,
            repeat: 1,
            ease: Phaser.Math.Easing.Sine.InOut,
            onComplete: () => {
              warning.destroy();
              this.activeWarnings = this.activeWarnings.filter((item) => item !== warning);
            }
          });
        }

        private explodeAt(x: number, y: number, radius: number, Phaser: typeof import("phaser")) {
          const safeRadius = runtimeEffectRadius(radius);
          audio.playHit();
          this.cameras.main.shake(160, gameHooks?.impactRules?.screenShakeIntensity ?? feedbackRules.screenShakeIntensity);
          this.flash.setFillStyle(0xff8a3d, 0.24);
          this.tweens.add({ targets: this.flash, alpha: 0, duration: 220, onComplete: () => this.flash.setAlpha(0) });
          this.burst(x, y, 0xff8a3d, Phaser, gameHooks?.impactRules?.explosionParticles ?? feedbackRules.particleCount);
          if (!this.isStartupGraceActive() && isNear(this.player, { getBounds: () => ({ x: x - safeRadius / 2, y: y - safeRadius / 2, width: safeRadius, height: safeRadius }) }, 0)) {
            this.hitHazard(Phaser);
          }
        }

        private updateStageDirector(Phaser: typeof import("phaser")) {
          const elapsed = this.time.now - this.startedAt;
          const stage = currentStage(gameHooks, elapsed);
          if (stage && stage.id !== this.activeStageId) {
            this.activeStageId = stage.id;
            this.stageSpeedMultiplier = Math.max(0.5, Math.min(2.5, stage.speedMultiplier ?? 1));
            const incomingDelta = Math.max(0, Math.min(12, Math.round(stage.enemySpawnDelta ?? 0)));
            const reinforcement = Math.max(0, incomingDelta - this.stageEnemySpawnDelta);
            this.stageEnemySpawnDelta = incomingDelta;
            this.status.setText(`${stage.label} · ${stage.objective.toUpperCase()}`);
            this.floatText(this.player.x, this.player.y - 52, stage.label, "#93c5fd");
            if (reinforcement > 0) this.spawnStageReinforcement(Phaser, stage, reinforcement);
            audio.playCollect();
          }
          for (const event of gameHooks?.encounterTimeline ?? []) {
            const key = `${event.trigger}:${event.atMs}:${event.event}`;
            if (this.triggeredTimeline.has(key)) continue;
            const shouldTrigger =
              event.trigger === "time" ? elapsed >= event.atMs : this.runtimeState.score >= Math.max(1, Math.floor(event.atMs / 3000));
            if (!shouldTrigger) continue;
            this.triggeredTimeline.add(key);
            this.status.setText(event.message);
            this.floatText(this.player.x, this.player.y - 58, event.message, "#facc15");
            if (event.event === "projectile_burst") this.fireProjectileBurst(Phaser, event.intensity);
            if (event.event === "spawn_mine") this.spawnTimelineMines(Phaser, event.intensity);
            if (event.event === "reward_burst") this.spawnRewardBurst(Phaser, event.intensity);
          }
        }

        private spawnStageReinforcement(
          Phaser: typeof import("phaser"),
          stage: NonNullable<GameHooks["stageGoals"]>[number],
          count: number
        ) {
          const archetypes = gameHooks?.enemyArchetypes ?? [];
          const preferred = archetypes.find((entry) => stage.enemyMix.includes(entry.id))
            ?? archetypes[Math.min(archetypes.length - 1, stage.startsAtMs > 30000 ? 1 : 0)]
            ?? archetypes[0];
          for (let index = 0; index < count; index += 1) {
            const x = clampPosition(280 + index * 130, 90, 880);
            const y = config.templateFamily === "platformer"
              ? clampPosition(440 - (index % 2) * 90, 200, 480)
              : clampPosition(160 + (index % 3) * 110, 130, 460);
            const point = avoidSpawnPoint(x, y, this.getSpawnPoint(), config.templateFamily);
            const sprite = this.createRuntimeImage(point.x, point.y, "generated-hazard", 48, 48, 0xfb7185, 6);
            this.hazards.push(sprite);
            this.enemies.push({
              sprite,
              kind: (preferred?.type as RuntimeEnemyKind) ?? "patroller",
              originX: point.x,
              originY: point.y,
              speed: preferred?.speed ?? gameHooks?.numberTuning.hazardSpeed ?? 120,
              spawnedAt: this.time.now,
              nextAttackAt: this.time.now + 700,
              chargeUntil: 0,
              warned: false
            });
            this.addWorldObject(sprite);
          }
        }

        private fireProjectileBurst(Phaser: typeof import("phaser"), intensity: number) {
          for (let index = 0; index < intensity + 1; index += 1) {
            this.spawnProjectile(900, 120 + index * 110, this.player.x, this.player.y, Phaser);
          }
        }

        private spawnTimelineMines(Phaser: typeof import("phaser"), intensity: number) {
          for (let index = 0; index < intensity; index += 1) {
            const x = 330 + index * 160;
            const y = config.templateFamily === "platformer" ? 470 - (index % 2) * 90 : 170 + (index % 3) * 95;
            const point = avoidSpawnPoint(x, y, this.getSpawnPoint(), config.templateFamily);
            const mine = this.createRuntimeImage(point.x, point.y, "generated-hazard", 46, 46, 0xfb7185, 6);
            this.hazards.push(mine);
            this.enemies.push({
              sprite: mine,
              kind: "mine",
              originX: point.x,
              originY: point.y,
              speed: 0,
              spawnedAt: this.time.now,
              nextAttackAt: this.time.now + 900,
              chargeUntil: 0,
              warned: false
            });
            this.addWorldObject(mine);
            this.createWarning(point.x, point.y, runtimeEffectRadius(gameHooks?.attackRules?.explosionRadius ?? 72), Phaser, 0);
          }
        }

        private spawnRewardBurst(Phaser: typeof import("phaser"), intensity: number) {
          for (let index = 0; index < intensity; index += 1) {
            const point = avoidSpawnPoint(420 + index * 70, 210 + (index % 2) * 80, this.getSpawnPoint(), config.templateFamily);
            const item = this.createRuntimeImage(point.x, point.y, "generated-collectible", 42, 42, 0xfacc15, 4);
            this.collectibles.push(item);
            this.addWorldObject(item);
            this.burst(item.x, item.y, 0xfacc15, Phaser, 5);
          }
        }

        private burst(
          x: number,
          y: number,
          color: number,
          Phaser: typeof import("phaser"),
          count = 12
        ) {
          for (let index = 0; index < count; index += 1) {
            const particle = this.add.circle(x, y, 3 + (index % 3), color, 0.9).setDepth(10);
            const angle = (Math.PI * 2 * index) / count;
            this.tweens.add({
              targets: particle,
              x: x + Math.cos(angle) * (38 + (index % 4) * 8),
              y: y + Math.sin(angle) * (38 + (index % 4) * 8),
              alpha: 0,
              scale: 0.2,
              duration: 420,
              ease: Phaser.Math.Easing.Cubic.Out,
              onComplete: () => particle.destroy()
            });
          }
        }

        private showStartScreen() {
          this.clearWorld();
          this.runtimeState = createPlayableRuntimeState();
          emitRuntimePhase("idle");
          this.overlay?.destroy(true);
          this.overlay = this.add.container(0, 0).setDepth(30);
          this.overlay.add(this.add.rectangle(480, 242, 560, 290, 0x06121c, 0.92).setStrokeStyle(2, 0x45f6c8));
          this.overlay.add(this.add.text(480, 140, config.title, {
            color: "#e8fbff",
            fontFamily: "Arial",
            fontSize: "30px",
            fontStyle: "bold"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 184, config.playerGoal, {
            align: "center",
            color: "#b9e8ee",
            fixedWidth: 470,
            fontFamily: "Arial",
            fontSize: "15px"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 228, controlsLabel(config), {
            align: "center",
            color: "#facc15",
            fixedWidth: 460,
            fontFamily: "Arial",
            fontSize: "14px"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 286, "点击或按 Enter 开始", {
            color: "#071018",
            fontFamily: "Arial",
            fontSize: "18px",
            fontStyle: "bold",
            backgroundColor: "#45f6c8",
            padding: { x: 18, y: 10 }
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 346, assetPackSummary(assetPack), {
            color: "#89f7c6",
            fontFamily: "Arial",
            fontSize: "12px"
          }).setOrigin(0.5));
        }

        private showEndScreen(result: "won" | "lost") {
          this.overlay?.destroy(true);
          const won = result === "won";
          this.overlay = this.add.container(0, 0).setDepth(30);
          this.overlay.add(this.add.rectangle(480, 242, 540, 250, won ? 0x062018 : 0x210a12, 0.94).setStrokeStyle(2, won ? 0x45f6c8 : 0xfb7185));
          this.overlay.add(this.add.text(480, 164, won ? "胜利" : "游戏结束", {
            color: won ? "#45f6c8" : "#fb7185",
            fontFamily: "Arial",
            fontSize: "34px",
            fontStyle: "bold"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 218, won ? "目标完成，可以分享给好友试玩。" : "碰到了危险物，换条路线再试。", {
            align: "center",
            color: "#e8fbff",
            fixedWidth: 450,
            fontFamily: "Arial",
            fontSize: "15px"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 286, "点击或按 Enter 重新开始", {
            color: "#071018",
            fontFamily: "Arial",
            fontSize: "17px",
            fontStyle: "bold",
            backgroundColor: won ? "#45f6c8" : "#ffb020",
            padding: { x: 18, y: 10 }
          }).setOrigin(0.5));
        }

        private updateHud() {
          this.scoreText?.setText(`得分 ${this.runtimeState.score}/${rules.winScore} | 生命 ${this.runtimeState.lives} | ${assetPackSummary(assetPack)}`);
        }

        private stopPlayer() {
          const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
          body?.setVelocity(0, 0);
          body?.setEnable(false);
        }

        private clearWorld() {
          this.collectibles = [];
          this.hazards = [];
          this.enemies = [];
          this.projectiles = [];
          this.activeWarnings = [];
          this.finishGate = undefined;
          for (const object of this.worldObjects) {
            object.destroy();
          }
          this.worldObjects = [];
        }

        private addWorldObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
          this.worldObjects.push(object);
          return object;
        }

        private createRuntimeImage(
          x: number,
          y: number,
          textureKey: string,
          width: number,
          height: number,
          fallbackColor: number,
          depth = 5,
          fit: "contain" | "stretch" = "contain"
        ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
          if (this.textures.exists(textureKey)) {
            const image = this.add.image(x, y, textureKey).setDepth(depth);
            if (fit === "stretch") {
              return image.setDisplaySize(width, height);
            }
            const source = this.textures.get(textureKey).getSourceImage() as { width?: number; height?: number };
            const sourceWidth = Math.max(1, source.width || width);
            const sourceHeight = Math.max(1, source.height || height);
            const scale = Math.min(width / sourceWidth, height / sourceHeight);
            return image.setScale(scale);
          }
          emitRuntimePhase("asset_error");
          setAssetErrors([describeTextureLoadError(textureKey, undefined, initialAssetReport)]);
          return this.add.rectangle(x, y, width, height, fallbackColor, 0).setDepth(depth);
        }

        private createCoverBackground(textureKey: string): Phaser.GameObjects.Image {
          const image = this.add.image(480, 270, textureKey).setAlpha(0.78).setDepth(-20);
          const source = this.textures.get(textureKey).getSourceImage() as { width?: number; height?: number };
          const sourceWidth = source.width || 960;
          const sourceHeight = source.height || 540;
          const scale = Math.max(960 / sourceWidth, 540 / sourceHeight);
          image.setScale(scale);
          image.setCrop(
            Math.max(0, (sourceWidth - 960 / scale) / 2),
            Math.max(0, (sourceHeight - 540 / scale) / 2),
            Math.min(sourceWidth, 960 / scale),
            Math.min(sourceHeight, 540 / scale)
          );
          return image;
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerId,
        width: compact ? 720 : 860,
        height: compact ? 405 : 484,
        physics: {
          default: "arcade",
          arcade: { debug: false }
        },
        scene: DemoScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      });
    }

    mountGame();

    return () => {
      disposed = true;
      audio.stop();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [assetPack, compact, config, containerId, gameHooks]);

  return (
    <div
      ref={frameRef}
      className="game-frame"
      id={containerId}
      data-runtime-phase={runtimePhase}
      tabIndex={0}
      aria-label={`${config.title} playable game`}
      onClick={(event) => {
        event.currentTarget.focus();
        window.dispatchEvent(new CustomEvent(PREVIEW_PRIMARY_ACTION_EVENT));
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(PREVIEW_PRIMARY_ACTION_EVENT));
      }}
    >
      {runtimePhase === "loading_assets" && <div className="game-frame-status">正在加载核心图片素材...</div>}
      {runtimePhase === "asset_error" && (
        <div className="game-frame-error">
          <strong>素材加载失败</strong>
          <span>不会回退成测试色块。请重新生成素材或检查下面的 asset-pack URL。</span>
          <ul>
            {assetErrors.slice(0, 4).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {runtimeResult && (runtimePhase === "won" || runtimePhase === "lost") && (
        <ScoreTierOverlay
          result={runtimeResult}
          tiers={gameHooks?.scoreTiers}
          iterationHint={iterationHint}
          onSubmitFeedback={onSubmitFeedback}
          onRestart={() => {
            window.dispatchEvent(new CustomEvent(PREVIEW_PRIMARY_ACTION_EVENT));
          }}
        />
      )}
      {runtimePhase !== "asset_error" && (
        <button
          className="runtime-diagnostics-toggle"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowDiagnostics((visible) => !visible);
          }}
        >
          诊断
        </button>
      )}
      {shouldShowDiagnostics && (
        <div className="runtime-asset-diagnostics" aria-label="runtime asset diagnostics">
          {runtimeAssetReport.slots.map((slot) => (
            <span key={slot.slot} data-status={slot.status}>
              {slot.slot}: {slot.assetKey} / {slot.slotRole} / {slot.runtimeWidth}x{slot.runtimeHeight} / {slot.provider || "unknown"} / {slot.status}
            </span>
          ))}
        </div>
      )}
      {actionLabel && (
        <button
          className="game-frame-action"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            frameRef.current?.focus();
            window.dispatchEvent(new CustomEvent(PREVIEW_PRIMARY_ACTION_EVENT));
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function expandHookLanes(gameHooks: GameHooks | undefined, fallbackCount: number) {
  const lanes = gameHooks?.levelLayout.lanes ?? [];
  return lanes.flatMap((lane) => Array.from({ length: Math.max(1, Math.round(lane.count || 1)) }, () => lane)).slice(0, Math.max(1, fallbackCount));
}

function currentStage(gameHooks: GameHooks | undefined, elapsedMs: number) {
  return (gameHooks?.stageGoals ?? [])
    .filter((stage) => elapsedMs >= stage.startsAtMs && elapsedMs <= stage.startsAtMs + stage.durationMs)
    .sort((a, b) => b.startsAtMs - a.startsAtMs)[0];
}

function avoidSpawnPoint(
  x: number,
  y: number,
  spawn: { x: number; y: number },
  templateFamily: GameConfig["templateFamily"]
) {
  if (Math.hypot(x - spawn.x, y - spawn.y) >= SPAWN_SAFE_RADIUS) return { x, y };
  const offsetX = templateFamily === "platformer" ? SPAWN_SAFE_RADIUS : SPAWN_SAFE_RADIUS + 30;
  const offsetY = templateFamily === "platformer" ? -90 : 80;
  return {
    x: clampPosition(x + offsetX, 80, 880),
    y: clampPosition(y + offsetY, 90, templateFamily === "platformer" ? 470 : 470)
  };
}

function clampPosition(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function runtimeEffectRadius(value: number): number {
  if (!Number.isFinite(value)) return 72;
  return Math.min(96, Math.max(28, value));
}

function assetPackSummary(assetPack?: AssetPack): string {
  if (!assetPack) return "asset-pack：未绑定";
  const ready = assetPack.assets.filter((asset) => asset.status !== "missing" && asset.status !== "failed").length;
  return `asset-pack ${assetPack.versionId}：${ready}/${assetPack.assets.length} 已就绪`;
}

function controlsLabel(config: GameConfig): string {
  if (config.templateFamily === "tower_defense") {
    return `控制：点击黄色建造点放置炮塔。目标：${config.playerGoal}`;
  }
  if (config.templateFamily === "grid_logic") {
    return `控制：方向键推动方块，空格快速向右。目标：${config.playerGoal}`;
  }
  const base =
    config.templateFamily === "platformer"
      ? "控制：方向键左右移动，空格跳跃。"
      : "控制：方向键八方向移动。";
  return `${base} 目标：${config.playerGoal}`;
}

function createTowerDefenseInput(config: GameConfig, gameHooks?: GameHooks): TowerDefenseRuntimeInput {
  const lanes = gameHooks?.levelLayout.lanes ?? [];
  const laneY = lanes[0]?.y ?? gameHooks?.levelFlow?.spawnPoint.y ?? 300;
  const path =
    lanes.length >= 2
      ? lanes.slice(0, 4).map((lane, index) => ({ x: 90 + index * 230, y: lane.y }))
      : [
          { x: 70, y: laneY },
          { x: 270, y: laneY - 95 },
          { x: 500, y: laneY + 85 },
          { x: 725, y: laneY - 35 },
          { x: 880, y: laneY + 15 }
        ];
  const waveTarget = Math.max(6, gameHooks?.winCondition.target ?? config.level.hazards + 4);
  return {
    path,
    waves: [
      {
        startsAtMs: 0,
        count: Math.ceil(waveTarget / 2),
        intervalMs: gameHooks?.enemyRules.waveIntervalMs || 850,
        enemyHp: 4,
        enemySpeed: gameHooks?.enemyRules.speed || 55,
        reward: gameHooks?.collectibleRules.value || 3
      },
      {
        startsAtMs: 5500,
        count: Math.ceil(waveTarget / 2),
        intervalMs: Math.max(420, (gameHooks?.enemyRules.waveIntervalMs || 850) - 180),
        enemyHp: 6,
        enemySpeed: (gameHooks?.enemyRules.speed || 55) + 18,
        reward: (gameHooks?.collectibleRules.value || 3) + 1
      }
    ],
    baseHp: gameHooks?.failCondition.lives || 6,
    startingGold: 45,
    towers: [
      {
        id: "basic",
        cost: 12,
        range: gameHooks?.attackRules?.explosionRadius ? Math.max(110, gameHooks.attackRules.explosionRadius * 1.8) : 135,
        damage: Math.max(2, gameHooks?.attackRules?.contactDamage || 2),
        fireRateMs: gameHooks?.attackRules?.projectileCooldownMs || 460
      }
    ]
  };
}

function pointOnPolyline(path: Array<{ x: number; y: number }>, progress: number): { x: number; y: number } {
  const total = Math.max(1, pathLength(path));
  let remaining = total * Math.max(0, Math.min(1, progress));
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segment = Math.hypot(end.x - start.x, end.y - start.y);
    if (remaining <= segment) {
      const ratio = segment === 0 ? 0 : remaining / segment;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      };
    }
    remaining -= segment;
  }
  return path[path.length - 1] ?? { x: 480, y: 270 };
}

function pathLength(path: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  }
  return total;
}

function gridMetrics(runtime: GridLogicRuntime) {
  const cellSize = Math.min(86, Math.floor(Math.min(680 / runtime.columns, 360 / runtime.rows)));
  return {
    cellSize,
    originX: 480 - (runtime.columns * cellSize) / 2 + cellSize / 2,
    originY: 292 - (runtime.rows * cellSize) / 2 + cellSize / 2
  };
}

function gridCellCenter(runtime: GridLogicRuntime, column: number, row: number) {
  const metrics = gridMetrics(runtime);
  return {
    x: metrics.originX + column * metrics.cellSize,
    y: metrics.originY + row * metrics.cellSize
  };
}

function loadImage(scene: import("phaser").Scene, key: string, url?: string) {
  if (!url || scene.textures.exists(key)) return;
  scene.load.image(key, url);
}

function isPlayablePhase(phase: PlayablePhase | "loading_assets" | "asset_error"): phase is PlayablePhase {
  return phase === "idle" || phase === "playing" || phase === "won" || phase === "lost";
}

function describeTextureLoadError(
  textureKey: string,
  src: string | undefined,
  report: ReturnType<typeof createRuntimeAssetReport>
): string {
  const textureToSlot: Record<string, string> = {
    "generated-background": "background",
    "generated-player": "player",
    "generated-hazard": "hazard",
    "generated-collectible": "collectible"
  };
  const slotName = textureToSlot[textureKey] ?? textureKey;
  const slot = report.slots.find((item) => item.slot === slotName);
  return [
    `slot=${slotName}`,
    `assetKey=${slot?.assetKey ?? textureKey}`,
    `provider=${slot?.provider || "unknown"}`,
    `url=${slot?.fileUrl || src || "missing"}`,
    `status=${slot?.status ?? "missing_texture"}`
  ].join(" | ");
}

function isNear(
  a: { getBounds: () => { x: number; y: number; width: number; height: number } },
  b: { getBounds: () => { x: number; y: number; width: number; height: number } },
  extraRadius: number
): boolean {
  const aBounds = a.getBounds();
  const bBounds = b.getBounds();
  const ax = aBounds.x + aBounds.width / 2;
  const ay = aBounds.y + aBounds.height / 2;
  const bx = bBounds.x + bBounds.width / 2;
  const by = bBounds.y + bBounds.height / 2;
  const aRadius = Math.min(aBounds.width, aBounds.height) * 0.36;
  const bRadius = Math.min(bBounds.width, bBounds.height) * 0.36;
  return Math.hypot(ax - bx, ay - by) <= aRadius + bRadius + extraRadius;
}

function createDemoAudio(runtimeAssets: ReturnType<typeof selectPreviewRuntimeAssets>) {
  let context: AudioContext | undefined;
  let bgmTimer: number | undefined;
  let bgmElement: HTMLAudioElement | undefined;
  const sfxElements = new Map<string, HTMLAudioElement>();

  const ensureContext = () => {
    context ??= new AudioContext();
    void context.resume();
    return context;
  };

  const tone = (frequency: number, duration: number, type: OscillatorType, volume = 0.06) => {
    const audioContext = ensureContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  };

  return {
    startBgm() {
      if (runtimeAssets.bgm) {
        bgmElement ??= createAudioElement(runtimeAssets.bgm, true);
        void bgmElement.play().catch(() => {
          bgmElement = undefined;
        });
        if (bgmElement) return;
      }
      const audioContext = ensureContext();
      if (bgmTimer !== undefined) return;
      const playLoop = () => {
        if (audioContext.state === "closed") return;
        tone(196, 0.18, "sine", 0.025);
        window.setTimeout(() => tone(247, 0.18, "sine", 0.022), 190);
        window.setTimeout(() => tone(294, 0.24, "sine", 0.02), 380);
      };
      playLoop();
      bgmTimer = window.setInterval(playLoop, 1300);
    },
    playCollect() {
      if (playUploadedAudio("collect", runtimeAssets.sfx.collect, sfxElements)) return;
      tone(660, 0.08, "triangle", 0.08);
      window.setTimeout(() => tone(880, 0.1, "triangle", 0.06), 70);
    },
    playHit() {
      if (playUploadedAudio("hit", runtimeAssets.sfx.hit, sfxElements)) return;
      tone(130, 0.14, "sawtooth", 0.09);
    },
    playWin() {
      if (playUploadedAudio("win", runtimeAssets.sfx.win, sfxElements)) return;
      [523, 659, 784, 1046].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.13, "triangle", 0.07), index * 95);
      });
    },
    playLose() {
      if (playUploadedAudio("lose", runtimeAssets.sfx.lose, sfxElements)) return;
      [220, 175, 130].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.16, "sawtooth", 0.055), index * 110);
      });
    },
    stop() {
      if (bgmTimer !== undefined) {
        window.clearInterval(bgmTimer);
        bgmTimer = undefined;
      }
      bgmElement?.pause();
      bgmElement = undefined;
      for (const element of sfxElements.values()) element.pause();
      sfxElements.clear();
      void context?.close();
      context = undefined;
    }
  };
}

function createAudioElement(url: string, loop: boolean): HTMLAudioElement {
  const element = new Audio(url);
  element.loop = loop;
  element.volume = loop ? 0.28 : 0.65;
  return element;
}

function playUploadedAudio(key: string, url: string | undefined, cache: Map<string, HTMLAudioElement>): boolean {
  if (!url) return false;
  const element = cache.get(key) ?? createAudioElement(url, false);
  cache.set(key, element);
  element.currentTime = 0;
  void element.play().catch(() => undefined);
  return true;
}
