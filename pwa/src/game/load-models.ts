// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS A RUN IS DRAWN WITH, fetched before the renderer's kit is handed
// out (`App.tsx`): the crafts and the rider (`craft-models.ts`), every kind
// of tree and undergrowth (`tree-models.ts`), every kind of instanced rock
// (`rock-models.ts`), the course's marks (`mark-models.ts`), every bird
// (`bird-models.ts`) and every animal (`fauna-models.ts`), each set only
// when its build switch is on. Stated
// apart from `renderer.ts` so the renderer's chunk re-exports one name.

import { loadBirdModels } from "./bird-models.ts";
import { loadModels as loadCraftModels } from "./craft-models.ts";
import { loadFaunaModels } from "./fauna-models.ts";
import { loadMarkModels } from "./mark-models.ts";
import { loadRockModels } from "./rock-models.ts";
import { loadTreeModels } from "./tree-models.ts";

export async function loadModels(): Promise<void> {
  await Promise.all([
    loadCraftModels(),
    loadTreeModels(),
    loadRockModels(),
    loadMarkModels(),
    loadBirdModels(),
    loadFaunaModels(),
  ]);
}
