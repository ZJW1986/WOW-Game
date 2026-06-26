export type GridDirection = "up" | "down" | "left" | "right";

export interface GridPoint {
  column: number;
  row: number;
}

export interface GridLogicRuntimeInput {
  columns: number;
  rows: number;
  gridState?: number[][];
  maxMoves: number;
}

export interface GridLogicRuntime {
  phase: "playing" | "won" | "lost";
  columns: number;
  rows: number;
  maxMoves: number;
  movesUsed: number;
  player: GridPoint;
  blocks: GridPoint[];
  targets: GridPoint[];
  walls: GridPoint[];
}

export function createGridLogicRuntime(input: GridLogicRuntimeInput): GridLogicRuntime {
  const columns = Math.max(3, input.columns || 5);
  const rows = Math.max(3, input.rows || 3);
  const parsed = parseGridState(input.gridState, columns, rows);
  const runtime: GridLogicRuntime = {
    phase: "playing",
    columns,
    rows,
    maxMoves: Math.max(1, input.maxMoves || 12),
    movesUsed: 0,
    player: parsed.player,
    blocks: parsed.blocks,
    targets: parsed.targets,
    walls: parsed.walls
  };
  return resolveGridPhase(runtime);
}

export function moveGridCursor(runtime: GridLogicRuntime, direction: GridDirection): GridLogicRuntime {
  if (runtime.phase !== "playing") return runtime;
  const delta = directionDelta(direction);
  const nextPlayer = { column: runtime.player.column + delta.column, row: runtime.player.row + delta.row };
  if (!isInside(runtime, nextPlayer) || hasPoint(runtime.walls, nextPlayer)) return consumeMove(runtime);

  const blockIndex = runtime.blocks.findIndex((block) => samePoint(block, nextPlayer));
  if (blockIndex === -1) {
    return resolveGridPhase({ ...runtime, player: nextPlayer, movesUsed: runtime.movesUsed + 1 });
  }

  const pushedBlock = { column: nextPlayer.column + delta.column, row: nextPlayer.row + delta.row };
  if (!isInside(runtime, pushedBlock) || hasPoint(runtime.walls, pushedBlock) || hasPoint(runtime.blocks, pushedBlock)) {
    return consumeMove(runtime);
  }

  const blocks = runtime.blocks.map((block, index) => (index === blockIndex ? pushedBlock : block));
  return resolveGridPhase({ ...runtime, player: nextPlayer, blocks, movesUsed: runtime.movesUsed + 1 });
}

export function stepGridLogicRuntime(runtime: GridLogicRuntime, _deltaMs: number): GridLogicRuntime {
  return resolveGridPhase(runtime);
}

function parseGridState(gridState: number[][] | undefined, columns: number, rows: number) {
  const fallback = [
    [0, 0, 0, 0, 0],
    [1, 2, 0, 3, 0],
    [0, 0, 0, 0, 0]
  ];
  const state = gridState?.length ? gridState : fallback;
  const blocks: GridPoint[] = [];
  const targets: GridPoint[] = [];
  const walls: GridPoint[] = [];
  let player: GridPoint = { column: 0, row: Math.min(1, rows - 1) };

  for (let row = 0; row < Math.min(rows, state.length); row += 1) {
    for (let column = 0; column < Math.min(columns, state[row]?.length ?? 0); column += 1) {
      const cell = state[row][column];
      if (cell === 1) player = { column, row };
      if (cell === 2) blocks.push({ column, row });
      if (cell === 3) targets.push({ column, row });
      if (cell === 4) walls.push({ column, row });
    }
  }

  if (blocks.length === 0) blocks.push({ column: Math.min(1, columns - 1), row: player.row });
  if (targets.length === 0) targets.push({ column: Math.min(columns - 1, player.column + 3), row: player.row });
  return { player, blocks, targets, walls };
}

function consumeMove(runtime: GridLogicRuntime): GridLogicRuntime {
  return resolveGridPhase({ ...runtime, movesUsed: runtime.movesUsed + 1 });
}

function resolveGridPhase(runtime: GridLogicRuntime): GridLogicRuntime {
  const solved = runtime.targets.every((target) => hasPoint(runtime.blocks, target));
  if (solved) return { ...runtime, phase: "won" };
  if (runtime.movesUsed >= runtime.maxMoves) return { ...runtime, phase: "lost" };
  return runtime;
}

function directionDelta(direction: GridDirection): GridPoint {
  if (direction === "up") return { column: 0, row: -1 };
  if (direction === "down") return { column: 0, row: 1 };
  if (direction === "left") return { column: -1, row: 0 };
  return { column: 1, row: 0 };
}

function isInside(runtime: GridLogicRuntime, point: GridPoint): boolean {
  return point.column >= 0 && point.column < runtime.columns && point.row >= 0 && point.row < runtime.rows;
}

function hasPoint(points: GridPoint[], point: GridPoint): boolean {
  return points.some((item) => samePoint(item, point));
}

function samePoint(left: GridPoint, right: GridPoint): boolean {
  return left.column === right.column && left.row === right.row;
}
