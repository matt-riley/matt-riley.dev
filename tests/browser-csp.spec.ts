import { expect, test } from "@playwright/test";

for (const forbiddenStyle of [false, true]) {
  test(`native select under strict CSP${forbiddenStyle ? " retains real inline-style enforcement" : " remains operable without violations"}`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.use.javaScriptEnabled === false,
      "The CSP event recorder requires script execution.",
    );
    await page.addInitScript(() => {
      const events: Array<{ directive: string; blocked: string }> = [];
      (
        window as typeof window & { nativeSelectCsp: typeof events }
      ).nativeSelectCsp = events;
      document.addEventListener("securitypolicyviolation", (event) =>
        events.push({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
        }),
      );
    });
    await page.route("**/__native-select-csp", (route) =>
      route.fulfill({
        contentType: "text/html",
        headers: {
          "Content-Security-Policy":
            "default-src 'none'; style-src 'none'; style-src-attr 'none'; img-src 'self'; base-uri 'none'; form-action 'none'",
        },
        body: `<!doctype html><html lang="en"><head><title>Native select CSP regression</title></head><body><label for="note">Choose a note</label><select id="note"><option value="one">One</option><option value="two">Two</option></select>${forbiddenStyle ? '<p style="color:red">This inline style must be blocked.</p>' : ""}</body></html>`,
      }),
    );
    expect((await page.goto("/__native-select-csp"))?.status()).toBe(200);
    const select = page.getByLabel("Choose a note");
    await select.selectOption("two");
    await expect(select).toHaveValue("two");
    // Flush native-control layout and queued policy events without screenshots
    // (WebKit's screenshot helper can itself inject an inline stylesheet).
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const events = await page.evaluate(
      () =>
        (
          window as typeof window & {
            nativeSelectCsp: Array<{ directive: string; blocked: string }>;
          }
        ).nativeSelectCsp,
    );
    expect(events).toEqual(
      forbiddenStyle
        ? [{ directive: "style-src-attr", blocked: "inline" }]
        : [],
    );
  });
}
