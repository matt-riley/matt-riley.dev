import { onGalleryReady } from "../gallery/state";
import "../styles/interactions.css";

onGalleryReady(async (app) => {
  const { mountExhibits } = await import("../gallery/mount-exhibits");
  if (app.disposed) return;
  return mountExhibits(app);
});
