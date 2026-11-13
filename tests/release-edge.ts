import { expect, test } from "@playwright/test";

test("Workers preview serves the museum 404 with revalidating HTML", async ({
  request,
}, info) => {
  const missing = await request.get("/release-preflight-missing-exhibit");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("This exhibit is on loan.");
  for (const path of ["/", "/privacy", "/terms"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).not.toContain("immutable");
    expect(response.headers()["content-security-policy"]).toContain(
      "default-src 'self'",
    );
  }
  await info.attach("unknown-route-response", {
    body: JSON.stringify(
      { status: missing.status(), headers: missing.headers() },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
