export interface ThreePhysicsVector {
  x: number;
  y: number;
  z: number;
}

export interface ThreePhysicsOptions {
  gravity?: ThreePhysicsVector;
}

export interface ThreePhysicsCollisionEvent {
  type: "collision-start";
  a: string;
  b: string;
}

export interface ThreePhysicsBody {
  id: string;
  position(): ThreePhysicsVector;
  velocity(): ThreePhysicsVector;
  setPosition(position: ThreePhysicsVector): void;
  setVelocity(velocity: ThreePhysicsVector): void;
}

type BodyKind = "dynamic-sphere" | "static-box";

interface BodyRecord {
  id: string;
  kind: BodyKind;
  position: ThreePhysicsVector;
  velocity: ThreePhysicsVector;
  radius?: number;
  halfExtents?: ThreePhysicsVector;
}

export interface ThreePhysicsWorld {
  addStaticBox(id: string, position: ThreePhysicsVector, halfExtents: ThreePhysicsVector): ThreePhysicsBody;
  addDynamicSphere(id: string, position: ThreePhysicsVector, radius: number): ThreePhysicsBody;
  step(dt: number): ThreePhysicsCollisionEvent[];
}

export async function createThreePhysicsWorld(options: ThreePhysicsOptions = {}): Promise<ThreePhysicsWorld> {
  const gravity = options.gravity ?? { x: 0, y: -9.81, z: 0 };
  const bodies: BodyRecord[] = [];
  const activePairs = new Set<string>();

  function toPublicBody(body: BodyRecord): ThreePhysicsBody {
    return {
      id: body.id,
      position: () => ({ ...body.position }),
      velocity: () => ({ ...body.velocity }),
      setPosition: (position) => {
        body.position = { ...position };
      },
      setVelocity: (velocity) => {
        body.velocity = { ...velocity };
      }
    };
  }

  function addStaticBox(id: string, position: ThreePhysicsVector, halfExtents: ThreePhysicsVector): ThreePhysicsBody {
    const body: BodyRecord = {
      id,
      kind: "static-box",
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      halfExtents: { ...halfExtents }
    };
    bodies.push(body);
    return toPublicBody(body);
  }

  function addDynamicSphere(id: string, position: ThreePhysicsVector, radius: number): ThreePhysicsBody {
    const body: BodyRecord = {
      id,
      kind: "dynamic-sphere",
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      radius
    };
    bodies.push(body);
    return toPublicBody(body);
  }

  function step(dt: number): ThreePhysicsCollisionEvent[] {
    const events: ThreePhysicsCollisionEvent[] = [];
    const dynamicBodies = bodies.filter((body) => body.kind === "dynamic-sphere");
    const staticBodies = bodies.filter((body) => body.kind === "static-box");

    for (const body of dynamicBodies) {
      body.velocity.x += gravity.x * dt;
      body.velocity.y += gravity.y * dt;
      body.velocity.z += gravity.z * dt;
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;

      for (const staticBody of staticBodies) {
        const collided = resolveSphereBoxCollision(body, staticBody);
        const pairId = [body.id, staticBody.id].sort().join(":");
        if (collided && !activePairs.has(pairId)) {
          activePairs.add(pairId);
          events.push({ type: "collision-start", a: body.id, b: staticBody.id });
        } else if (!collided) {
          activePairs.delete(pairId);
        }
      }
    }

    return events;
  }

  return {
    addStaticBox,
    addDynamicSphere,
    step
  };
}

function resolveSphereBoxCollision(sphere: BodyRecord, box: BodyRecord): boolean {
  if (!sphere.radius || !box.halfExtents) return false;
  const closest = {
    x: clamp(sphere.position.x, box.position.x - box.halfExtents.x, box.position.x + box.halfExtents.x),
    y: clamp(sphere.position.y, box.position.y - box.halfExtents.y, box.position.y + box.halfExtents.y),
    z: clamp(sphere.position.z, box.position.z - box.halfExtents.z, box.position.z + box.halfExtents.z)
  };
  const dx = sphere.position.x - closest.x;
  const dy = sphere.position.y - closest.y;
  const dz = sphere.position.z - closest.z;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  if (distanceSq > sphere.radius * sphere.radius) return false;

  const boxTop = box.position.y + box.halfExtents.y;
  const sphereBottom = sphere.position.y - sphere.radius;
  if (sphereBottom <= boxTop && sphere.position.y >= boxTop) {
    sphere.position.y = boxTop + sphere.radius;
    if (sphere.velocity.y < 0) sphere.velocity.y = 0;
  } else {
    sphere.velocity.x = 0;
    sphere.velocity.z = 0;
  }
  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
