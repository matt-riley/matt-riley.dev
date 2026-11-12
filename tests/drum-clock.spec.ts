import { expect, test } from "@playwright/test";
import { StepTimeline } from "../src/scripts/drum-clock";
import {
  decodePattern,
  encodePattern,
  presetPattern,
} from "../src/scripts/drum-pattern";

test("a short shared pattern reproduces every step, tempo and swing exactly", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Pattern codec is browser independent.",
  );
  const pattern = {
    rows: [65535, 0, 43690, 32769] as [number, number, number, number],
    tempo: 103,
    swing: 63,
  };
  const code = encodePattern(pattern);
  expect(code).toMatch(/^[A-Za-z0-9_-]{15}$/);
  expect(decodePattern(code)).toEqual(pattern);
  for (const invalid of ["", "x", "!".repeat(15), `${code}x`, "A".repeat(15)])
    expect(decodePattern(invalid)).toBeUndefined();
  expect(() => encodePattern({ ...pattern, tempo: 111 })).toThrow(RangeError);
  expect(presetPattern("Head nod").rows).not.toEqual(
    presetPattern("Late bus").rows,
  );
  expect(presetPattern("Late bus").rows).not.toEqual(
    presetPattern("Sunday").rows,
  );
});

test("the audio-clock timeline keeps swung deadlines exact through 30 seconds of wake jitter", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Audio-clock arithmetic is browser independent.",
  );
  const clock = new StepTimeline(0.1, 88, 58);
  const notes: { step: number; when: number }[] = [];
  let now = 0,
    index = 0;
  while (now < 30.1) {
    notes.push(...clock.takeUntil(now));
    now += [0.011, 0.037, 0.023, 0.052][index++ % 4];
  }
  expect(notes.at(-1)?.when ?? 0).toBeGreaterThan(30);
  expect(clock.missed).toBe(0);
  for (let index = 1; index < notes.length; index++) {
    const expected =
      (60 / 88 / 4) * (notes[index - 1].step % 2 === 0 ? 1.16 : 0.84);
    expect(
      Math.abs(notes[index].when - notes[index - 1].when - expected),
    ).toBeLessThan(0.002);
    expect(notes[index].step).toBe((notes[index - 1].step + 1) % 16);
  }
});

test("late wakes skip expired notes instead of replaying a backlog", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Scheduling recovery is browser independent.",
  );
  const clock = new StepTimeline(0.05);
  clock.takeUntil(0);
  const notes = clock.takeUntil(10);
  expect(clock.missed).toBeGreaterThan(0);
  expect(notes.every((note) => note.when >= 10 && note.when < 10.15)).toBe(
    true,
  );
});
