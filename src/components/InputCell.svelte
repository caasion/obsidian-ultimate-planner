<script lang="ts">
    import { onMount } from "svelte";
    import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
    import { nord } from "@milkdown/theme-nord";
    import { history } from "@milkdown/kit/plugin/history";
    import { listener, listenerCtx } from "@milkdown/kit/plugin/listener"
    import { commonmark } from "@milkdown/preset-commonmark";
    import { keymap } from '@milkdown/prose/keymap';
    import { prosePluginsCtx } from "@milkdown/core";

    let { date, rowID, setCell, getCell, row, col, focusCell } = $props();

    let container: HTMLDivElement;
    let editorInstance: Editor | null = null;
    let alive = true;

    onMount(() => {
        Editor.make()
            .config(nord)
            .use(listener)
            .config((ctx) => {
                ctx.set(rootCtx, container);
                ctx.set(defaultValueCtx, getCell(date, rowID));

                // Listen for changes
                ctx.get(listenerCtx)
                    .focus(() => {
                        focusCell(row, col, true);
                    })
                    .markdownUpdated((_, markdown) => {
                        setCell(date, rowID, markdown);
                    });

                ctx.update(prosePluginsCtx, (plugins) => [
                    keymap({
                        Tab: () => {
                            const moved = focusCell(row, col + 1, /*fromEditor=*/false);
                            return !!moved; // true = stop PM’s default tab behavior
                        },
                        "Shift-Tab": () => {
                            const moved = focusCell(row, col - 1, false);
                            return !!moved;
                        },
                    }),
                    ...plugins,
                ])
            })
            .use(commonmark)
            .use(history)
            .create()
            .then((editor) => {
                if (!alive) {
                    editor.destroy();
                    return;
                }
                editorInstance = editor;
            });
        
        console.log("mount", row, col)

        return () => {
            alive = false;
            if (editorInstance) {
                editorInstance.destroy();
                editorInstance = null;
            }
        }
    })
</script>

<div 
    id={`cell-${row}-${col}`} 
    bind:this={container}
    tabIndex="0"
    class="milkdown-editor"
></div>

<style>
	.milkdown-editor {
		min-height: 4em;
		border: 1px solid var(--interactive-normal);
		padding: 4px;
		border-radius: 4px;
		background-color: var(--background-primary);
	}
</style>
