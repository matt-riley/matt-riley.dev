import { expect, test } from "@playwright/test";
import { QualityMonitor } from "../src/gallery/quality-monitor";

test("quality counts sustained moving frames and never steps back up", () => {
  const monitor = new QualityMonitor(8, 8);
  expect(monitor.tier).toBe("high");
  for (let time = 0; time <= 2100; time += 25) monitor.sample(time, 25, true);
  expect(monitor.tier).toBe("medium");
  for (let time = 2125; time <= 4300; time += 25)
    monitor.sample(time, 25, true);
  expect(monitor.tier).toBe("low");
  for (let time = 4350; time <= 9000; time += 40)
    monitor.sample(time, 40, true);
  expect(monitor.tier).toBe("retreat");
  for (let time = 9020; time < 11000; time += 10)
    monitor.sample(time, 10, true);
  expect(monitor.tier).toBe("retreat");
});

test("idle gaps and short slow bursts cannot lower quality", () => {
  const monitor = new QualityMonitor(8, 8);
  for (let time = 0; time < 1800; time += 30) monitor.sample(time, 30, true);
  monitor.sample(20_000, 18_000, false);
  for (let time = 20_016; time < 21_800; time += 30)
    monitor.sample(time, 30, true);
  expect(monitor.tier).toBe("high");
  expect(new QualityMonitor(4, 8).tier).toBe("medium");
  expect(new QualityMonitor(8, 4).tier).toBe("medium");
});
