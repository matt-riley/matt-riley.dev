import { expect, test } from "@playwright/test";
import { MeshStandardMaterial } from "three";
import { applyNightGlow } from "../src/gallery/night-shader";
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

test("late touch ownership keeps pad emission authoritative in Day and After hours", () => {
  const material = new MeshStandardMaterial({ color: 0xe8741a });
  applyNightGlow(material, 0.024);
  expect(material.emissive.r).toBeGreaterThan(0);
  material.userData.touchEmissionOwned = true;
  material.emissive.setRGB(0.8, 0.2, 0.05);
  const flash = material.emissive.clone();
  applyNightGlow(material, 0);
  expect(material.emissive.equals(flash)).toBe(true);
  applyNightGlow(material, 0.024);
  expect(material.emissive.equals(flash)).toBe(true);
  material.userData.touchEmissionOwned = false;
  applyNightGlow(material, 0);
  expect(material.emissive.getHex()).toBe(0);
  material.dispose();
});
