import { useEffect, useId, useRef } from "react";
import type { AssetPack, GameConfig } from "../core/types";
import {
  collectPlayableItem,
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
  compact = false
}: {
  config: GameConfig;
  assetPack?: AssetPack;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const containerId = `phaser-${id}`;
  const gameRef = useRef<import("phaser").Game | null>(null);

  useEffect(() => {
    let disposed = false;
    const audio = createDemoAudio();
    const runtimeAssets = selectPreviewRuntimeAssets(assetPack);

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
        private overlay?: Phaser.GameObjects.Container;
        private worldObjects: Phaser.GameObjects.GameObject[] = [];

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
          const speed = config.templateFamily === "platformer" ? 210 : 250;
          body.setVelocityX(0);

          if (this.cursors?.left.isDown) body.setVelocityX(-speed);
          if (this.cursors?.right.isDown) body.setVelocityX(speed);

          if (config.templateFamily === "platformer") {
            if (this.cursors?.space.isDown && body.blocked.down) body.setVelocityY(-430);
          } else {
            body.setVelocityY(0);
            if (this.cursors?.up.isDown) body.setVelocityY(-speed);
            if (this.cursors?.down.isDown) body.setVelocityY(speed);
          }

          this.collectibles = this.collectibles.filter((item) => {
            if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), item.getBounds())) {
              this.collectItem(item, Phaser);
              return false;
            }
            return true;
          });

          for (const hazard of this.hazards) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), hazard.getBounds())) {
              this.hitHazard(Phaser);
              break;
            }
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
          this.runtimeState = startPlayableRuntime(this.runtimeState);
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

          this.player = this.createRuntimeImage(120, 300, "generated-player", 44, 44, 0x5eead4);
          this.addWorldObject(this.player);
          this.physics.add.existing(this.player);
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          body.setCollideWorldBounds(true);

          if (config.templateFamily === "platformer") {
            body.setGravityY(480);
            const platforms = this.physics.add.staticGroup();
            const floor = this.createRuntimeImage(480, 510, "generated-tile", 920, 28, 0x334155);
            const left = this.createRuntimeImage(360, 390, "generated-tile", 180, 20, 0x334155);
            const right = this.createRuntimeImage(680, 290, "generated-tile", 180, 20, 0x334155);
            platforms.add(floor);
            platforms.add(left);
            platforms.add(right);
            this.addWorldObject(floor);
            this.addWorldObject(left);
            this.addWorldObject(right);
            this.physics.add.collider(this.player, platforms);
          }

          this.createCollectibles(Phaser);
          this.createHazards(Phaser);
        }

        private collectItem(item: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, Phaser: typeof import("phaser")) {
          item.destroy();
          this.worldObjects = this.worldObjects.filter((object) => object !== item);
          this.runtimeState = collectPlayableItem(this.runtimeState, config.level.winScore);
          audio.playCollect();
          this.burst(item.x, item.y, 0xfacc15, Phaser);
          this.updateHud();
          if (this.runtimeState.phase === "won") {
            audio.playWin();
            this.stopPlayer();
            this.status.setText("Victory! All goals complete.");
            this.cameras.main.flash(360, 58, 255, 210);
            this.burst(this.player.x, this.player.y, 0x5eead4, Phaser, 28);
            this.showEndScreen("won");
          }
        }

        private hitHazard(Phaser: typeof import("phaser")) {
          if (this.runtimeState.phase !== "playing") return;
          this.runtimeState = hitPlayableHazard(this.runtimeState);
          audio.playHit();
          audio.playLose();
          this.stopPlayer();
          this.status.setText("Failed! You hit a hazard.");
          this.cameras.main.shake(180, 0.012);
          this.flash.setFillStyle(0xff315a, 0.34);
          this.tweens.add({
            targets: this.flash,
            alpha: 0,
            duration: 260,
            onComplete: () => this.flash.setAlpha(0)
          });
          this.burst(this.player.x, this.player.y, 0xfb7185, Phaser, 18);
          this.showEndScreen("lost");
        }

        private createCollectibles(Phaser: typeof import("phaser")) {
          for (let index = 0; index < config.level.collectibles; index += 1) {
            const x = 230 + index * 95;
            const y = config.templateFamily === "platformer" ? 330 - (index % 3) * 70 : 150 + (index % 3) * 90;
            const star = this.createRuntimeImage(x, y, "generated-collectible", 26, 26, 0xfacc15);
            this.collectibles.push(star);
            this.addWorldObject(star);
            this.tweens.add({
              targets: star,
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
          for (let index = 0; index < config.level.hazards; index += 1) {
            const x = 310 + index * 140;
            const y = config.templateFamily === "platformer" ? 480 : 250 + (index % 2) * 110;
            const hazard = this.createRuntimeImage(x, y, "generated-hazard", 34, 34, 0xfb7185);
            this.hazards.push(hazard);
            this.addWorldObject(hazard);
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
          this.overlay.add(this.add.text(480, 286, "Click or press Enter to start", {
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
          this.overlay.add(this.add.text(480, 164, won ? "You Win!" : "Game Over", {
            color: won ? "#45f6c8" : "#fb7185",
            fontFamily: "Arial",
            fontSize: "34px",
            fontStyle: "bold"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 218, won ? "Goal complete. Share this playable with friends." : "You touched a hazard. Try a cleaner route.", {
            align: "center",
            color: "#e8fbff",
            fixedWidth: 450,
            fontFamily: "Arial",
            fontSize: "15px"
          }).setOrigin(0.5));
          this.overlay.add(this.add.text(480, 286, "Click or press Enter to restart", {
            color: "#071018",
            fontFamily: "Arial",
            fontSize: "17px",
            fontStyle: "bold",
            backgroundColor: won ? "#45f6c8" : "#ffb020",
            padding: { x: 18, y: 10 }
          }).setOrigin(0.5));
        }

        private updateHud() {
          this.scoreText?.setText(`Score ${this.runtimeState.score}/${config.level.winScore} | ${assetPackSummary(assetPack)}`);
        }

        private stopPlayer() {
          const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
          body?.setVelocity(0, 0);
          body?.setEnable(false);
        }

        private clearWorld() {
          this.collectibles = [];
          this.hazards = [];
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
  }, [assetPack, compact, config, containerId]);

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

function assetPackSummary(assetPack?: AssetPack): string {
  if (!assetPack) return "asset-pack: not attached";
  const ready = assetPack.assets.filter((asset) => asset.status !== "missing" && asset.status !== "failed").length;
  return `asset-pack ${assetPack.versionId}: ${ready}/${assetPack.assets.length} ready`;
}

function controlsLabel(config: GameConfig): string {
  const base =
    config.templateFamily === "platformer"
      ? "Controls: Arrow Left/Right to move, Space to jump."
      : "Controls: Arrow keys to move in 8 directions.";
  return `${base} Goal: ${config.playerGoal}`;
}

function loadImage(scene: import("phaser").Scene, key: string, url?: string) {
  if (!url || scene.textures.exists(key)) return;
  scene.load.image(key, url);
}

function createDemoAudio() {
  let context: AudioContext | undefined;
  let bgmTimer: number | undefined;

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
      tone(660, 0.08, "triangle", 0.08);
      window.setTimeout(() => tone(880, 0.1, "triangle", 0.06), 70);
    },
    playHit() {
      tone(130, 0.14, "sawtooth", 0.09);
    },
    playWin() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.13, "triangle", 0.07), index * 95);
      });
    },
    playLose() {
      [220, 175, 130].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.16, "sawtooth", 0.055), index * 110);
      });
    },
    stop() {
      if (bgmTimer !== undefined) {
        window.clearInterval(bgmTimer);
      }
      bgmTimer = undefined;
      void context?.close();
      context = undefined;
    }
  };
}
