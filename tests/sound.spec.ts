import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import ts from "typescript";

function soundCode() {
  return ts.transpileModule(readFileSync("src/scripts/sound.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

test("loading the sound module never creates a context or requires browser globals", async () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Cold module evaluation is browser independent.",
  );
  const audio = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    get() {
      throw new Error("AudioContext accessed outside a gesture");
    },
  });
  try {
    const module = await import(
      `data:text/javascript,${encodeURIComponent(soundCode())}`
    );
    expect(typeof module.createSoundEngine).toBe("function");
    expect(typeof module.mountSound).toBe("function");
  } finally {
    if (audio) Object.defineProperty(globalThis, "AudioContext", audio);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("the synthesized sound module stays below 4KB gzip", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The emitted module budget is browser independent.",
  );
  expect(gzipSync(soundCode()).length).toBeLessThan(4096);
});
