<script lang="ts">
    import { onMount } from "svelte";
    import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
    import { nord } from "@milkdown/theme-nord";
    import { history } from "@milkdown/kit/plugin/history";
    import { listener, listenerCtx } from "@milkdown/kit/plugin/listener"
    import { commonmark } from "@milkdown/preset-commonmark";

    type MarkdownCellProps = {
        value: string,
        onChange: (value: string) => void,
    }

    let { value, onChange}: MarkdownCellProps = $props();

    let container: HTMLDivElement;
    let editorInstance: Editor | null = null;
    let alive = true;

    onMount(() => {
        Editor.make()
            .config(nord)
            .config((ctx) => {
                ctx.set(rootCtx, container);
                ctx.set(defaultValueCtx, value);

                // Listen for changes
                ctx.get(listenerCtx)
                    .markdownUpdated((_, markdown) => {
                        onChange(markdown);
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

        return () => {
            alive = false;
            if (editorInstance) {
                editorInstance.destroy();
                editorInstance = null;
            }
        }
    })
</script>

<div bind:this={container} class="milkdown-editor"></div>

<style>
	.milkdown-editor {
		min-height: 4em;
		border: 1px solid var(--interactive-normal);
		padding: 4px;
		border-radius: 4px;
		background-color: var(--background-primary);
	}
</style>