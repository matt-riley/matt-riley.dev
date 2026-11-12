import { onExhibitsReady } from "../gallery/exhibit-state";

onExhibitsReady(async (registry) => {
  const { mountGiftShop } = await import("../gallery/gift-shop");
  if (registry.disposed) return;
  return mountGiftShop(registry);
});
