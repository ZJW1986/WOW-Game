export interface TowerDefensePoint {
  x: number;
  y: number;
}

export interface TowerDefenseWave {
  startsAtMs: number;
  count: number;
  intervalMs: number;
  enemyHp: number;
  enemySpeed: number;
  reward: number;
}

export interface TowerDefenseTowerSpec {
  id: string;
  cost: number;
  range: number;
  damage: number;
  fireRateMs: number;
}

export interface TowerDefenseRuntimeInput {
  path: TowerDefensePoint[];
  waves: TowerDefenseWave[];
  baseHp: number;
  startingGold: number;
  towers: TowerDefenseTowerSpec[];
}

export interface TowerDefenseEnemy {
  id: string;
  hp: number;
  speed: number;
  reward: number;
  progress: number;
}

export interface TowerDefenseTower {
  id: string;
  specId: string;
  x: number;
  y: number;
  nextShotAtMs: number;
}

export interface TowerDefenseRuntime {
  phase: "playing" | "won" | "lost";
  timeMs: number;
  baseHp: number;
  gold: number;
  kills: number;
  path: TowerDefensePoint[];
  waves: TowerDefenseWave[];
  towerSpecs: TowerDefenseTowerSpec[];
  towers: TowerDefenseTower[];
  enemies: TowerDefenseEnemy[];
  spawnedByWave: number[];
}

export function createTowerDefenseRuntime(input: TowerDefenseRuntimeInput): TowerDefenseRuntime {
  return {
    phase: "playing",
    timeMs: 0,
    baseHp: Math.max(1, input.baseHp),
    gold: Math.max(0, input.startingGold),
    kills: 0,
    path: input.path.length >= 2 ? input.path : [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    waves: input.waves,
    towerSpecs: input.towers,
    towers: [],
    enemies: [],
    spawnedByWave: input.waves.map(() => 0)
  };
}

export function placeTower(runtime: TowerDefenseRuntime, specId: string, x: number, y: number): TowerDefenseRuntime {
  if (runtime.phase !== "playing") return runtime;
  const spec = runtime.towerSpecs.find((item) => item.id === specId);
  if (!spec || runtime.gold < spec.cost) return runtime;
  return {
    ...runtime,
    gold: runtime.gold - spec.cost,
    towers: [
      ...runtime.towers,
      {
        id: `tower-${runtime.towers.length + 1}`,
        specId,
        x,
        y,
        nextShotAtMs: runtime.timeMs
      }
    ]
  };
}

export function stepTowerDefenseRuntime(runtime: TowerDefenseRuntime, deltaMs: number): TowerDefenseRuntime {
  if (runtime.phase !== "playing") return runtime;
  let next = {
    ...runtime,
    timeMs: runtime.timeMs + Math.max(0, deltaMs),
    spawnedByWave: [...runtime.spawnedByWave],
    towers: runtime.towers.map((tower) => ({ ...tower })),
    enemies: runtime.enemies.map((enemy) => ({ ...enemy }))
  };

  next = spawnDueEnemies(next);
  next = moveEnemies(next, deltaMs);
  next = fireTowers(next);
  next = resolvePhase(next);
  return next;
}

function spawnDueEnemies(runtime: TowerDefenseRuntime): TowerDefenseRuntime {
  const enemies = [...runtime.enemies];
  const spawnedByWave = [...runtime.spawnedByWave];
  runtime.waves.forEach((wave, waveIndex) => {
    while (
      spawnedByWave[waveIndex] < wave.count &&
      runtime.timeMs >= wave.startsAtMs + spawnedByWave[waveIndex] * wave.intervalMs
    ) {
      spawnedByWave[waveIndex] += 1;
      enemies.push({
        id: `wave-${waveIndex + 1}-enemy-${spawnedByWave[waveIndex]}`,
        hp: wave.enemyHp,
        speed: wave.enemySpeed,
        reward: wave.reward,
        progress: 0
      });
    }
  });
  return { ...runtime, enemies, spawnedByWave };
}

function moveEnemies(runtime: TowerDefenseRuntime, deltaMs: number): TowerDefenseRuntime {
  const pathLength = measurePath(runtime.path);
  let baseHp = runtime.baseHp;
  const enemies: TowerDefenseEnemy[] = [];
  for (const enemy of runtime.enemies) {
    const progress = enemy.progress + (enemy.speed * deltaMs) / 1000 / pathLength;
    if (progress >= 1) {
      baseHp = Math.max(0, baseHp - 1);
    } else {
      enemies.push({ ...enemy, progress });
    }
  }
  return { ...runtime, baseHp, enemies };
}

function fireTowers(runtime: TowerDefenseRuntime): TowerDefenseRuntime {
  let gold = runtime.gold;
  let kills = runtime.kills;
  const enemies = runtime.enemies.map((enemy) => ({ ...enemy }));
  const towers = runtime.towers.map((tower) => {
    const spec = runtime.towerSpecs.find((item) => item.id === tower.specId);
    if (!spec || runtime.timeMs < tower.nextShotAtMs) return tower;
    const target = enemies.find((enemy) => enemy.hp > 0 && distance(pointOnPath(runtime.path, enemy.progress), tower) <= spec.range);
    if (!target) return tower;
    target.hp -= spec.damage;
    if (target.hp <= 0) {
      gold += target.reward;
      kills += 1;
    }
    return { ...tower, nextShotAtMs: runtime.timeMs + spec.fireRateMs };
  });
  return { ...runtime, gold, kills, towers, enemies: enemies.filter((enemy) => enemy.hp > 0) };
}

function resolvePhase(runtime: TowerDefenseRuntime): TowerDefenseRuntime {
  if (runtime.baseHp <= 0) return { ...runtime, phase: "lost" };
  const allSpawned = runtime.waves.every((wave, index) => runtime.spawnedByWave[index] >= wave.count);
  if (allSpawned && runtime.enemies.length === 0) return { ...runtime, phase: "won" };
  return runtime;
}

function measurePath(path: TowerDefensePoint[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += distance(path[index - 1], path[index]);
  }
  return Math.max(1, length);
}

function pointOnPath(path: TowerDefensePoint[], progress: number): TowerDefensePoint {
  const total = measurePath(path);
  let remaining = total * Math.max(0, Math.min(1, progress));
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segment = distance(start, end);
    if (remaining <= segment) {
      const ratio = segment === 0 ? 0 : remaining / segment;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      };
    }
    remaining -= segment;
  }
  return path[path.length - 1];
}

function distance(left: TowerDefensePoint, right: TowerDefensePoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
