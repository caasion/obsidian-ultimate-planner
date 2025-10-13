// Migrate from Version 3 to Version 4

import { get } from "svelte/store";
import { actionItems, updateActionItem } from "./state/plannerStore";

export function migrateToVersion4() {
    for (const key in Object.keys(get(actionItems))) {
        updateActionItem(key, {id: key});
    }
}

