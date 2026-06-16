import { useEffect, useId, useRef } from "react";
import type { GameConfig } from "../core/types";

export function PhaserPreview({
  config,
  compact = false
}: {
  config: GameConfig;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const containerId = `phaser-${id}`;
  const gameRef = useRef<import("phaser").Game | null>(null);

  useEffect(() => {
    let disposed = false;

    async function mountGame() {
      const Phaser = await import("phaser");
      if (disposed) return;

      class DemoScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Rectangle;
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
        private score = 0;
        private status!: Phaser.GameObjects.Text;
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
              item.destroy();
              this.score += 1;
              this.status.setText(`Score ${this.score}/${config.level.winScore}`);
              if (this.score >= config.level.winScore) this.status.setText("Win! Press refresh to replay.");
              return false;
            }
            return true;
          });

          for (const hazard of this.hazards) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), hazard.getBounds())) {
              this.status.setText("Hit! Template QA caught lose flow.");
              this.player.setPosition(120, 300);
              this.score = 0;
            }
          }
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
              duration: 1600,
              repeat: -1,
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
              duration: 900 + index * 140,
              yoyo: true,
              repeat: -1,
              ease: Phaser.Math.Easing.Sine.InOut
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
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [compact, config, containerId]);

  return <div className="game-frame" id={containerId} />;
}
