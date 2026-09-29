// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS A RUN IS DRAWN WITH, fetched before the renderer's kit is handed
// out (`App.tsx`): the crafts and the rider (`craft-models.ts`) and every kind
// of tree (`tree-models.ts`), each only when its build switch is on. Stated
// apart from `renderer.ts` so the renderer's chunk re-exports one name.

import { loadModels as loadCraftModels } from "./craft-models.ts";
import { loadTreeModels } from "./tree-models.ts";

export async function loadModels(): Promise<void> {
  await Promise.all([loadCraftModels(), loadTreeModels()]);
}
