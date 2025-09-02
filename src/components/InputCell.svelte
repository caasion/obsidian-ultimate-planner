<script lang="ts">
    import { onMount } from "svelte";
    import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
    import { nord } from "@milkdown/theme-nord";
    import { history } from "@milkdown/kit/plugin/history";
    import { listener, listenerCtx } from "@milkdown/kit/plugin/listener"
    import { commonmark } from "@milkdown/preset-commonmark";

    let { date, rowID, setCell, getCell, row, col, handleKeyDown, focusCell } = $props();

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
                        // queueMicrotask(() => {
                        //     focusCell?.(row, col)
                        // })
                    })
                    .markdownUpdated((_, markdown) => {
                        setCell(date, rowID, markdown);
                    })
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
