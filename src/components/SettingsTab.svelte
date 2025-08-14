<script lang="ts">
    import type { ActionItem, UltimatePlannerPluginSettings } from '../SettingsTab';

    type SettingsProps = {
        settings: UltimatePlannerPluginSettings;
        save: (newSettings: UltimatePlannerPluginSettings) => void;
    }

    let {settings, save}: SettingsProps = $props();

    const updateAndSave = () => {
        settings = structuredClone(settings);
        save(settings);
    }

    const addActionItem = () => {
        settings.actionItems.push({ id: generateActionItemId(), label: "New", color: "#cccccc" });
        updateAndSave();
    }

    const removeActionItem = (id: number) => {
        settings.actionItems.splice(id, 1);
        updateAndSave();
    }

    const generateActionItemId = () => {
        return "ai-" + Math.random().toString(36).slice(2);
    }

</script>

<h2>Action Items</h2>
<button onclick={addActionItem}>+ Add</button>

{#each settings.actionItems as item, i (item.id)}
  <div>
    <input bind:value={item.label} oninput={updateAndSave} />
    <input type="color" bind:value={item.color} oninput={updateAndSave} />
    <button onclick={() => removeActionItem(i)}>Remove</button>
  </div>
{/each}