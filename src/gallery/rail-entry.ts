import { onGalleryReady } from "./state";

onGalleryReady(async (app) => {
  const { mountRail } = await import("./rail");
  if (app.disposed) return;
  return mountRail(app);
});
