import { describe, expect, it } from "vitest";
import { createThreePhysicsWorld } from "../src/runtime/three/Physics";

describe("Three physics adapter", () => {
  it("stops a dynamic player on static ground", async () => {
    const physics = await createThreePhysicsWorld({ gravity: { x: 0, y: -9.81, z: 0 } });
    physics.addStaticBox("ground", { x: 0, y: -0.5, z: 0 }, { x: 8, y: 0.5, z: 8 });
    const player = physics.addDynamicSphere("player", { x: 0, y: 3, z: 0 }, 0.5);

    for (let i = 0; i < 180; i += 1) physics.step(1 / 60);

    expect(player.position().y).toBeGreaterThan(0.45);
    expect(Math.abs(player.velocity().y)).toBeLessThan(0.25);
  });

  it("reports collision events with logical body ids", async () => {
    const physics = await createThreePhysicsWorld({ gravity: { x: 0, y: 0, z: 0 } });
    physics.addStaticBox("hazard", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const player = physics.addDynamicSphere("player", { x: -2, y: 0, z: 0 }, 0.35);
    player.setVelocity({ x: 6, y: 0, z: 0 });

    const events = [];
    for (let i = 0; i < 40; i += 1) events.push(...physics.step(1 / 60));

    expect(events).toContainEqual({ type: "collision-start", a: "player", b: "hazard" });
  });
});
