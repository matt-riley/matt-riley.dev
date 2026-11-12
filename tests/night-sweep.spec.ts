import { expect, test } from "@playwright/test";
import { NightSweep } from "../src/gallery/night-sweep";

test("a single front sweeps entrance to gift over 900ms in either direction", () => {
  const sweep = new NightSweep(false);
  expect(sweep.sample(0).amount).toBe(0);
  sweep.setNight(true, 100);
  expect(sweep.sample(100).front).toBeLessThan(0);
  expect(sweep.sample(550).front).toBeCloseTo(0.5);
  expect(sweep.sample(1000).amount).toBe(1);
  expect(sweep.sample(1000).moving).toBe(false);
  sweep.setNight(false, 2000);
  expect(sweep.sample(2000).from).toBe(1);
  expect(sweep.sample(2000).front).toBeLessThan(0);
  expect(sweep.sample(2900).amount).toBe(0);
});

test("reversing mid-sweep starts from the current exposure without a white flash", () => {
  const sweep = new NightSweep(false);
  sweep.setNight(true, 0);
  const before = sweep.sample(450).amount;
  sweep.setNight(false, 450);
  expect(sweep.sample(450).amount).toBe(before);
  expect(sweep.sample(600).amount).toBeLessThan(before);
  expect(sweep.sample(1350).amount).toBe(0);
});
