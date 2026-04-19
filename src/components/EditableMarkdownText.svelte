<script lang="ts">
	import { Component, MarkdownRenderer } from "obsidian";
	import type { App } from "obsidian";

	interface EditableMarkdownTextProps {
		app: App;
		value: string;
		onSave: (newValue: string) => void;
		sourcePath?: string;
		placeholder?: string;
		class?: string;
	}

	let {
		app,
		value,
		onSave,
		sourcePath = "",
		placeholder = "",
		class: customClass = ""
	}: EditableMarkdownTextProps = $props();

	let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);
	let inputRef = $state<HTMLTextAreaElement>();
	let markdownRef = $state<HTMLDivElement>();
	let renderComponent: Component | null = null;

	$effect(() => {
		if (isEditing && inputRef) {
			inputRef.focus();
		}
	});

	$effect(() => {
		return () => {
			renderComponent?.unload();
			renderComponent = null;
		};
	});

	$effect(() => {
		if (isEditing || !markdownRef) return;

		const renderContainer = markdownRef;
		renderContainer.empty();

		const markdown = value.trim();
		if (!markdown) return;

		renderComponent?.unload();
		const currentComponent = new Component();
		renderComponent = currentComponent;

		const renderMarkdown = async () => {
			try {
				await MarkdownRenderer.render(app, markdown, renderContainer, sourcePath, currentComponent);
			} catch {
				renderContainer.setText(markdown);
			}
		};

		void renderMarkdown();
	});

	function startEdit() {
		isEditing = true;
		editText = value;
	}

	function cancelEdit() {
		isEditing = false;
		editText = "";
		skipBlur = false;
	}

	function saveEdit() {
		if (skipBlur) {
			skipBlur = false;
			return;
		}

		if (editText !== value) {
			onSave(editText);
		}

		cancelEdit();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault();
			cancelEdit();
			skipBlur = true;
			return;
		}

		if (e.key === "Enter" && e.shiftKey) {
			e.preventDefault();
			saveEdit();
			skipBlur = true;
		}
	}

	function handleDisplayKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			startEdit();
		}
	}
</script>

{#if isEditing}
	<textarea
		bind:this={inputRef}
		bind:value={editText}
		onkeydown={handleKeydown}
		onblur={saveEdit}
		{placeholder}
		class={`editable-input ${customClass}`}
	></textarea>
{:else}
	<div
		class={`editable-display ${customClass}`}
		ondblclick={startEdit}
		role="button"
		tabindex="0"
		onkeydown={handleDisplayKeydown}
	>
		{#if value.trim()}
			<div class="editable-markdown" bind:this={markdownRef}></div>
		{:else}
			{placeholder}
		{/if}
	</div>
{/if}

<style>
	.editable-display {
		cursor: text;
		padding-top: 2px;
		border-radius: 2px;
		min-height: 1.5em;
		width: 100%;
	}

	.editable-display:hover {
		background-color: var(--background-modifier-hover);
	}

	.editable-input {
		width: 100%;
		padding: 2px 4px;
		border: 1px solid var(--interactive-accent);
		border-radius: 2px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-family: inherit;
		font-size: inherit;
		resize: vertical;
		min-height: 60px;
	}

	.editable-input:focus {
		outline: none;
		border-color: var(--interactive-accent-hover);
	}

	.editable-markdown :global(p:first-child) {
		margin-top: 0;
	}

	.editable-markdown :global(p:last-child) {
		margin-bottom: 0;
	}
</style>