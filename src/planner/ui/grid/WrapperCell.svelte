<script lang="ts">
    import type { Element, Habit, ISODate, Project, Track, TrackData } from 'src/plugin/types';
    import type { TFile } from 'obsidian';
    import TaskElement from './TaskElement.svelte';
    import HabitPreviewElement from './HabitPreviewElement.svelte';
    import ScheduledTaskPreviewElement from './ScheduledTaskPreviewElement.svelte';
    import UnscheduledTasksPopup from './UnscheduledTasksPopup.svelte';
    import CircularProgress from './CircularProgress.svelte';
    import { calculateTotalTimeSpent, formatTimeArguments, reconstructRawText } from 'src/plugin/helpers';
    import { RRuleService } from 'src/tracks/logic/rrule';
    import { dndzone } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { longpress } from 'src/plugin/actions';

    interface Props {
        date: ISODate;
        showLabel: boolean;
        trackId: string;
        trackMeta: Track;
        trackData: TrackData | undefined;
        journalData: string | undefined;
        showProjectLabel?: boolean;
        onUpdate: (date: ISODate, trackId: string, updatedData: TrackData) => void;
        onAdd: (date: ISODate, trackId: string, trackMeta: Track, items?: Element[]) => void;
        onTrackOpen?: (trackId: string) => void;
        onTrackFileOpen?: (trackId: string) => void;
        onCloseProjectTask?: (trackId: string, sourceRef: string, taskStatus: ' ' | 'x') => void;
    }

    let {date, showLabel, trackId, trackMeta, trackData, journalData, showProjectLabel = true, onUpdate, onAdd, onTrackOpen, onTrackFileOpen, onCloseProjectTask}: Props = $props();

    const totalTimeSpent = $derived(trackData ? calculateTotalTimeSpent(trackData.items) : 0);
    const totalTimeCommitment = $derived(trackData ? trackData.time ? trackData.time : trackMeta.timeCommitment : trackMeta.timeCommitment);

    // Compute habits that occur on this date from the track's projects
    interface HabitPreview {
        habit: Habit;
        projectLabel: string;
        projectId: string;
    }

    let dismissedHabits = $state<Set<string>>(new Set());

    const habitsForDate = $derived.by(() => {
        const habits: HabitPreview[] = [];
        for (const project of Object.values(trackMeta.projects)) {
            for (const habit of Object.values(project.habits)) {
                if (RRuleService.occursOn(habit.rrule, date, project.startDate)) {
                    habits.push({ habit, projectLabel: project.label, projectId: project.id });
                }
            }
        }
        return habits;
    });

    const visibleHabits = $derived(
        habitsForDate.filter(h => !dismissedHabits.has(`${h.projectId}-${h.habit.id}`))
    );

    function dismissHabit(projectId: string, habitId: string) {
        dismissedHabits = new Set([...dismissedHabits, `${projectId}-${habitId}`]);
    }

    // Compute scheduled project tasks for this date
    interface ScheduledTaskPreview {
        element: Element;
        projectLabel: string;
        projectId: string;
        projectFile?: TFile;
    }

    let dismissedScheduledTasks = $state<Set<string>>(new Set());

    const scheduledTasksForDate = $derived.by(() => {
        const tasks: ScheduledTaskPreview[] = [];
        // Collect blockIds already inserted in the daily note
        const insertedBlockIds = new Set<string>();
        if (trackData) {
            for (const item of trackData.items) {
                if (item.sourceRef) {
                    const match = item.sourceRef.match(/\[\[[^\]]+#\^([a-zA-Z0-9]+)\]\]/);
                    if (match) insertedBlockIds.add(match[1]);
                }
            }
        }

        for (const project of Object.values(trackMeta.projects)) {
            const collectFromElements = (elements: Element[]) => {
                for (const el of elements) {
                    if (el.scheduledDate === date && el.blockId
                        && el.taskStatus !== 'x' && el.taskStatus !== '-'
                        && !insertedBlockIds.has(el.blockId)) {
                        tasks.push({ element: el, projectLabel: project.label, projectId: project.id, projectFile: project.file });
                    }
                }
            };
            collectFromElements(project.data);
            for (const phase of project.phases) {
                collectFromElements(phase.data);
            }
        }
        return tasks;
    });

    const visibleScheduledTasks = $derived(
        scheduledTasksForDate.filter(t => !dismissedScheduledTasks.has(`${t.projectId}-${t.element.blockId}`))
    );

    function dismissScheduledTask(projectId: string, blockId: string) {
        dismissedScheduledTasks = new Set([...dismissedScheduledTasks, `${projectId}-${blockId}`]);
    }

    const hasPreviewItems = $derived(visibleHabits.length > 0 || visibleScheduledTasks.length > 0);

    function insertItems() {
        const habitItems: Element[] = visibleHabits.map(({ habit, projectLabel }) => {
            const text = `↻ ${habit.label} [[${projectLabel}]]`;
            const raw = reconstructRawText(text, true, ' ', undefined, undefined, undefined, undefined);
            return {
                raw,
                text,
                children: [],
                isTask: true,
                taskStatus: ' ' as const,
            };
        });

        const scheduledItems: Element[] = visibleScheduledTasks.map(({ element: el, projectLabel, projectFile }) => {
            const fileName = projectFile?.basename ?? projectLabel;
            const sourceRef = `[[${fileName}#^${el.blockId}]]`;
            const raw = reconstructRawText(el.text, true, ' ', el.startTime, el.progress, el.duration, el.timeUnit, '\t- ', sourceRef);
            return {
                raw,
                text: el.text,
                children: [],
                isTask: true,
                taskStatus: ' ' as const,
                startTime: el.startTime,
                progress: el.progress,
                duration: el.duration,
                timeUnit: el.timeUnit,
                sourceRef,
            };
        });

        onAdd(date, trackId, trackMeta, [...habitItems, ...scheduledItems]);
    }

    /* Unscheduled tasks popup */
    let showUnscheduledPopup = $state(false);
    let addButtonEl = $state<HTMLElement | undefined>(undefined);

    const unscheduledGroups = $derived.by(() => {
        const groups: { project: Project; elements: { element: Element; index: number }[] }[] = [];
        for (const project of Object.values(trackMeta.projects)) {
            const elements: { element: Element; index: number }[] = [];
            const collectUnscheduled = (els: Element[]) => {
                els.forEach((el, i) => {
                    if (el.isTask && !el.scheduledDate && el.taskStatus === ' ') {
                        elements.push({ element: el, index: i });
                    }
                });
            };
            collectUnscheduled(project.data);
            for (const phase of project.phases) {
                collectUnscheduled(phase.data);
            }
            if (elements.length > 0) {
                groups.push({ project, elements });
            }
        }
        return groups;
    });

    function handleAddLongpress() {
        showUnscheduledPopup = true;
    }

    function handleUnscheduledSelect(element: Element, project: Project) {
        const fileName = project.file?.basename ?? project.label;
        const sourceRef = element.blockId ? `[[${fileName}#^${element.blockId}]]` : undefined;
        const newElement: Element = {
            raw: '',
            text: element.text,
            children: [],
            isTask: true,
            taskStatus: ' ' as const,
            startTime: element.startTime,
            progress: element.progress,
            duration: element.duration,
            timeUnit: element.timeUnit,
            sourceRef,
        };
        if (trackData) {
            onUpdate(date, trackId, { ...trackData, items: [...trackData.items, newElement] });
        } else {
            onAdd(date, trackId, trackMeta, [newElement]);
        }
    }

    function handleLabelClick(event: MouseEvent) {
        if (event.ctrlKey || event.metaKey) {
            onTrackFileOpen?.(trackId);
        } else {
            onTrackOpen?.(trackId);
        }
    }

    function updateElement(index: number, updatedElement: Element) {
        if (!trackData) return;
        const updatedItems = [...trackData.items];
        const raw = reconstructRawText(
            updatedElement.text,
            updatedElement.isTask,
            updatedElement.taskStatus,
            updatedElement.startTime,
            updatedElement.progress,
            updatedElement.duration,
            updatedElement.timeUnit,
            '\t- ',
            updatedElement.sourceRef,
            updatedElement.scheduledDate,
            updatedElement.blockId
        );
        updatedItems[index] = { ...updatedElement, raw };
        onUpdate(date, trackId, { ...trackData, items: updatedItems });
    }

    function toggleTask(index: number) {
        if (!trackData) return;
        const updatedItems = [...trackData.items];
        const element = updatedItems[index];
        if (element.isTask) {
            const newTaskStatus = element.taskStatus == ' ' ? 'x' : ' ';
            const raw = reconstructRawText(
                element.text, element.isTask, newTaskStatus,
                element.startTime, element.progress, element.duration, element.timeUnit,
                '\t- ', element.sourceRef, element.scheduledDate, element.blockId
            );
            updatedItems[index] = { ...element, taskStatus: newTaskStatus, raw };
            onUpdate(date, trackId, { ...trackData, items: updatedItems });
        }
    }

    function closeProjectTask(index: number) {
        if (!trackData) return;
        const element = trackData.items[index];
        if (!element.sourceRef) return;
        const newTaskStatus: ' ' | 'x' = element.taskStatus === 'x' ? ' ' : 'x';
        // Sync status in daily note
        if (element.isTask) {
            const updatedItems = [...trackData.items];
            const raw = reconstructRawText(
                element.text, element.isTask, newTaskStatus,
                element.startTime, element.progress, element.duration, element.timeUnit,
                '\t- ', element.sourceRef, element.scheduledDate, element.blockId
            );
            updatedItems[index] = { ...element, taskStatus: newTaskStatus, raw };
            onUpdate(date, trackId, { ...trackData, items: updatedItems });
        }
        // Sync status to source (source of truth)
        onCloseProjectTask?.(trackId, element.sourceRef, newTaskStatus);
    }

    function cancelTask(index: number) {
        if (!trackData) return;
        const updatedItems = [...trackData.items];
        const element = updatedItems[index];
        if (element.isTask) {
            const raw = reconstructRawText(
                element.text, element.isTask, '-',
                element.startTime, element.progress, element.duration, element.timeUnit,
                '\t- ', element.sourceRef, element.scheduledDate, element.blockId
            );
            updatedItems[index] = { ...element, taskStatus: '-', raw };
            onUpdate(date, trackId, { ...trackData, items: updatedItems });
        }
    }

    function deleteElement(index: number) {
        if (!trackData) return;
        const updatedItems = trackData.items.filter((_, i) => i !== index);
        onUpdate(date, trackId, { ...trackData, items: updatedItems });
    }

    function addNewElement(isTask: boolean) {
        const newElement: Element = { raw: '', text: '', children: [], isTask };
        if (trackData) {
            onUpdate(date, trackId, { ...trackData, items: [...trackData.items, newElement] });
        } else {
            onAdd(date, trackId, trackMeta);
        }
    }

    function getProjectLabel(element: Element): string | undefined {
        if (element.sourceRef) {
            // [[FileName#^blockId]] → FileName
            const match = element.sourceRef.match(/\[\[([^\]#]+)(?:#[^\]]+)?\]\]/);
            return match?.[1];
        }
        if (element.text.startsWith('↻ ')) {
            // Habit: "↻ Label [[ProjectLabel]]"
            const match = element.text.match(/\[\[([^\]]+)\]\]\s*$/);
            return match?.[1];
        }
        return undefined;
    }

    /* Drag and Drop */
    let elementToId = $state(new Map<Element, number>());
    let nextId = $state(0);
    let items = $state<any[]>([]);
    let isDragging = $state(false);

    $effect(() => {
        if (!isDragging && trackData) {
            items = trackData.items.map((element) => {
                if (!elementToId.has(element)) {
                    elementToId.set(element, nextId++);
                }
                return { id: elementToId.get(element)!, element };
            });
        }
    });

    function handleDndConsider(e: { detail: { items: any[] } }) {
        isDragging = true;
        items = e.detail.items;
    }

    function handleDndFinalize(e: { detail: { items: any[] } }) {
        if (!trackData) return;
        isDragging = false;
        const reorderedElements = e.detail.items.map(item => item.element);
        onUpdate(date, trackId, { ...trackData, items: reorderedElements });
    }
</script>

<div class="cell" style={`background-color: ${trackMeta.color}10;`}>
    <div class="cell-header">
        {#if showLabel}
            <button
                class="row-label"
                style={`background-color: ${trackMeta.color}30; color: ${trackMeta.color};`}
                onclick={handleLabelClick}
                title="Click to open Tracks view • Ctrl+click to open track file"
            >
                {trackMeta.label}
            </button>
        {/if}

        <div class="item-data-container">
            {#if journalData}
                <div class="journal-indicator">
                    <span class="journal-icon" title={journalData}>📜</span>
                </div>
            {/if}
            {#if trackData}
                {@const {dividend: progress, divisor: duration, unit} = formatTimeArguments(totalTimeSpent, totalTimeCommitment)}
                <div class="progress-circle">
                    <CircularProgress {progress} {duration} {unit} size={20} />
                    <span class="time-badge" style={`background-color: ${trackMeta.color}80;`}>
                        {duration} {unit}
                    </span>
                </div>
            {/if}
        </div>
        {#if trackData}
        <button
            bind:this={addButtonEl}
            class="add-button"
            onclick={() => addNewElement(true)}
            use:longpress={500}
            onlongpress={handleAddLongpress}
            title="Add new item • Hold for unscheduled tasks"
        >+</button>
        {/if}
    </div>

    {#if showUnscheduledPopup}
        <UnscheduledTasksPopup
            groups={unscheduledGroups}
            color={trackMeta.color}
            anchorEl={addButtonEl}
            onSelect={handleUnscheduledSelect}
            onClose={() => showUnscheduledPopup = false}
        />
    {/if}

    {#if trackData}
        <div
            class="elements-container"
            use:dndzone={{
                items,
                flipDurationMs: 200,
                dropTargetStyle: { outline: `1px dashed ${trackMeta.color}`, background: `${trackMeta.color}15` }
            }}
            onconsider={handleDndConsider}
            onfinalize={handleDndFinalize}
        >
            {#each items as {id, element}, index (id)}
                <div animate:flip={{ duration: 200 }}>
                    <TaskElement
                        {element}
                        {index}
                        color={trackMeta.color}
                        projectLabel={getProjectLabel(element)}
                        {showProjectLabel}
                        onUpdate={updateElement}
                        onDelete={deleteElement}
                        onToggle={toggleTask}
                        onCancel={cancelTask}
                        onCloseProjectTask={closeProjectTask}
                    />
                </div>
            {/each}
        </div>
    {:else}
        <div class="empty-cell">
            {#if hasPreviewItems}
                <div class="preview-list">
                    {#each visibleHabits as { habit, projectLabel, projectId }}
                        <HabitPreviewElement
                            {habit}
                            {projectLabel}
                            color={trackMeta.color}
                            {showProjectLabel}
                            onDismiss={() => dismissHabit(projectId, habit.id)}
                        />
                    {/each}
                    {#each visibleScheduledTasks as { element, projectLabel, projectId }}
                        <ScheduledTaskPreviewElement
                            {element}
                            {projectLabel}
                            color={trackMeta.color}
                            {showProjectLabel}
                            onDismiss={() => dismissScheduledTask(projectId, element.blockId!)}
                        />
                    {/each}
                </div>
                <button
                    class="add-button-empty"
                    onclick={insertItems}
                    title="Insert items into daily note"
                >+ Insert Items</button>
            {:else}
                <div class="section-empty-state">No items yet.</div>
                <button
                    class="add-button-empty"
                    onclick={() => addNewElement(true)}
                    title="Add new item"
                >+ Add</button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .row-label {
        padding: 4px 10px;
        border-radius: 6px;
        border: none;
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 0.82em;
        width: fit-content;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .row-label:hover {
        opacity: 0.85;
    }

    .cell {
        display: flex;
        flex-direction: column;
        padding: 4px;
        border-right: 1px dotted var(--background-modifier-border);
        border-bottom: 1px dashed var(--background-modifier-border);
        border-collapse: collapse;
        min-height: 40px;
    }

    .cell-header {
        display: grid;
        grid-template-columns: 1fr auto auto;
        width: 100%;
    }

    .add-button {
        background: transparent;
        color: var(--text-muted);
        border: none;
        border-radius: 25%;
        width: 24px;
        height: 24px;
        font-size: 1.2em;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
        transition: opacity 0.2s ease;
        opacity: 0.8;
    }

    .add-button:hover {
        opacity: 1;
        background: var(--background-modifier-hover);
    }

    .add-button-empty {
		padding: 4px 12px;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.85em;
        transition: all 0.2s;
        opacity: 0.8;
    }

    .add-button-empty:hover {
        opacity: 1;
        background: var(--background-modifier-hover);
    }

    .item-data-container {
        grid-column: 2;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .progress-circle {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .section-empty-state {
		padding: 12px;
		text-align: center;
		color: var(--text-faint);
		font-style: italic;
		font-size: 0.9em;
	}

    .time-badge {
        font-size: 0.85em;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
    }

    .elements-container {
        min-height: 1em;
    }

    .empty-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
    }

    .preview-list {
        width: 100%;
    }
</style>
