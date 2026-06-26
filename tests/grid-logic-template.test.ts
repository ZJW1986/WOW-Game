import { describe, expect, it } from "vitest";
import {
  createGridLogicRuntime,
  moveGridCursor,
  stepGridLogicRuntime
} from "../src/runtime/phaser/gridLogic";

describe("grid logic Phaser runtime core", () => {
  it("solves a push-block board after the expected moves", () => {
    let runtime = createGridLogicRuntime({
      columns: 5,
      rows: 3,
      gridState: [
        [0, 0, 0, 0, 0],
        [1, 2, 0, 3, 0],
        [0, 0, 0, 0, 0]
      ],
      maxMoves: 4
    });

    runtime = moveGridCursor(runtime, "right");
    runtime = moveGridCursor(runtime, "right");
    runtime = stepGridLogicRuntime(runtime, 16);

    expect(runtime.phase).toBe("won");
    expect(runtime.movesUsed).toBe(2);
    expect(runtime.player).toEqual({ column: 2, row: 1 });
    expect(runtime.blocks[0]).toEqual({ column: 3, row: 1 });
  });

  it("loses when the move budget is exhausted before solving", () => {
    let runtime = createGridLogicRuntime({
      columns: 5,
      rows: 3,
      gridState: [
        [0, 0, 0, 0, 0],
        [1, 2, 0, 3, 0],
        [0, 0, 0, 0, 0]
      ],
      maxMoves: 1
    });

    runtime = moveGridCursor(runtime, "up");
    runtime = stepGridLogicRuntime(runtime, 16);

    expect(runtime.phase).toBe("lost");
    expect(runtime.movesUsed).toBe(1);
  });
});
