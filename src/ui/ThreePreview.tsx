import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ThreeAssetLoadReport, ThreeAssetPack, ThreeSceneDirector, ViewportMode } from "../core/types";
import { createThreeDslRuntime } from "../runtime/three/ThreeDslRuntime";
import { createThreePhysicsWorld } from "../runtime/three/Physics";
import { createThreeGenreRuntime } from "../runtime/three/genres";

type RuntimePhase = "ready" | "playing" | "won" | "lost";
type RuntimeStatus = "loading" | "procedural" | "ready" | "asset_error";

export function ThreePreview({
  director,
  assetPack,
  assetLoadReport,
  viewportMode = "app_9_16"
}: {
  director: ThreeSceneDirector;
  assetPack?: ThreeAssetPack;
  assetLoadReport?: ThreeAssetLoadReport;
  viewportMode?: ViewportMode;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    score: 0,
    lives: 3,
    phase: "ready" as RuntimePhase
  });
  const [hud, setHud] = useState(stateRef.current);
  const [playerMoved, setPlayerMoved] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [assetError, setAssetError] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.innerHTML = "";
    setPlayerMoved(false);
    setRuntimeStatus("loading");
    setAssetError("");
    const modelLoadErrors: string[] = [];
    let disposed = false;
    const keys = new Set<string>();
    const cleanupFns: Array<() => void> = [];

    void import("three").then(async (THREE) => {
      if (disposed || !mount) return;
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const width = mount.clientWidth || 390;
      const height = mount.clientHeight || 844;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(director.world.skyColor);
      const audio = createThreeAudioRuntime();

      const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);
      camera.position.set(0, 7, 13);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute("aria-label", "Three.js game preview");
      mount.appendChild(renderer.domElement);

      const resizeRenderer = () => {
        const nextWidth = Math.max(1, Math.round(mount.clientWidth || 390));
        const nextHeight = Math.max(1, Math.round(mount.clientHeight || 844));
        renderer.setSize(nextWidth, nextHeight, false);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      };
      resizeRenderer();

      const ResizeObserverCtor = window.ResizeObserver;
      if (ResizeObserverCtor) {
        const resizeObserver = new ResizeObserverCtor(resizeRenderer);
        resizeObserver.observe(mount);
        cleanupFns.push(() => resizeObserver.disconnect());
      } else {
        window.addEventListener("resize", resizeRenderer);
        cleanupFns.push(() => window.removeEventListener("resize", resizeRenderer));
      }

      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(3, 8, 5);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0x88aaff, 0.65));

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(director.world.width, director.world.depth),
        new THREE.MeshStandardMaterial({ color: director.world.groundColor, roughness: 0.7 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      if (director.movementMode === "tower_defense" && director.towerDefense) {
        cleanupFns.push(
          runTowerDefenseRuntime({
            THREE,
            scene,
            camera,
            renderer,
            director,
            audio,
            stateRef,
            setHud,
            setPlayerMoved
          })
        );
        setRuntimeStatus((assetLoadReport?.assets ?? []).some((asset) => asset.fallback) ? "procedural" : "ready");
        cleanupFns.push(() => {
          audio.dispose();
          renderer.dispose();
          mount.innerHTML = "";
        });
        return;
      }

      const arcadeRuntime = createThreeGenreRuntime(director);
      const physics = await createThreePhysicsWorld({ gravity: { x: 0, y: 0, z: 0 } });
      const player = await createRuntimeModel(
        THREE,
        loader,
        readAsset("three.model.player"),
        () => createProceduralPlayer(THREE, director),
        { scale: 1.1, assetKey: "three.model.player", errors: modelLoadErrors }
      );
      player.position.set(director.player.start.x, director.player.start.y, director.player.start.z);
      if (director.movementMode === "forward_flight") player.rotation.x = Math.PI / 2;
      scene.add(player);
      const playerBody = physics.addDynamicSphere("player", vectorFromObjectPosition(player), 0.55);

      const collectibles = Array.from({ length: director.objectives.collectTarget }, (_, index) => {
        const item = createProceduralCollectible(THREE, director);
        item.position.copy(collectiblePosition(THREE, director, index));
        scene.add(item);
        return item;
      });
      await replacePrototypeModel(THREE, loader, collectibles, readAsset("three.model.collectible"), {
        scale: 0.55,
        assetKey: "three.model.collectible",
        errors: modelLoadErrors
      });

      const hazardCount = Math.min(14, Math.max(3, director.enemies.reduce((sum, enemy) => sum + enemy.count, 0)));
      const hazards = Array.from({ length: hazardCount }, (_, index) => {
        const hazard = createProceduralHazard(THREE, director);
        hazard.position.copy(hazardPosition(THREE, director, index));
        scene.add(hazard);
        return hazard;
      });
      await replacePrototypeModel(THREE, loader, hazards, readAsset("three.model.hazard"), {
        scale: 0.8,
        assetKey: "three.model.hazard",
        errors: modelLoadErrors
      });
      const hazardBodies = hazards.map((hazard, index) =>
        physics.addStaticBox(`hazard:${index}`, vectorFromObjectPosition(hazard), { x: 0.42, y: 0.42, z: 0.42 })
      );
      const threeDslRuntime = director.gameplayDsl ? createThreeDslRuntime(director.gameplayDsl) : undefined;
      const startedAtMs = performance.now();
      let playerSpeedMultiplier = 1;

      const reportErrors = assetLoadReport?.errors ?? [];
      if (modelLoadErrors.length > 0 || reportErrors.length > 0) {
        setRuntimeStatus("asset_error");
        setAssetError([...reportErrors, ...modelLoadErrors].join(" | "));
      } else if ((assetLoadReport?.assets ?? []).some((asset) => asset.fallback)) {
        setRuntimeStatus("procedural");
      } else {
        setRuntimeStatus("ready");
      }

      const onKeyDown = (event: KeyboardEvent) => {
        keys.add(event.key.toLowerCase());
        if (event.key === "Enter" || event.key === " ") startOrRestart();
      };
      const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      cleanupFns.push(() => window.removeEventListener("keydown", onKeyDown));
      cleanupFns.push(() => window.removeEventListener("keyup", onKeyUp));

      let touchX = 0;
      const onPointerDown = (event: PointerEvent) => {
        touchX = event.clientX;
        renderer.domElement.setPointerCapture(event.pointerId);
        if (stateRef.current.phase !== "playing") startOrRestart();
      };
      const onPointerMove = (event: PointerEvent) => {
        if (stateRef.current.phase !== "playing") return;
        const delta = event.clientX - touchX;
        player.position.x = clamp(player.position.x + delta * 0.015 * arcadeRuntime.pointerXSign, -5.4, 5.4);
        touchX = event.clientX;
        setPlayerMoved(true);
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      cleanupFns.push(() => renderer.domElement.removeEventListener("pointerdown", onPointerDown));
      cleanupFns.push(() => renderer.domElement.removeEventListener("pointermove", onPointerMove));

      function updateHud() {
        setHud({ ...stateRef.current });
      }

      function startOrRestart() {
        stateRef.current = { score: 0, lives: 3, phase: "playing" };
        setPlayerMoved(false);
        player.position.set(director.player.start.x, director.player.start.y, director.player.start.z);
        arcadeRuntime.reset?.({ THREE, player, collectibles, hazards, director });
        hitCooldownMs = 0;
        shakeUntilMs = 0;
        flashUntilMs = 0;
        clearParticles(scene, particles);
        collectibles.forEach((item) => {
          item.visible = true;
        });
        updateHud();
        audio.play("click");
        renderer.domElement.focus();
      }

      let last = performance.now();
      let hitCooldownMs = 0;
      let shakeUntilMs = 0;
      let flashUntilMs = 0;
      const particles: Array<{ mesh: Object3D; velocity: import("three").Vector3; expiresAt: number }> = [];
      function animate(now: number) {
        if (disposed) return;
        const delta = Math.min(0.033, (now - last) / 1000);
        last = now;
        hitCooldownMs = Math.max(0, hitCooldownMs - delta * 1000);
        updateParticles(scene, particles, delta, now);
        if (stateRef.current.phase === "playing") {
          const move = director.player.speed * delta;
          const dslCommands = threeDslRuntime?.tick({
            timeMs: now - startedAtMs,
            score: stateRef.current.score,
            lives: stateRef.current.lives,
            collectCount: stateRef.current.score,
            enemiesAlive: hazards.length,
            stageId: stateRef.current.phase
          }) ?? [];
          for (const command of dslCommands) {
            if (command.type === "change_player_speed") {
              playerSpeedMultiplier = command.multiplier;
            } else if (command.type === "spawn_hazards") {
              for (let spawnIndex = 0; spawnIndex < command.count; spawnIndex += 1) {
                const hazard = createProceduralHazard(THREE, director);
                hazard.position.copy(hazardPosition(THREE, director, hazards.length + spawnIndex));
                scene.add(hazard);
                hazards.push(hazard);
                hazardBodies.push(
                  physics.addStaticBox(`hazard:${hazards.length - 1}`, vectorFromObjectPosition(hazard), {
                    x: 0.42,
                    y: 0.42,
                    z: 0.42
                  })
                );
              }
              audio.play("warning");
            } else if (command.type === "win") {
              stateRef.current.phase = "won";
              audio.play("win");
              updateHud();
            } else if (command.type === "fail") {
              stateRef.current.phase = "lost";
              audio.play("lose");
              updateHud();
            }
          }
          const previousX = player.position.x;
          const previousZ = player.position.z;
          arcadeRuntime.updatePlayer({ player, keys, move: move * playerSpeedMultiplier, delta, director });
          if (previousX !== player.position.x || previousZ !== player.position.z) setPlayerMoved(true);
          player.position.x = clamp(player.position.x, -director.world.width / 2 + 1, director.world.width / 2 - 1);
          player.position.z = clamp(player.position.z, -director.world.depth / 2 + 1, director.world.depth / 2 - 1);
          playerBody.setPosition(vectorFromObjectPosition(player));
          playerBody.setVelocity({ x: 0, y: 0, z: 0 });

          hazards.forEach((hazard, index) => {
            arcadeRuntime.updateHazard({ hazard, index, player, delta, now, director });
            hazardBodies[index]?.setPosition(vectorFromObjectPosition(hazard));
          });
          const collisionEvents = physics.step(delta);
          for (const event of collisionEvents) {
            if (event.type === "collision-start" && hitCooldownMs <= 0 && (event.a === "player" || event.b === "player")) {
              const hazardId = event.a === "player" ? event.b : event.a;
              const hazardIndex = Number(hazardId.split(":")[1]);
              const hazard = hazards[hazardIndex];
              if (!hazard) continue;
              stateRef.current.lives -= director.collisionRules?.damage ?? 1;
              hitCooldownMs = director.collisionRules?.invincibleMs ?? 800;
              if (director.feedbackRules?.hitParticles) {
                spawnParticleBurst(THREE, scene, particles, hazard.position, 0xfb7185, director.feedbackRules.explosion ? 18 : 8);
              }
              if (director.feedbackRules?.screenShake || director.cameraEffects?.shake) shakeUntilMs = now + 320;
              if (director.feedbackRules?.flash) flashUntilMs = now + 520;
              audio.play("hit");
              if (director.feedbackRules?.explosion) audio.play("explosion");
              if ((director.collisionRules?.knockback ?? 0) > 0) {
                player.position.x = clamp(
                  player.position.x + Math.sign(player.position.x - hazard.position.x || 1) * (director.collisionRules?.knockback ?? 1),
                  -director.world.width / 2 + 1,
                  director.world.width / 2 - 1
                );
              }
              arcadeRuntime.resetHazard({ hazard, index: hazardIndex, director });
              hazardBodies[hazardIndex]?.setPosition(vectorFromObjectPosition(hazard));
              if (stateRef.current.lives <= 0) {
                stateRef.current.phase = "lost";
                audio.play("lose");
              }
              updateHud();
            }
          }

          collectibles.forEach((item) => {
            arcadeRuntime.updateCollectible?.({ item, delta, now });
            if (item.visible && distance2D(player.position, item.position) < 0.75) {
              item.visible = false;
              stateRef.current.score += 1;
              if (director.feedbackRules?.collectParticles) {
                spawnParticleBurst(THREE, scene, particles, item.position, 0xfacc15, 12);
              }
              audio.play("collect");
              if (stateRef.current.score >= director.objectives.collectTarget) {
                stateRef.current.phase = "won";
                audio.play("win");
              }
              updateHud();
            }
          });
        }
        setObjectFlash(player, now < flashUntilMs);
        arcadeRuntime.updateCamera(camera, player, director);
        if (now < shakeUntilMs) {
          const intensity = 0.08;
          camera.position.x += (Math.random() - 0.5) * intensity;
          camera.position.y += (Math.random() - 0.5) * intensity;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);

      cleanupFns.push(() => {
        audio.dispose();
        renderer.dispose();
        mount.innerHTML = "";
      });

      function readAsset(assetKey: string) {
        return assetPack?.assets.find((asset) => asset.assetKey === assetKey);
      }
    });

    return () => {
      disposed = true;
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [assetLoadReport, assetPack, director, viewportMode]);

  const isTerminal = hud.phase === "won" || hud.phase === "lost";
  const hasAssetError = runtimeStatus === "asset_error";
  const controlHint = threeControlHint(director);
  return (
    <div
      className={`three-preview-shell ${viewportMode}`}
      data-three-preview={runtimeStatus}
      data-runtime-phase={hud.phase}
      data-player-moved={playerMoved ? "true" : "false"}
    >
      <div className="three-preview-hud">
        <strong>{director.title}</strong>
        <span>目标 {hud.score}/{director.objectives.collectTarget}</span>
        <span>生命 {hud.lives}</span>
        <span>{runtimeStatusLabel(runtimeStatus)}</span>
      </div>
      <div className="three-preview-canvas" ref={mountRef} />
      <div className="three-preview-controls">
        <span>{controlHint}</span>
      </div>
      {hasAssetError ? <div className="three-preview-asset-error">3D 素材加载失败：{assetError}</div> : null}
      {hud.phase !== "playing" ? (
        <button
          className="three-preview-overlay"
          type="button"
          data-testid="three-preview-start"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
          }}
        >
          {isTerminal ? (hud.phase === "won" ? "胜利，点击重开" : "失败，点击重开") : "开始 3D 试玩"}
        </button>
      ) : null}
    </div>
  );
}

function runtimeStatusLabel(status: RuntimeStatus): string {
  if (status === "ready") return "真实模型";
  if (status === "procedural") return "程序化占位";
  if (status === "asset_error") return "资源错误";
  return "加载中";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance2D(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function vectorFromObjectPosition(object: Object3D) {
  return {
    x: object.position.x,
    y: object.position.y,
    z: object.position.z
  };
}

type ThreeAudioCue = "collect" | "hit" | "win" | "lose" | "warning" | "explosion" | "click";

function createThreeAudioRuntime() {
  let context: AudioContext | null = null;
  function ensureContext() {
    if (!context) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      context = AudioContextCtor ? new AudioContextCtor() : null;
    }
    if (context?.state === "suspended") void context.resume();
    return context;
  }
  return {
    play(cue: ThreeAudioCue) {
      const audioContext = ensureContext();
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      const frequencyByCue: Record<ThreeAudioCue, number> = {
        collect: 880,
        hit: 120,
        win: 660,
        lose: 90,
        warning: 240,
        explosion: 70,
        click: 420
      };
      oscillator.frequency.setValueAtTime(frequencyByCue[cue], now);
      oscillator.type = cue === "explosion" || cue === "hit" ? "sawtooth" : "sine";
      gain.gain.setValueAtTime(cue === "explosion" ? 0.08 : 0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (cue === "win" ? 0.32 : 0.16));
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + (cue === "win" ? 0.34 : 0.18));
    },
    dispose() {
      if (context) void context.close();
      context = null;
    }
  };
}

function spawnParticleBurst(
  THREE: typeof import("three"),
  scene: import("three").Scene,
  particles: Array<{ mesh: Object3D; velocity: import("three").Vector3; expiresAt: number }>,
  position: import("three").Vector3,
  color: number,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(position);
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    const speed = 0.8 + (index % 4) * 0.18;
    const velocity = new THREE.Vector3(Math.cos(angle) * speed, 0.8 + (index % 3) * 0.2, Math.sin(angle) * speed);
    scene.add(mesh);
    particles.push({ mesh, velocity, expiresAt: performance.now() + 650 });
  }
}

function updateParticles(
  scene: import("three").Scene,
  particles: Array<{ mesh: Object3D; velocity: import("three").Vector3; expiresAt: number }>,
  delta: number,
  now: number
) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.mesh.position.addScaledVector(particle.velocity, delta);
    particle.velocity.y -= delta * 1.8;
    const material = (particle.mesh as import("three").Mesh).material;
    if (material && !Array.isArray(material) && "opacity" in material) {
      material.opacity = Math.max(0, (particle.expiresAt - now) / 650);
    }
    if (now >= particle.expiresAt) {
      scene.remove(particle.mesh);
      particles.splice(index, 1);
    }
  }
}

function clearParticles(scene: import("three").Scene, particles: Array<{ mesh: Object3D }>) {
  for (const particle of particles) scene.remove(particle.mesh);
  particles.length = 0;
}

function setObjectFlash(object: Object3D, active: boolean) {
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;
    const material = mesh.material;
    if (!material || Array.isArray(material) || !("emissiveIntensity" in material)) return;
    material.emissiveIntensity = active ? 1.6 : 0.4;
  });
}

function threeControlHint(director: ThreeSceneDirector): string {
  if (director.movementMode === "tower_defense") {
    return "塔防：WASD/方向键选择建造点，空格或 Enter 建塔/开始/重开；手机可点击建造点。";
  }
  if (director.movementMode === "forward_flight") {
    return "飞行：WASD/方向键控制飞船，躲避前方障碍并收集能量；空格或 Enter 开始/重开。";
  }
  if (director.movementMode === "auto_runner") {
    return "跑酷：左右键/A/D 换道，上键/W/空格跳跃；收集金币并避开闸门。";
  }
  if (director.movementMode === "free_move") {
    return "第三人称：WASD/方向键自由移动，收集任务物并躲开巡逻敌人。";
  }
  if (director.movementMode === "explore_scan") {
    return "探索：WASD/方向键漫游，靠近地标收集发现点，空格触发扫描反馈。";
  }
  return "键盘 WASD/方向键移动，空格或 Enter 开始/重开；手机可拖动控制。";
}

function createProceduralPlayer(THREE: typeof import("three"), director: ThreeSceneDirector) {
  if (director.movementMode === "auto_runner") {
    return new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.75, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x082f49 })
    );
  }
  if (director.movementMode === "explore_scan") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.45, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xa7f3d0, emissive: 0x064e3b })
    );
  }
  if (director.movementMode === "arena_dodge") {
    return new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x581c87 })
    );
  }
  return new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0f172a })
  );
}

function createProceduralCollectible(THREE: typeof import("three"), director: ThreeSceneDirector) {
  if (director.movementMode === "auto_runner") {
    return new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x854d0e })
    );
  }
  if (director.movementMode === "explore_scan") {
    return new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x155e75 })
    );
  }
  return new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x7c2d12 })
  );
}

function createProceduralHazard(THREE: typeof import("three"), director?: ThreeSceneDirector) {
  if (director?.movementMode === "auto_runner") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.9, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x450a0a })
    );
  }
  if (director?.movementMode === "explore_scan") {
    return new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.08, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x1e3a8a })
    );
  }
  return new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0x450a0a })
  );
}

type TowerDefenseRuntimeOptions = {
  THREE: typeof import("three");
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  renderer: import("three").WebGLRenderer;
  director: ThreeSceneDirector;
  audio: ReturnType<typeof createThreeAudioRuntime>;
  stateRef: React.MutableRefObject<{ score: number; lives: number; phase: RuntimePhase }>;
  setHud: React.Dispatch<React.SetStateAction<{ score: number; lives: number; phase: RuntimePhase }>>;
  setPlayerMoved: React.Dispatch<React.SetStateAction<boolean>>;
};

type TowerDefenseEnemy = {
  mesh: Object3D;
  waveIndex: number;
  type: NonNullable<ThreeSceneDirector["towerDefense"]>["waves"][number]["enemyType"];
  health: number;
  maxHealth: number;
  speed: number;
  reward: number;
  targetNode: number;
  slowUntilMs: number;
};

type TowerDefenseTower = {
  mesh: Object3D;
  kind: NonNullable<ThreeSceneDirector["towerDefense"]>["towers"][number]["kind"];
  range: number;
  fireRateMs: number;
  damage: number;
  effect?: "slow" | "splash";
  cooldownMs: number;
};

type TowerDefenseProjectile = {
  mesh: Object3D;
  target: TowerDefenseEnemy;
  damage: number;
  effect?: "slow" | "splash";
  speed: number;
};

function runTowerDefenseRuntime({
  THREE,
  scene,
  camera,
  renderer,
  director,
  audio,
  stateRef,
  setHud,
  setPlayerMoved
}: TowerDefenseRuntimeOptions) {
  const towerDefenseConfig = director.towerDefense;
  if (!towerDefenseConfig) return () => undefined;
  const towerDefense: NonNullable<ThreeSceneDirector["towerDefense"]> = towerDefenseConfig;

  const pathNodes = towerDefense.pathNodes.map((node) => new THREE.Vector3(node.x, 0.08, node.z));
  const particles: Array<{ mesh: Object3D; velocity: import("three").Vector3; expiresAt: number }> = [];
  const enemies: TowerDefenseEnemy[] = [];
  const towers: TowerDefenseTower[] = [];
  const projectiles: TowerDefenseProjectile[] = [];
  const buildPads: Object3D[] = [];
  const cleanupFns: Array<() => void> = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  createTowerDefensePath(THREE, scene, pathNodes);
  const baseCore = createTowerDefenseBaseCore(THREE);
  const baseNode = pathNodes[pathNodes.length - 1] ?? new THREE.Vector3(0, 0, 0);
  baseCore.position.set(baseNode.x, 0.65, baseNode.z);
  scene.add(baseCore);

  const towerRules = towerDefense.towers;
  const defaultTower = towerRules[0] ?? { id: "laser", kind: "laser" as const, cost: 20, range: 4, fireRateMs: 420, damage: 1 };
  const maxTowers = towerDefense.buildRules.maxTowers;
  let energy = towerDefense.economyRules.startingEnergy;
  let activeWave = 0;
  let spawnedInWave = 0;
  let nextSpawnAt = 0;
  let lastTime = performance.now();
  let startedAt = 0;
  let animationId = 0;
  let selectedBuildPadIndex = 0;

  const padPositions = createTowerDefenseBuildPadPositions(THREE, pathNodes).slice(0, maxTowers);
  for (const position of padPositions) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0x164e63, emissive: 0x083344, roughness: 0.45 })
    );
    pad.position.copy(position);
    pad.position.y = 0.1;
    scene.add(pad);
    buildPads.push(pad);
  }
  selectBuildPad(0);

  function updateHud() {
    setHud({ ...stateRef.current });
  }

  function resetRuntime() {
    for (const enemy of enemies) scene.remove(enemy.mesh);
    for (const tower of towers) scene.remove(tower.mesh);
    for (const projectile of projectiles) scene.remove(projectile.mesh);
    clearParticles(scene, particles);
    enemies.length = 0;
    towers.length = 0;
    projectiles.length = 0;
    energy = towerDefense.economyRules.startingEnergy;
    activeWave = 0;
    spawnedInWave = 0;
    nextSpawnAt = 0;
    startedAt = performance.now();
    stateRef.current = { score: 0, lives: towerDefense.baseRules.baseHealth, phase: "playing" };
    buildStartingTower();
    updateHud();
    setPlayerMoved(true);
  }

  function buildStartingTower() {
    const firstPad = buildPads[0];
    if (!firstPad) return;
    const tower = createTowerDefenseTower(THREE, defaultTower);
    tower.mesh.position.set(firstPad.position.x, 0.45, firstPad.position.z);
    scene.add(tower.mesh);
    towers.push(tower);
    firstPad.visible = false;
  }

  function buildTowerAtPad(pad: Object3D) {
    if (stateRef.current.phase !== "playing") resetRuntime();
    if (!pad.visible || towers.length >= maxTowers || energy < defaultTower.cost) return;
    energy -= defaultTower.cost;
    const tower = createTowerDefenseTower(THREE, defaultTower);
    tower.mesh.position.set(pad.position.x, 0.45, pad.position.z);
    scene.add(tower.mesh);
    towers.push(tower);
    pad.visible = false;
    spawnParticleBurst(THREE, scene, particles, tower.mesh.position, 0x38bdf8, 10);
    audio.play("click");
    selectBuildPad(selectedBuildPadIndex + 1);
    updateHud();
  }

  function selectBuildPad(nextIndex: number) {
    const visiblePads = buildPads.filter((pad) => pad.visible);
    if (visiblePads.length === 0) return;
    selectedBuildPadIndex = ((nextIndex % visiblePads.length) + visiblePads.length) % visiblePads.length;
    visiblePads.forEach((pad, index) => {
      const mesh = pad as import("three").Mesh;
      const material = mesh.material;
      if (!material || Array.isArray(material) || !("emissiveIntensity" in material)) return;
      material.emissiveIntensity = index === selectedBuildPadIndex ? 1.2 : 0.35;
    });
  }

  function buildSelectedTower() {
    const visiblePads = buildPads.filter((pad) => pad.visible);
    if (visiblePads.length === 0) {
      if (stateRef.current.phase !== "playing") resetRuntime();
      return;
    }
    buildTowerAtPad(visiblePads[selectedBuildPadIndex] ?? visiblePads[0]);
  }

  function spawnEnemy(waveIndex: number) {
    const wave = towerDefense.waves[waveIndex];
    if (!wave) return;
    const enemy = createTowerDefenseEnemy(THREE, wave.enemyType);
    const start = pathNodes[0] ?? new THREE.Vector3();
    enemy.mesh.position.set(start.x, 0.42, start.z);
    scene.add(enemy.mesh);
    enemies.push({
      mesh: enemy.mesh,
      waveIndex,
      type: wave.enemyType,
      health: wave.health,
      maxHealth: wave.health,
      speed: wave.speed,
      reward: wave.reward,
      targetNode: 1,
      slowUntilMs: 0
    });
  }

  function updateWaves(now: number) {
    if (activeWave >= towerDefense.waves.length) return;
    const wave = towerDefense.waves[activeWave];
    if (!wave) return;
    const elapsed = now - startedAt;
    if (elapsed < wave.startsAtMs) return;
    if (spawnedInWave < wave.count && now >= nextSpawnAt) {
      spawnEnemy(activeWave);
      spawnedInWave += 1;
      nextSpawnAt = now + wave.intervalMs;
      if (spawnedInWave === 1) audio.play("warning");
    }
    if (spawnedInWave >= wave.count && enemies.every((enemy) => enemy.waveIndex !== activeWave)) {
      activeWave += 1;
      spawnedInWave = 0;
      nextSpawnAt = now + 900;
    }
  }

  function updateEnemies(delta: number, now: number) {
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      const enemy = enemies[index];
      const target = pathNodes[enemy.targetNode];
      if (!target) {
        stateRef.current.lives = Math.max(0, stateRef.current.lives - towerDefense.baseRules.leakDamage);
        scene.remove(enemy.mesh);
        enemies.splice(index, 1);
        spawnParticleBurst(THREE, scene, particles, baseCore.position, 0xfb7185, 12);
        audio.play("hit");
        if (stateRef.current.lives <= 0) {
          stateRef.current.phase = "lost";
          audio.play("lose");
        }
        updateHud();
        continue;
      }
      const speed = enemy.speed * (now < enemy.slowUntilMs ? 0.48 : 1);
      const toTarget = target.clone().sub(enemy.mesh.position);
      const distance = Math.max(0.001, toTarget.length());
      const step = speed * delta;
      if (distance <= step) {
        enemy.mesh.position.copy(target);
        enemy.targetNode += 1;
      } else {
        enemy.mesh.position.addScaledVector(toTarget.normalize(), step);
      }
      enemy.mesh.rotation.y += delta * (enemy.type === "runner" ? 3.2 : 1.6);
    }
  }

  function updateTowers(delta: number) {
    for (const tower of towers) {
      tower.cooldownMs = Math.max(0, tower.cooldownMs - delta * 1000);
      const target = enemies
        .filter((enemy) => distance2D(tower.mesh.position, enemy.mesh.position) <= tower.range)
        .sort((left, right) => right.targetNode - left.targetNode)[0];
      if (!target) continue;
      tower.mesh.lookAt(target.mesh.position.x, tower.mesh.position.y, target.mesh.position.z);
      if (tower.cooldownMs > 0) continue;
      tower.cooldownMs = tower.fireRateMs;
      const projectile = new THREE.Mesh(
        new THREE.SphereGeometry(tower.kind === "missile" ? 0.13 : 0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: tower.kind === "slow" ? 0x67e8f9 : tower.kind === "missile" ? 0xf97316 : 0x22d3ee })
      );
      projectile.position.copy(tower.mesh.position);
      projectile.position.y += 0.48;
      scene.add(projectile);
      projectiles.push({
        mesh: projectile,
        target,
        damage: tower.damage,
        effect: tower.effect,
        speed: tower.kind === "missile" ? 7 : 10
      });
      audio.play(tower.kind === "missile" ? "explosion" : "click");
    }
  }

  function updateProjectiles(delta: number, now: number) {
    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = projectiles[index];
      if (!enemies.includes(projectile.target)) {
        scene.remove(projectile.mesh);
        projectiles.splice(index, 1);
        continue;
      }
      const targetPosition = projectile.target.mesh.position.clone();
      targetPosition.y += 0.18;
      const toTarget = targetPosition.sub(projectile.mesh.position);
      const distance = Math.max(0.001, toTarget.length());
      const step = projectile.speed * delta;
      if (distance <= step) {
        projectile.target.health -= projectile.damage;
        if (projectile.effect === "slow") projectile.target.slowUntilMs = now + 1200;
        spawnParticleBurst(THREE, scene, particles, projectile.target.mesh.position, projectile.effect === "slow" ? 0x67e8f9 : 0xf97316, 8);
        audio.play("hit");
        if (projectile.target.health <= 0) {
          energy += projectile.target.reward + towerDefense.economyRules.killReward;
          stateRef.current.score += 1;
          scene.remove(projectile.target.mesh);
          enemies.splice(enemies.indexOf(projectile.target), 1);
          audio.play("collect");
          updateHud();
        }
        scene.remove(projectile.mesh);
        projectiles.splice(index, 1);
      } else {
        projectile.mesh.position.addScaledVector(toTarget.normalize(), step);
      }
    }
  }

  function checkWin() {
    if (
      stateRef.current.phase === "playing" &&
      activeWave >= towerDefense.waves.length &&
      enemies.length === 0 &&
      projectiles.length === 0
    ) {
      stateRef.current.phase = "won";
      spawnParticleBurst(THREE, scene, particles, baseCore.position, 0x22c55e, 24);
      audio.play("win");
      updateHud();
    }
  }

  function animate(now: number) {
    const delta = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    updateParticles(scene, particles, delta, now);
    baseCore.rotation.y += delta * 0.45;
    if (stateRef.current.phase === "playing") {
      updateWaves(now);
      updateEnemies(delta, now);
      updateTowers(delta);
      updateProjectiles(delta, now);
      checkWin();
    }
    camera.position.set(0, 14, 13);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a" || key === "arrowup" || key === "w") {
      event.preventDefault();
      selectBuildPad(selectedBuildPadIndex - 1);
      renderer.domElement.focus();
      return;
    }
    if (key === "arrowright" || key === "d" || key === "arrowdown" || key === "s") {
      event.preventDefault();
      selectBuildPad(selectedBuildPadIndex + 1);
      renderer.domElement.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      buildSelectedTower();
      renderer.domElement.focus();
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(buildPads.filter((pad) => pad.visible), false)[0];
    if (hit) buildTowerAtPad(hit.object);
    else if (stateRef.current.phase !== "playing") resetRuntime();
  };

  window.addEventListener("keydown", onKeyDown);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  cleanupFns.push(() => window.removeEventListener("keydown", onKeyDown));
  cleanupFns.push(() => renderer.domElement.removeEventListener("pointerdown", onPointerDown));

  stateRef.current = { score: 0, lives: towerDefense.baseRules.baseHealth, phase: "ready" };
  updateHud();
  animationId = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(animationId);
    cleanupFns.forEach((cleanup) => cleanup());
  };
}

function createTowerDefensePath(
  THREE: typeof import("three"),
  scene: import("three").Scene,
  pathNodes: import("three").Vector3[]
) {
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0e7490, roughness: 0.35 });
  const railMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  for (let index = 0; index < pathNodes.length - 1; index += 1) {
    const start = pathNodes[index];
    const end = pathNodes[index + 1];
    const middle = start.clone().add(end).multiplyScalar(0.5);
    const length = start.distanceTo(end);
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, length), pathMaterial);
    tile.position.set(middle.x, 0.05, middle.z);
    tile.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
    scene.add(tile);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.035, length), railMaterial);
    rail.position.set(middle.x, 0.12, middle.z);
    rail.rotation.y = tile.rotation.y;
    scene.add(rail);
  }
}

function createTowerDefenseBuildPadPositions(THREE: typeof import("three"), pathNodes: import("three").Vector3[]) {
  const positions: import("three").Vector3[] = [];
  for (let index = 0; index < pathNodes.length - 1; index += 1) {
    const start = pathNodes[index];
    const end = pathNodes[index + 1];
    const middle = start.clone().add(end).multiplyScalar(0.5);
    const segment = end.clone().sub(start).normalize();
    const normal = new THREE.Vector3(-segment.z, 0, segment.x);
    positions.push(middle.clone().addScaledVector(normal, 2.1));
    positions.push(middle.clone().addScaledVector(normal, -2.1));
  }
  return positions;
}

function createTowerDefenseBaseCore(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 1),
    new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, metalness: 0.35 })
  );
  const shield = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.045, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
  );
  shield.rotation.x = Math.PI / 2;
  group.add(core, shield);
  return group;
}

function createTowerDefenseTower(
  THREE: typeof import("three"),
  rule: NonNullable<ThreeSceneDirector["towerDefense"]>["towers"][number]
): TowerDefenseTower {
  const group = new THREE.Group();
  const color = rule.kind === "missile" ? 0xf97316 : rule.kind === "slow" ? 0x67e8f9 : 0x22d3ee;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x020617, metalness: 0.35 })
  );
  const head = new THREE.Mesh(
    rule.kind === "missile" ? new THREE.BoxGeometry(0.44, 0.32, 0.7) : new THREE.CylinderGeometry(0.16, 0.2, 0.82, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
  );
  head.position.y = 0.42;
  head.rotation.x = Math.PI / 2;
  group.add(base, head);
  return {
    mesh: group,
    kind: rule.kind,
    range: rule.range,
    fireRateMs: rule.fireRateMs,
    damage: rule.damage,
    effect: rule.effect,
    cooldownMs: 0
  };
}

function createTowerDefenseEnemy(
  THREE: typeof import("three"),
  type: NonNullable<ThreeSceneDirector["towerDefense"]>["waves"][number]["enemyType"]
) {
  const color = type === "armored" ? 0x94a3b8 : type === "runner" ? 0xfacc15 : 0xfb7185;
  const geometry =
    type === "armored"
      ? new THREE.BoxGeometry(0.62, 0.42, 0.82)
      : type === "runner"
        ? new THREE.ConeGeometry(0.35, 0.78, 6)
        : new THREE.OctahedronGeometry(0.42, 0);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, emissive: type === "runner" ? 0x854d0e : 0x450a0a, roughness: 0.42 })
  );
  return { mesh };
}

function collectiblePosition(THREE: typeof import("three"), director: ThreeSceneDirector, index: number) {
  if (director.layoutMode === "lane_track") {
    const lanes = [-2.4, 0, 2.4];
    return new THREE.Vector3(lanes[index % lanes.length], 0.45, -5 + index * 3.2);
  }
  if (director.layoutMode === "open_landmarks") {
    const angle = (index / Math.max(1, director.objectives.collectTarget)) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 6, 0.45, Math.sin(angle) * 6);
  }
  if (director.layoutMode === "small_arena" || director.layoutMode === "single_arena") {
    return new THREE.Vector3(((index % 3) - 1) * 3.2, 0.45, 4 - Math.floor(index / 3) * 3);
  }
  return new THREE.Vector3(((index % 4) - 1.5) * 2.3, 0.45, 8 - Math.floor(index / 4) * 5);
}

function hazardPosition(THREE: typeof import("three"), director: ThreeSceneDirector, index: number) {
  if (director.layoutMode === "lane_track") {
    const lanes = [-2.4, 0, 2.4];
    return new THREE.Vector3(lanes[index % lanes.length], 0.6, 2 + index * 3.4);
  }
  if (director.layoutMode === "open_landmarks") {
    const angle = (index / 4) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 4.2, 0.6, Math.sin(angle) * 4.2);
  }
  if (director.layoutMode === "small_arena" || director.layoutMode === "single_arena") {
    return new THREE.Vector3(((index % 4) - 1.5) * 3, 0.6, -5 + Math.floor(index / 4) * 3.5);
  }
  return new THREE.Vector3(((index % 4) - 1.5) * 2.6, 0.6, -director.world.depth / 2 + index * 3);
}

function updateCamera(camera: import("three").PerspectiveCamera, player: Object3D, director: ThreeSceneDirector) {
  if (director.camera === "orbit_showcase") {
    camera.position.x += (player.position.x * 0.25 + 7 - camera.position.x) * 0.04;
    camera.position.y += (8 - camera.position.y) * 0.04;
    camera.position.z += (player.position.z + 10 - camera.position.z) * 0.04;
    camera.lookAt(player.position.x * 0.25, 0, player.position.z);
    return;
  }
  if (director.movementMode === "auto_runner") {
    camera.position.x += (player.position.x * 0.35 - camera.position.x) * 0.06;
    camera.position.y += (5.5 - camera.position.y) * 0.04;
    camera.position.z += (player.position.z - 9 - camera.position.z) * 0.06;
    camera.lookAt(player.position.x * 0.25, 0, player.position.z + 5);
    return;
  }
  camera.position.x += (player.position.x * 0.28 - camera.position.x) * 0.05;
  camera.lookAt(player.position.x * 0.25, 0, player.position.z - 3);
}

async function createRuntimeModel(
  THREE: typeof import("three"),
  loader: GLTFLoader,
  asset: { assetKey: string; fileUrl: string } | undefined,
  fallbackFactory: () => Object3D,
  options: { assetKey: string; scale: number; errors: string[] }
) {
  if (!asset || !isLoadableThreeModel(asset.fileUrl)) return fallbackFactory();
  try {
    const gltf = await loader.loadAsync(asset.fileUrl);
    const root = gltf.scene || fallbackFactory();
    normalizeLoadedModel(THREE, root, options.scale);
    return root;
  } catch (error) {
    options.errors.push(`${options.assetKey}: ${error instanceof Error ? error.message : String(error)}`);
    return fallbackFactory();
  }
}

async function replacePrototypeModel(
  THREE: typeof import("three"),
  loader: GLTFLoader,
  targets: Object3D[],
  asset: { assetKey: string; fileUrl: string } | undefined,
  options: { assetKey: string; scale: number; errors: string[] }
) {
  if (!asset || !isLoadableThreeModel(asset.fileUrl)) return;
  try {
    const gltf = await loader.loadAsync(asset.fileUrl);
    for (const target of [...targets]) {
      const parent = target.parent;
      if (!parent) continue;
      const replacement = gltf.scene.clone(true);
      normalizeLoadedModel(THREE, replacement, options.scale);
      replacement.position.copy(target.position);
      replacement.rotation.copy(target.rotation);
      replacement.visible = target.visible;
      parent.remove(target);
      parent.add(replacement);
      const index = targets.indexOf(target);
      if (index >= 0) targets[index] = replacement;
    }
  } catch (error) {
    options.errors.push(`${options.assetKey}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeLoadedModel(THREE: typeof import("three"), object: Object3D, targetSize: number) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
  object.scale.multiplyScalar(targetSize / maxAxis);
  const nextBox = new THREE.Box3().setFromObject(object);
  const center = nextBox.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

function isLoadableThreeModel(fileUrl: string): boolean {
  return /\.(glb|gltf)(?:$|\?)/i.test(fileUrl) || /^\/(?:projects|asset-library|uploads)\//.test(fileUrl);
}
