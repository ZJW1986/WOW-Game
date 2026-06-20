import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  processGeneratedImageForSlot,
  validateProcessedSprite
} from "../src/services/imageCutoutService";

async function whiteBackgroundSprite(): Promise<Uint8Array> {
  const svg = `
    <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="white"/>
      <circle cx="48" cy="48" r="24" fill="#ff3355"/>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function transparentSprite(): Promise<Uint8Array> {
  const svg = `
    <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="none"/>
      <circle cx="48" cy="48" r="24" fill="#22d3ee"/>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function checkerboardSprite(): Promise<Uint8Array> {
  const svg = `
    <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#d8d8d8"/>
          <rect x="8" width="8" height="8" fill="#6f6f6f"/>
          <rect y="8" width="8" height="8" fill="#6f6f6f"/>
          <rect x="8" y="8" width="8" height="8" fill="#d8d8d8"/>
        </pattern>
      </defs>
      <rect width="128" height="128" fill="url(#checker)"/>
      <circle cx="64" cy="64" r="28" fill="#ff7a18"/>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function checkerboardResidueSprite(): Promise<Uint8Array> {
  const svg = `
    <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" fill="#00ff00"/>
      <g transform="translate(34 34)">
        <defs>
          <pattern id="residue" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="#d8d8d8"/>
            <rect x="4" width="4" height="4" fill="#6f6f6f"/>
            <rect y="4" width="4" height="4" fill="#6f6f6f"/>
            <rect x="4" y="4" width="4" height="4" fill="#d8d8d8"/>
          </pattern>
        </defs>
        <rect width="60" height="60" fill="url(#residue)"/>
        <circle cx="30" cy="30" r="22" fill="#ff3355"/>
      </g>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function chromaSprite(fill: string): Promise<Uint8Array> {
  const svg = `
    <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" fill="${fill}"/>
      <path d="M64 24 L92 100 L64 86 L36 100 Z" fill="#ff7a18"/>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function greenEdgeResidueSprite(): Promise<Uint8Array> {
  const svg = `
    <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" fill="#00ff00"/>
      <rect x="0" y="0" width="128" height="8" fill="#12f912"/>
      <circle cx="64" cy="64" r="24" fill="#ff3355"/>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function backgroundImage(): Promise<Uint8Array> {
  const svg = `
    <svg width="160" height="90" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="90" fill="#101828"/>
      <circle cx="80" cy="45" r="32" fill="#22d3ee"/>
    </svg>
  `;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg().toBuffer());
}

describe("image cutout service", () => {
  it("turns an opaque white-background sprite into a transparent PNG", async () => {
    const result = await processGeneratedImageForSlot({
      slot: "player",
      assetKey: "player.ship",
      bytes: await whiteBackgroundSprite(),
      contentType: "image/png"
    });

    expect(result.outputExtension).toBe("png");
    expect(result.cutoutApplied).toBe(true);
    expect(result.validation.validationStatus).toBe("passed");
    expect(result.validation.alphaCoverage).toBeGreaterThan(0);
    expect(result.validation.alphaCoverage).toBeLessThan(0.85);
    expect(result.validation.width).toBe(128);
    expect(result.validation.height).toBe(128);
    expect(result.validation.subjectBounds.width).toBeLessThanOrEqual(92);
  });

  it("does not cut out background images", async () => {
    const input = await backgroundImage();
    const result = await processGeneratedImageForSlot({
      slot: "background",
      assetKey: "world.background",
      bytes: input,
      contentType: "image/jpeg"
    });

    expect(result.cutoutApplied).toBe(false);
    expect(result.outputExtension).toBe("jpg");
    expect(result.outputBytes).toEqual(input);
  });

  it("keeps an already transparent sprite valid", async () => {
    const result = await processGeneratedImageForSlot({
      slot: "hazard",
      assetKey: "hazard.enemy",
      bytes: await transparentSprite(),
      contentType: "image/png"
    });

    const validation = await validateProcessedSprite(result.outputBytes);

    expect(result.outputExtension).toBe("png");
    expect(validation.validationStatus).toBe("passed");
    expect(validation.subjectBounds.width).toBeGreaterThan(0);
  });

  it("cleans checkerboard sprite backgrounds before confirmation", async () => {
    const result = await processGeneratedImageForSlot({
      slot: "collectible",
      assetKey: "item.collectible",
      bytes: await checkerboardSprite(),
      contentType: "image/png"
    });

    expect(result.outputExtension).toBe("png");
    expect(result.validation.validationStatus).toBe("passed");
    expect(result.validation.width).toBe(128);
    expect(result.validation.height).toBe(128);
    expect(result.validation.alphaCoverage).toBeLessThan(0.6);
  });

  it("removes green screen backgrounds and records chroma key validation", async () => {
    const result = await processGeneratedImageForSlot({
      slot: "player",
      assetKey: "player.ship",
      bytes: await chromaSprite("#00ff00"),
      contentType: "image/png"
    });

    expect(result.cutoutApplied).toBe(true);
    expect(result.cutoutMethod).toContain("chroma-key");
    expect(result.validation.validationStatus).toBe("passed");
    expect(result.validation.width).toBe(128);
    expect(result.validation.height).toBe(128);
    expect(result.validation.chromaKeyColor).toBe("#00ff00");
    expect(result.validation.edgeResidueScore).toBeLessThan(0.02);
  });

  it("supports magenta and blue chroma backgrounds", async () => {
    const magenta = await processGeneratedImageForSlot({
      slot: "hazard",
      assetKey: "hazard.enemy",
      bytes: await chromaSprite("#ff00ff"),
      contentType: "image/png"
    });
    const blue = await processGeneratedImageForSlot({
      slot: "collectible",
      assetKey: "item.collectible",
      bytes: await chromaSprite("#0066ff"),
      contentType: "image/png"
    });

    expect(magenta.validation.validationStatus).toBe("passed");
    expect(magenta.validation.chromaKeyColor).toBe("#ff00ff");
    expect(blue.validation.validationStatus).toBe("passed");
    expect(blue.validation.chromaKeyColor).toBe("#0066ff");
  });

  it("fails sprites with chroma residue touching the output edge", async () => {
    const result = await processGeneratedImageForSlot({
      slot: "player",
      assetKey: "player.ship",
      bytes: await greenEdgeResidueSprite(),
      contentType: "image/png"
    });

    expect(result.validation.validationStatus).toBe("failed");
    expect(result.validation.validationErrors.join(" ")).toContain("edge residue");
  });

  it("fails sprites that still contain checkerboard residue after cutout", async () => {
    const result = await processGeneratedImageForSlot({
      slot: "hazard",
      assetKey: "hazard.enemy",
      bytes: await checkerboardResidueSprite(),
      contentType: "image/png"
    });

    expect(result.validation.validationStatus).toBe("failed");
    expect(result.validation.validationErrors.join(" ")).toContain("checkerboard residue");
  });
});
