import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ThreeAssetLoadReport, ThreeAssetPack, ThreeSceneDirector, ViewportMode } from "../core/types";

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

      const player = await createRuntimeModel(
        THREE,
        loader,
        readAsset("three.model.player"),
        () =>
          new THREE.Mesh(
            new THREE.ConeGeometry(0.55, 1.35, 8),
            new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0f172a })
          ),
        { scale: 1.1, assetKey: "three.model.player", errors: modelLoadErrors }
      );
      player.position.set(director.player.start.x, director.player.start.y, director.player.start.z);
      player.rotation.x = Math.PI / 2;
      scene.add(player);

      const collectibles = Array.from({ length: director.objectives.collectTarget }, (_, index) => {
        const item = createProceduralCollectible(THREE);
        item.position.set(((index % 4) - 1.5) * 2.3, 0.45, 4 - Math.floor(index / 4) * 5);
        scene.add(item);
        return item;
      });
      await replacePrototypeModel(THREE, loader, collectibles, readAsset("three.model.collectible"), {
        scale: 0.55,
        assetKey: "three.model.collectible",
        errors: modelLoadErrors
      });

      const hazards = Array.from({ length: 8 }, (_, index) => {
        const hazard = createProceduralHazard(THREE);
        hazard.position.set(((index % 4) - 1.5) * 2.6, 0.6, -2 - Math.floor(index / 4) * 4);
        scene.add(hazard);
        return hazard;
      });
      await replacePrototypeModel(THREE, loader, hazards, readAsset("three.model.hazard"), {
        scale: 0.8,
        assetKey: "three.model.hazard",
        errors: modelLoadErrors
      });

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
        player.position.x = clamp(player.position.x + delta * 0.015, -5.4, 5.4);
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
        collectibles.forEach((item) => {
          item.visible = true;
        });
        updateHud();
        renderer.domElement.focus();
      }

      let last = performance.now();
      let hitCooldownMs = 0;
      function animate(now: number) {
        if (disposed) return;
        const delta = Math.min(0.033, (now - last) / 1000);
        last = now;
        hitCooldownMs = Math.max(0, hitCooldownMs - delta * 1000);
        if (stateRef.current.phase === "playing") {
          const move = director.player.speed * delta;
          const previousX = player.position.x;
          const previousZ = player.position.z;
          if (keys.has("arrowleft") || keys.has("a")) player.position.x -= move;
          if (keys.has("arrowright") || keys.has("d")) player.position.x += move;
          if (keys.has("arrowup") || keys.has("w")) player.position.z -= move;
          if (keys.has("arrowdown") || keys.has("s")) player.position.z += move;
          if (previousX !== player.position.x || previousZ !== player.position.z) setPlayerMoved(true);
          player.position.x = clamp(player.position.x, -5.4, 5.4);
          player.position.z = clamp(player.position.z, -12, 11);

          hazards.forEach((hazard, index) => {
            hazard.rotation.x += delta * 1.4;
            hazard.rotation.y += delta * 0.9;
            const behavior = director.enemies[index % director.enemies.length]?.behavior ?? "falling";
            if (behavior === "chase") {
              hazard.position.x += Math.sign(player.position.x - hazard.position.x) * delta * 0.8;
            } else if (behavior === "patrol" || behavior === "orbit") {
              hazard.position.x += Math.sin(now / 700 + index) * delta * 1.4;
            }
            hazard.position.z += delta * (1.2 + index * 0.08);
            if (hazard.position.z > 12) hazard.position.z = -14;
            if (hitCooldownMs <= 0 && distance2D(player.position, hazard.position) < 0.85) {
              stateRef.current.lives -= 1;
              hitCooldownMs = 800;
              hazard.position.z = -14;
              if (stateRef.current.lives <= 0) stateRef.current.phase = "lost";
              updateHud();
            }
          });

          collectibles.forEach((item) => {
            item.rotation.y += delta * 2.5;
            if (item.visible && distance2D(player.position, item.position) < 0.75) {
              item.visible = false;
              stateRef.current.score += 1;
              if (stateRef.current.score >= director.objectives.collectTarget) {
                stateRef.current.phase = "won";
              }
              updateHud();
            }
          });
        }
        camera.position.x += (player.position.x * 0.28 - camera.position.x) * 0.05;
        camera.lookAt(player.position.x * 0.25, 0, player.position.z - 3);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);

      cleanupFns.push(() => {
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
        <span>键盘 WASD/方向键移动，空格或 Enter 开始/重开；手机可拖动控制。</span>
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

function createProceduralCollectible(THREE: typeof import("three")) {
  return new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x7c2d12 })
  );
}

function createProceduralHazard(THREE: typeof import("three")) {
  return new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0x450a0a })
  );
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
