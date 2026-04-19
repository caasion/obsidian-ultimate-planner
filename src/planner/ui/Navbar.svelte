<script lang="ts">
	import { addDaysISO, getISODate } from "src/plugin/helpers";
	import type { ISODate } from "src/plugin/types";

	interface ViewProps {
		goTo: (date: ISODate) => void;
		incrementAmount: number;

		label: string;
		anchor: ISODate;

		view: string;
		toggleView: () => void;
	}

    let {goTo, incrementAmount, label, anchor}: ViewProps = $props();

    const today = getISODate(new Date());

	// Initialize an internal anchor (for the date input)
	let navBarAnchor = $state<ISODate>(anchor);
	
	// Keep internal anchor in sync
	$effect(() => {
		navBarAnchor = anchor;
	})

	$effect(() => {
		if (navBarAnchor !== anchor)
		goTo(navBarAnchor);
	})

</script>

<div class="header">
	<div class="nav-buttons">
		<button class="nav-btn" onclick={() => goTo(today)}>Today</button>
		<button class="nav-btn" onclick={() => goTo(addDaysISO(anchor, -incrementAmount))}>&lt;</button>
		<button class="nav-btn" onclick={() => goTo(addDaysISO(anchor, incrementAmount))}>&gt;</button>
	</div>
	<div class="week">
		<span class="week-label">{label}</span>
		<input type="date" bind:value={navBarAnchor} />
	</div>
</div>

<style>
		/* Navigation Menu */
	.header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		margin-bottom: 8px;
	}

	.nav-buttons {
		display: flex;
		gap: 4px;
	}

	.nav-btn {
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary-alt);
		color: var(--text-normal);
		cursor: pointer;
		padding: 4px 10px;
		font-size: 13px;
	}

	.nav-btn:hover {
		background: var(--background-modifier-hover);
	}

	.week {
		display: flex;
		justify-content: center;
		position: relative;
	}

	.week-label {
		font-weight: 600;
		font-size: 18px;
		text-align: center;
		padding: 4px 8px;
		display: inline-block;
		pointer-events: none;
	}

	.week input[type="date"] {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);

		width: 100%;
		height: 100%;
		z-index: 1;

		opacity: 0;
		cursor: pointer;
	}

	.week input[type="date"]::-webkit-calendar-picker-indicator {
		width: 100%;
		cursor: pointer;
	}

	.week input[type="date"]::-webkit-datetime-edit {
		display: none;
	}
</style>