<script lang="ts">
	import { longpress } from "src/plugin/actions";

	interface Props {
		status: ' ' | '/' | 'x' | '-';
		onToggle: () => void;
		onCancel: () => void;
	}

	let { status, onToggle, onCancel }: Props = $props();

	const clipId = `half-${Math.random().toString(36).slice(2, 8)}`;
	let buttonRef = $state<HTMLButtonElement>();

	// Handle longpress event for cancel
	$effect(() => {
		if (buttonRef) {
			const handler = () => onCancel();
			buttonRef.addEventListener('longpress', handler);
			return () => buttonRef?.removeEventListener('longpress', handler);
		}
	});
</script>

<button
	bind:this={buttonRef}
	class="task-checkbox-btn"
	class:task-checkbox-unchecked={status === ' '}
	class:task-checkbox-partial={status === '/'}
	class:task-checkbox-checked={status === 'x'}
	class:task-checkbox-cancelled={status === '-'}
	onclick={onToggle}
	use:longpress={500}
	title={status === ' ' ? 'Mark partial' : status === '/' ? 'Mark done' : status === 'x' ? 'Uncheck' : 'Cancelled'}
>
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
		<!-- Checkbox border (always visible) -->
		<rect
			x="1" y="1" width="14" height="14" rx="3" ry="3"
			class="checkbox-border"
		/>

		{#if status === '/'}
			<!-- Partial: bottom-half fill + slash -->
			<defs>
				<clipPath id={clipId}>
					<rect x="0" y="8" width="16" height="8" />
				</clipPath>
			</defs>
			<rect
				x="1" y="1" width="14" height="14" rx="3" ry="3"
				class="checkbox-partial-fill"
				clip-path="url(#{clipId})"
			/>
			<line x1="11.5" y1="3.5" x2="4.5" y2="12.5" class="checkbox-slash" />
		{:else if status === 'x'}
			<!-- Completed: full accent fill + checkmark -->
			<rect
				x="1" y="1" width="14" height="14" rx="3" ry="3"
				class="checkbox-checked-fill"
			/>
			<polyline
				points="4.5,8.5 7,11 11.5,5.5"
				class="checkbox-checkmark"
			/>
		{:else if status === '-'}
			<!-- Cancelled: gray fill + dash -->
			<rect
				x="1" y="1" width="14" height="14" rx="3" ry="3"
				class="checkbox-cancelled-fill"
			/>
			<line x1="4.5" y1="8" x2="11.5" y2="8" class="checkbox-cancelled-dash" />
		{/if}
	</svg>
</button>

<style>
	.task-checkbox-btn {
		cursor: pointer;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		box-shadow: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.task-checkbox-btn:hover {
		box-shadow: none;
		opacity: 0.85;
	}

	/* Border */
	.checkbox-border {
		fill: none;
		stroke: var(--checkbox-border-color, var(--interactive-accent));
		stroke-width: 1.5;
	}

	.task-checkbox-checked .checkbox-border,
	.task-checkbox-cancelled .checkbox-border {
		stroke: transparent;
	}

	/* Partial: half fill */
	.checkbox-partial-fill {
		fill: var(--interactive-accent);
	}

	.checkbox-slash {
		stroke: var(--text-on-accent, #fff);
		stroke-width: 1.8;
		stroke-linecap: round;
		fill: none;
	}

	/* Checked: full fill */
	.checkbox-checked-fill {
		fill: var(--interactive-accent);
	}

	.checkbox-checkmark {
		fill: none;
		stroke: var(--text-on-accent, #fff);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Cancelled: gray fill */
	.checkbox-cancelled-fill {
		fill: var(--text-faint, #999);
	}

	.checkbox-cancelled-dash {
		stroke: var(--background-primary, #fff);
		stroke-width: 2;
		stroke-linecap: round;
	}
</style>
