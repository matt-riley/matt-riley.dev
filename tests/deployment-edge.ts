import { expect, test } from "@playwright/test";
import { modelURL } from "../src/gallery/model-files";
import { allowSoftwareWebGL } from "./gallery-capability";

for (const view of ["catalogue", "gallery"] as const) {
  test(`Workers Assets enforces same-origin CSP in ${view}`, async ({
    page,
    request,
  }, info) => {
    if (view === "gallery") await allowSoftwareWebGL(page);
    await page.addInitScript((mode) => {
      localStorage.setItem("mr-view", mode);
      localStorage.setItem("mr-lights", "day");
      const violations: string[] = [];
      (
        window as typeof window & { __cspViolations: string[] }
      ).__cspViolations = violations;
      document.addEventListener("securitypolicyviolation", (event) =>
        violations.push(`${event.effectiveDirective}: ${event.blockedURI}`),
      );
    }, view);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    if (view === "gallery")
      await expect(page.locator("html")).toHaveAttribute(
        "data-gallery",
        "ready",
        { timeout: 30_000 },
      );
    else await expect(page.locator("[data-gallery-layer]")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Lights: Day", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-lights",
      "after-hours",
    );
    await page
      .locator("#human-error")
      .evaluate((element) => element.scrollIntoView());
    await page.waitForTimeout(1000);
    const script = await page
      .locator("script[src]")
      .first()
      .getAttribute("src");
    expect(script).toBeTruthy();
    for (const path of ["/", script as string, modelURL("room")]) {
      const resource = await request.head(path);
      expect(resource.ok()).toBe(true);
      expect(resource.headers()["x-content-type-options"]).toBe("nosniff");
      expect(resource.headers()["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(resource.headers()["permissions-policy"]).toContain("camera=()");
      expect(resource.headers()["content-security-policy"]).toContain(
        "'wasm-unsafe-eval'",
      );
      if (path !== "/")
        expect(resource.headers()["cache-control"]).toBe(
          "public, max-age=31536000, immutable",
        );
      await info.attach(
        `headers-${path === "/" ? "html" : path.includes("models") ? "model" : "script"}`,
        {
          body: JSON.stringify(resource.headers(), null, 2),
          contentType: "application/json",
        },
      );
    }
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __cspViolations: string[] })
            .__cspViolations,
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/s04-${view}-csp.png` });
  });
}
