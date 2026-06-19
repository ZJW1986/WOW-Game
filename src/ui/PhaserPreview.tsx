import { useEffect, useId, useRef } from "react";
import type { AssetPack, GameConfig, GameHooks } from "../core/types";
import {
  collectPlayableItem,
  createFeedbackRules,
  createPlayableRules,
  createPlayableRuntimeState,
  hitPlayableHazard,
  restartPlayableRuntime,
  startPlayableRuntime,
  type PlayableRuntimeState
} from "./playableRuntime";
import { selectPreviewRuntimeAssets } from "./previewAssets";

export function PhaserPreview({
  config,
  assetPack,
  gameHooks,
  compact = false
}: {
  config: GameConfig;
  assetPack?: AssetPack;
  gameHooks?: GameHooks;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const containerId = `phaser-${id}`;
  const gameRef = useRef<import("phaser").Game | null>(null);

  useEffect(() => {
    let disposed = false;
    const runtimeAssets = selectPreviewRuntimeAssets(assetPack);
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
      const Phaser = await import("phaser");
      if (disposed) return;

      class DemoScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
        private runtimeState: PlayableRuntimeState = createPlayableRuntimeState();
        private status!: Phaser.GameObjects.Text;
        private scoreText!: Phaser.GameObjects.Text;
        private flash!: Phaser.GameObjects.Rectangle;
        private collectibles: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
        private hazards: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
        private finishGate?: Phaser.GameObjects.Rectangle;
        private overlay?: Phaser.GameObjects.Container;
        private worldObjects: Phaser.GameObjects.GameObject[] = [];
        private lastHitAt = 0;

        constructor() {
          super("DemoScene");
        }

        preload() {
          loadImage(this, "generated-player", runtimeAssets.player);
          loadImage(this, "generated-collectible", runtimeAssets.collectible);
          loadImage(this, "generated-hazard", runtimeAssets.hazard);
          loadImage(this, "generated-background", runtimeAssets.background);
          loadImage(this, "generated-tile", runtimeAssets.tile);
        }

        create() {
          this.cameras.main.setBackgroundColor("#15202b");
          this.flash = this.add.rectangle(0, 0, 960, 540, 0xffffff, 0).setOrigin(0).setDepth(20);
          this.cursors = this.input.keyboard?.createCursorKeys();
          this.input.keyboard?.on("keydown-ENTER", () => this.handlePrimaryAction(Phaser));
          this.input.keyboard?.on("keydown-SPACE", () => {
            if (this.runtimeState.phase !== "playing") {
              this.handlePrimaryAction(Phaser);
            }
          });
          this.input.on("pointerdown", () => this.handlePrimaryAction(Phaser));
          this.showStartScreen();
        }

        update() {
          if (this.runtimeState.phase !== "playing" || !this.player?.body) return;
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          const speed = gameHooks?.numberTuning.playerSpeed ?? (config.templateFamily === "platformer" ? 210 : 250);
          body.setVelocityX(0);

          if (this.cursors?.left.isDown) body.setVelocityX(-speed);
          if (this.cursors?.right.isDown) body.setVelocityX(speed);

          if (config.templateFamily === "platformer") {
            if (this.cursors?.space.isDown && body.blocked.down) {
              body.setVelocityY(-(gameHooks?.numberTuning.jumpVelocity || 430));
            }
          } else {
            body.setVelocityY(0);
            if (this.cursors?.up.isDown) body.setVelocityY(-speed);
            if (this.cursors?.down.isDown) body.setVelocityY(speed);
          }

          this.collectibles = this.collectibles.filter((item) => {
            if (isNear(this.player, item, feedbackRules.collisionRadius)) {
              this.collectItem(item, Phaser);
              return false;
            }
            return true;
          });

          for (const hazard of this.hazards) {
            this.updateHazardBehavior(hazard);
            if (isNear(this.player, hazard, feedbackRules.collisionRadius)) {
              this.hitHazard(Phaser);
              break;
            }
          }
          if (this.finishGate && isNear(this.player, this.finishGate, 42)) {
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
          this.overlay?.destroy(true);
          this.overlay = undefined;
          this.clearWorld();
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
              ? this.add.image(480, 270, "generated-background").setDisplaySize(960, 540).setAlpha(0.45)
              : this.add.rectangle(0, 0, 960, 540, 0x17212f).setOrigin(0)
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

          const spawn = gameHooks?.levelFlow?.spawnPoint ?? { x: 120, y: 300 };
          this.player = this.createRuntimeImage(spawn.x, spawn.y, "generated-player", 44, 44, 0x5eead4);
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
              const tile = this.createRuntimeImage(platform.x, platform.y, "generated-tile", platform.width, platform.height, 0x334155);
              platforms.add(tile);
              this.addWorldObject(tile);
            }
            this.physics.add.collider(this.player, platforms);
            this.createFinishGate();
          }

          this.createCollectibles(Phaser);
          this.createHazards(Phaser);
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
          if (!finish) return;
          this.finishGate = this.add
            .rectangle(finish.x, finish.y, finish.width, finish.height, 0x45f6c8, 0.18)
            .setStrokeStyle(2, 0x45f6c8);
          this.addWorldObject(this.finishGate);
          this.addWorldObject(this.add.text(finish.x, finish.y - finish.height / 2 - 18, "GOAL", {
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

        private hitHazard(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing") return;
          const now = this.time.now;
          if (now - this.lastHitAt < feedbackRules.invulnerabilityMs) return;
          this.lastHitAt = now;
          this.runtimeState = hitPlayableHazard(this.runtimeState);
          audio.playHit();
          this.applyKnockback();
          if (this.runtimeState.phase === "playing") {
            this.status.setText(`受伤！剩余生命 ${this.runtimeState.lives}`);
            this.burst(this.player.x, this.player.y, 0xffb020, Phaser, feedbackRules.particleCount);
            this.updateHud();
            return;
          }
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

        private createCollectibles(Phaser: typeof import("phaser")) {
          const placement = gameHooks?.collectibleRules.placement ?? (config.templateFamily === "platformer" ? "arc" : "line");
          const count = Math.max(1, config.level.collectibles);
          for (let index = 0; index < count; index += 1) {
            const x = placement === "grid" ? 230 + (index % 4) * 110 : 230 + index * 95;
            const y =
              placement === "grid"
                ? 150 + Math.floor(index / 4) * 90
                : placement === "arc" || config.templateFamily === "platformer"
                  ? 330 - (index % 3) * 70
                  : 150 + (index % 3) * 90;
            const item = this.createRuntimeImage(x, y, "generated-collectible", 26, 26, 0xfacc15);
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
          const hookMovement = gameHooks?.enemyRules.movement;
          const hookLanes = expandHookLanes(gameHooks, config.level.hazards);
          for (let index = 0; index < config.level.hazards; index += 1) {
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
            const hazard = this.createRuntimeImage(x, y, "generated-hazard", 34, 34, 0xfb7185);
            this.hazards.push(hazard);
            this.addWorldObject(hazard);
            const movement = hookMovement ?? (config.gameplay.enemyBehavior === "timer" ? "static" : config.gameplay.enemyBehavior);
            if (movement === "patrol") {
              this.tweens.add({
                targets: hazard,
                x: x + (index % 2 === 0 ? 58 : -58),
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

        private updateHazardBehavior(hazard: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle) {
          const movement = gameHooks?.enemyRules.movement ?? config.gameplay.enemyBehavior;
          if (movement !== "chase" || !this.player) return;
          const dx = this.player.x - hazard.x;
          const dy = this.player.y - hazard.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const speed = (gameHooks?.enemyRules.speed ?? gameHooks?.numberTuning.hazardSpeed ?? 130) / 120;
          hazard.x += (dx / distance) * speed;
          hazard.y += (dy / distance) * speed;
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
          fallbackColor: number
        ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
          if (this.textures.exists(textureKey)) {
            return this.add.image(x, y, textureKey).setDisplaySize(width, height);
          }
          return this.add.rectangle(x, y, width, height, fallbackColor);
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
      className="game-frame"
      id={containerId}
      tabIndex={0}
      aria-label={`${config.title} playable game`}
      onPointerDown={(event) => event.currentTarget.focus()}
    />
  );
}

function expandHookLanes(gameHooks: GameHooks | undefined, fallbackCount: number) {
  const lanes = gameHooks?.levelLayout.lanes ?? [];
  return lanes.flatMap((lane) => Array.from({ length: Math.max(1, Math.round(lane.count || 1)) }, () => lane)).slice(0, Math.max(1, fallbackCount));
}

function assetPackSummary(assetPack?: AssetPack): string {
  if (!assetPack) return "asset-pack：未绑定";
  const ready = assetPack.assets.filter((asset) => asset.status !== "missing" && asset.status !== "failed").length;
  return `asset-pack ${assetPack.versionId}：${ready}/${assetPack.assets.length} 已就绪`;
}

function controlsLabel(config: GameConfig): string {
  const base =
    config.templateFamily === "platformer"
      ? "控制：方向键左右移动，空格跳跃。"
      : "控制：方向键八方向移动。";
  return `${base} 目标：${config.playerGoal}`;
}

function loadImage(scene: import("phaser").Scene, key: string, url?: string) {
  if (!url || scene.textures.exists(key)) return;
  scene.load.image(key, url);
}

function isNear(
  a: { getBounds: () => { x: number; y: number; width: number; height: number } },
  b: { getBounds: () => { x: number; y: number; width: number; height: number } },
  extraRadius: number
): boolean {
  const aBounds = a.getBounds();
  const bBounds = b.getBounds();
  return !(
    aBounds.x + aBounds.width + extraRadius < bBounds.x ||
    bBounds.x + bBounds.width < aBounds.x - extraRadius ||
    aBounds.y + aBounds.height + extraRadius < bBounds.y ||
    bBounds.y + bBounds.height < aBounds.y - extraRadius
  );
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
