import type { Page } from "@playwright/test";

/** Longest authored disclosure / entrance fade on the archive gallery (see gallery.css). */
const authoredFadeMs = 450;

export async function installMotionClock(page: Page) {
  await page.clock.install({ time: new Date() });
}

export async function settlePageMotion(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.clock.fastForward(authoredFadeMs);
  await page.evaluate(async () => {
    const pending = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState !== "finished" &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      );
    if (!pending.length) return;
    await Promise.all(
      pending.map((animation) => animation.finished.catch(() => {})),
    );
  });
}

export async function settleLocatorMotion(page: Page, selector: string) {
  await page.clock.fastForward(authoredFadeMs);
  await page.locator(selector).evaluate(async (element) => {
    const pending = element
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          animation.playState !== "finished" &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      );
    if (!pending.length) return;
    await Promise.all(
      pending.map((animation) => animation.finished.catch(() => {})),
    );
  });
}
