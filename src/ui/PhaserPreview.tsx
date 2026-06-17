import { useEffect, useId, useRef } from "react";
import type { AssetPack, GameConfig } from "../core/types";

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

    async function mountGame() {
      const Phaser = await import("phaser");
      if (disposed) return;

      class DemoScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Rectangle;
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
        private score = 0;
        private hasWon = false;
        private status!: Phaser.GameObjects.Text;
        private flash!: Phaser.GameObjects.Rectangle;
        private collectibles: Phaser.GameObjects.Rectangle[] = [];
        private hazards: Phaser.GameObjects.Rectangle[] = [];

        constructor() {
          super("DemoScene");
        }

        create() {
          this.cameras.main.setBackgroundColor("#15202b");
          this.add.rectangle(0, 0, 960, 540, 0x17212f).setOrigin(0);
          this.add.text(24, 20, config.title, {
            color: "#f6f8fb",
            fontFamily: "Arial",
            fontSize: "24px"
          });
          this.status = this.add.text(24, 54, "Collect all stars. Avoid red hazards.", {
            color: "#b9c4d4",
            fontFamily: "Arial",
            fontSize: "14px"
          });
          this.add.text(24, 76, assetPackSummary(assetPack), {
            color: "#89f7c6",
            fontFamily: "Arial",
            fontSize: "12px"
          });
          this.add.text(24, 98, "Built-in demo audio/effects: BGM, collect, hit, win, lose.", {
            color: "#facc15",
            fontFamily: "Arial",
            fontSize: "12px"
          });

          this.flash = this.add.rectangle(0, 0, 960, 540, 0xffffff, 0).setOrigin(0).setDepth(20);
          this.player = this.add.rectangle(120, 300, 34, 34, 0x5eead4);
          this.physics.add.existing(this.player);
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          body.setCollideWorldBounds(true);

          if (config.templateFamily === "platformer") {
            body.setGravityY(480);
            const platforms = this.physics.add.staticGroup();
            platforms.add(this.add.rectangle(480, 510, 920, 28, 0x334155));
            platforms.add(this.add.rectangle(360, 390, 180, 20, 0x334155));
            platforms.add(this.add.rectangle(680, 290, 180, 20, 0x334155));
            this.physics.add.collider(this.player, platforms);
          }

          this.cursors = this.input.keyboard?.createCursorKeys();
          this.input.once("pointerdown", () => audio.startBgm());
          this.input.keyboard?.once("keydown", () => audio.startBgm());
          this.createCollectibles(Phaser);
          this.createHazards(Phaser);
        }

        update() {
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

        private collectItem(item: Phaser.GameObjects.Rectangle, Phaser: typeof import("phaser")) {
          item.destroy();
          this.score += 1;
          audio.playCollect();
          this.burst(item.x, item.y, 0xfacc15, Phaser);
          this.status.setText(`Score ${this.score}/${config.level.winScore}`);
          if (this.score >= config.level.winScore && !this.hasWon) {
            this.hasWon = true;
            audio.playWin();
            this.status.setText("Win! Built-in sfx.win + effect.win triggered.");
            this.cameras.main.flash(360, 58, 255, 210);
            this.burst(this.player.x, this.player.y, 0x5eead4, Phaser, 28);
          }
        }

        private hitHazard(Phaser: typeof import("phaser")) {
          if (this.hasWon) return;
          audio.playHit();
          audio.playLose();
          this.status.setText("Hit! Built-in sfx.hit + effect.hit triggered.");
          this.cameras.main.shake(180, 0.012);
          this.flash.setFillStyle(0xff315a, 0.34);
          this.tweens.add({
            targets: this.flash,
            alpha: 0,
            duration: 260,
            onComplete: () => this.flash.setAlpha(0)
          });
          this.burst(this.player.x, this.player.y, 0xfb7185, Phaser, 18);
          this.player.setPosition(120, 300);
          this.score = 0;
        }

        private createCollectibles(Phaser: typeof import("phaser")) {
          for (let index = 0; index < config.level.collectibles; index += 1) {
            const x = 230 + index * 95;
            const y = config.templateFamily === "platformer" ? 330 - (index % 3) * 70 : 150 + (index % 3) * 90;
            const star = this.add.rectangle(x, y, 20, 20, 0xfacc15);
            this.collectibles.push(star);
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
            const hazard = this.add.rectangle(x, y, 30, 30, 0xfb7185);
            this.hazards.push(hazard);
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

  return <div className="game-frame" id={containerId} />;
}

function assetPackSummary(assetPack?: AssetPack): string {
  if (!assetPack) return "asset-pack: not attached";
  const ready = assetPack.assets.filter((asset) => asset.status !== "missing" && asset.status !== "failed").length;
  return `asset-pack ${assetPack.versionId}: ${ready}/${assetPack.assets.length} ready`;
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
