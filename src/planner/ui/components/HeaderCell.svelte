<script lang="ts">
	import { format, parseISO } from "date-fns";
	import { getISODate } from "src/plugin/helpers";
	import type { ISODate } from "src/plugin/types";

	interface ViewProps {
		date: ISODate;
		openDailyNote: (date: ISODate) => void;
	}

	let {date, openDailyNote} = $props();

	function isToday(date: ISODate): boolean {
		return date === getISODate(new Date());
	}
</script>

<div class="header-cell" class:header-cell-today={isToday(date)}>
    <button
        class="date-card"
        class:today={isToday(date)}
        onclick={() => openDailyNote(date)}
        title="Click to open daily note"
    >
        <div class="dow-label">{format(parseISO(date), "EEE").toUpperCase()}</div>
        <div class="date-number">{format(parseISO(date), "d")}</div>
    </button>
    {#if isToday(date)}
        <div class="today-indicator"></div>
    {/if}
</div>

<style>
    .header-cell {
        padding: 10px 8px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        position: relative;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }

    .header-cell:last-child {
        border-right: none;
    }

    .today-indicator {
        position: absolute;
        bottom: 0;
        left: 10%;
        width: 80%;
        height: 2px;
        background: var(--interactive-accent, #7c5cbf);
        border-radius: 1px;
    }

    .date-card {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: start;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: filter 150ms ease;
        gap: 0;
        box-shadow: none;
    }

    .date-card:hover {
        filter: brightness(1.2);
    }

    .dow-label {
        font-size: 11px;
        font-weight: 600;
        color: #808080;
        text-transform: uppercase;
        letter-spacing: 1px;
        line-height: 1.4;
    }

    .date-number {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 28px;
        font-weight: 400;
        color: #cccccc;
        line-height: 1.1;
    }

    .date-card.today .dow-label {
        color: #b3b3b3;
    }

    .date-card.today .date-number {
        color: #e6e6e6;
    }
</style>
