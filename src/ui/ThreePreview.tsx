import { useEffect, useRef, useState } from "react";
import type { ThreeSceneDirector, ViewportMode } from "../core/types";

export function ThreePreview({
  director,
  viewportMode = "app_9_16"
}: {
  director: ThreeSceneDirector;
  viewportMode?: ViewportMode;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    score: 0,
    lives: 3,
    phase: "ready" as "ready" | "playing" | "won" | "lost"
  });
  const [hud, setHud] = useState(stateRef.current);
  const [playerMoved, setPlayerMoved] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.innerHTML = "";
    setPlayerMoved(false);
    let disposed = false;
    const keys = new Set<string>();
    const cleanupFns: Array<() => void> = [];

    void import("three").then((THREE) => {
      if (disposed || !mount) return;
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
        const width = Math.max(1, Math.round(mount.clientWidth || 390));
        const height = Math.max(1, Math.round(mount.clientHeight || 844));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
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

      const player = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.35, 8),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0f172a })
      );
      player.position.set(director.player.start.x, director.player.start.y, director.player.start.z);
      player.rotation.x = Math.PI / 2;
      scene.add(player);

      const collectibleGeometry = new THREE.OctahedronGeometry(0.35, 0);
      const collectibleMaterial = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x7c2d12 });
      const collectibles = Array.from({ length: director.objectives.collectTarget }, (_, index) => {
        const item = new THREE.Mesh(collectibleGeometry, collectibleMaterial.clone());
        item.position.set(((index % 4) - 1.5) * 2.3, 0.45, 4 - Math.floor(index / 4) * 5);
        scene.add(item);
        return item;
      });

      const hazardGeometry = new THREE.DodecahedronGeometry(0.55, 0);
      const hazards = Array.from({ length: 8 }, (_, index) => {
        const hazard = new THREE.Mesh(
          hazardGeometry,
          new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0x450a0a })
        );
        hazard.position.set(((index % 4) - 1.5) * 2.6, 0.6, -2 - Math.floor(index / 4) * 4);
        scene.add(hazard);
        return hazard;
      });

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
      function animate(now: number) {
        if (disposed) return;
        const delta = Math.min(0.033, (now - last) / 1000);
        last = now;
        if (stateRef.current.phase === "playing") {
          const move = director.player.speed * delta;
          if (keys.has("arrowleft") || keys.has("a")) player.position.x -= move;
          if (keys.has("arrowright") || keys.has("d")) player.position.x += move;
          if (keys.has("arrowup") || keys.has("w")) player.position.z -= move;
          if (keys.has("arrowdown") || keys.has("s")) player.position.z += move;
          if (keys.size > 0) setPlayerMoved(true);
          player.position.x = clamp(player.position.x, -5.4, 5.4);
          player.position.z = clamp(player.position.z, -12, 11);

          hazards.forEach((hazard, index) => {
            hazard.rotation.x += delta * 1.4;
            hazard.rotation.y += delta * 0.9;
            hazard.position.z += delta * (1.2 + index * 0.08);
            if (hazard.position.z > 12) hazard.position.z = -14;
            if (distance2D(player.position, hazard.position) < 0.85) {
              stateRef.current.lives -= 1;
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
    });

    return () => {
      disposed = true;
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [director, viewportMode]);

  const isTerminal = hud.phase === "won" || hud.phase === "lost";
  return (
    <div
      className={`three-preview-shell ${viewportMode}`}
      data-three-preview="ready"
      data-runtime-phase={hud.phase}
      data-player-moved={playerMoved ? "true" : "false"}
    >
      <div className="three-preview-hud">
        <strong>{director.title}</strong>
        <span>目标 {hud.score}/{director.objectives.collectTarget}</span>
        <span>生命 {hud.lives}</span>
      </div>
      <div className="three-preview-canvas" ref={mountRef} />
      <div className="three-preview-controls">
        <span>键盘 WASD/方向键移动，空格或 Enter 开始/重开；手机可拖动控制。</span>
      </div>
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance2D(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}
