<script lang="ts">
	interface EditableTextProps {
		value: string;
		onSave: (newValue: string) => void;
		onCtrlClick?: () => void;
		ctrlClickHint?: string;
		placeholder?: string;
		multiline?: boolean;
		class?: string;
	}

	let { 
		value, 
		onSave, 
		onCtrlClick,
		ctrlClickHint = "Ctrl/Cmd+Click to open file",
		placeholder = "", 
		multiline = false, 
		class: customClass = "" 
	}: EditableTextProps = $props();

	let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);
	let inputRef = $state<HTMLInputElement | HTMLTextAreaElement>();

	// Auto-focus when entering edit mode
	$effect(() => {
		if (isEditing && inputRef) {
			inputRef.focus();
			inputRef.select();
		}
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

		const trimmedText = editText.trim();
		if (trimmedText !== value) {
			onSave(trimmedText);
		}
		
		cancelEdit();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
			skipBlur = true;
			return;
		}

		if (e.key === 'Enter' && !e.shiftKey && !multiline) {
			e.preventDefault();
			saveEdit();
			skipBlur = true;
		} else if (e.key === 'Enter' && e.shiftKey && multiline) {
			e.preventDefault();
			saveEdit();
			skipBlur = true;
		}
	}

	function handleDisplayClick(e: MouseEvent) {
		if ((e.ctrlKey || e.metaKey) && onCtrlClick) {
			e.preventDefault();
			e.stopPropagation();
			onCtrlClick();
		}
	}
</script>

{#if isEditing}
	{#if multiline}
		<textarea
			bind:this={inputRef}
			bind:value={editText}
			onkeydown={handleKeydown}
			onblur={saveEdit}
			{placeholder}
			class={`editable-input ${customClass}`}
		></textarea>
	{:else}
		<input
			bind:this={inputRef}
			type="text"
			bind:value={editText}
			onkeydown={handleKeydown}
			onblur={saveEdit}
			{placeholder}
			class={`editable-input ${customClass}`}
		/>
	{/if}
{:else}
	<div 
		class={`editable-display ${onCtrlClick ? 'has-ctrl-click' : ''} ${customClass}`}
		data-ctrl-hint={onCtrlClick ? ctrlClickHint : ''}
		onclick={handleDisplayClick}
		ondblclick={startEdit} 
		role="button" 
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && startEdit()}
	>
		{value || placeholder}
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

	.editable-display.has-ctrl-click {
		position: relative;
	}

	.editable-display.has-ctrl-click:hover::after {
		content: attr(data-ctrl-hint);
		position: absolute;
		left: 0;
		top: calc(100% + 2px);
		font-size: 0.72em;
		color: var(--text-muted);
		background: var(--background-primary-alt);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 2px 6px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 2;
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
	}

	.editable-input:focus {
		outline: none;
		border-color: var(--interactive-accent-hover);
	}

	textarea.editable-input {
		min-height: 60px;
	}
</style>
