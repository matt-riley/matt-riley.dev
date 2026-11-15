import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import ts from "typescript";

const compile = (path: string) =>
  ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

test("a closed hat chokes the open-hat tail in the real offline audio graph", async ({
  page,
}, info) => {
  test.skip(
    !["desktop-chromium", "desktop-webkit"].includes(info.project.name),
    "The native voice graph is verified on both audio engines.",
  );
  const clock = `data:text/javascript,${encodeURIComponent(compile("src/scripts/drum-clock.ts"))}`;
  const drums = compile("src/scripts/drums.ts").replace(
    'from "./drum-clock"',
    `from "${clock}"`,
  );
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "catalogue");
    localStorage.setItem("mr-sound", "off");
  });
  await page.goto("/archive-gallery/");
  const result = await page.evaluate(
    async (code) => {
      const audio = await import(
          `data:text/javascript,${encodeURIComponent(code.sound)}`
        ),
        drums = await import(
          `data:text/javascript,${encodeURIComponent(code.drums)}`
        );
      async function render(choke: boolean) {
        const context = new OfflineAudioContext(1, 22050, 44100),
          engine = audio.createSoundEngine(context, () => true),
          voices = drums.createDrumVoices(engine);
        voices.play(3, 0.01);
        if (choke) voices.play(2, 0.1);
        const buffer = await context.startRendering(),
          samples = buffer.getChannelData(0);
        let energy = 0,
          count = 0,
          peak = 0;
        for (let index = 0; index < samples.length; index++) {
          peak = Math.max(peak, Math.abs(samples[index]));
          if (index >= 0.23 * 44100 && index < 0.3 * 44100) {
            energy += samples[index] ** 2;
            count++;
          }
        }
        voices.dispose();
        engine.dispose();
        return { tail: Math.sqrt(energy / count), peak };
      }
      return { open: await render(false), choked: await render(true) };
    },
    { sound: compile("src/scripts/sound.ts"), drums },
  );
  expect(result.open.tail).toBeGreaterThan(0.000001);
  expect(result.choked.tail).toBeLessThan(result.open.tail * 0.1);
  expect(result.open.peak).toBeLessThan(10 ** (-6 / 20));
  expect(result.choked.peak).toBeLessThan(10 ** (-6 / 20));
});
