<!-- 
  Based on Flowbite Svelte Datepicker
  Original source: https://github.com/themesberg/flowbite-svelte
  License: MIT
  Modified for standalone use
-->

<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade } from "svelte/transition";
  import { parse, isValid, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
  import Portal from "src/components/Portal.svelte";

  let {
    value = $bindable(),
    defaultDate = null,
    range = false,
    rangeFrom = $bindable(),
    rangeTo = $bindable(),
    availableFrom = null,
    availableTo = null,
    locale = "default",
    translationLocale = undefined,
    firstDayOfWeek = 0,
    dateFormat = undefined,
    placeholder = "Select date",
    openEndedLabel = "Present",
    rangeSeparator = " -> ",
    disabled = false,
    required = false,
    inputClass = "",
    inline = false,
    autohide = true,
    showActionButtons = false,
    title = "",
    onselect = undefined,
    onclear = undefined,
    onapply = undefined,
    btnClass = "",
    showToggleButton = true,
    inputmode = "none" as HTMLInputElement["inputMode"],
    classes = {},
    class: className = "",
    elementRef = $bindable(),
    actionSlot = undefined,
    inputProps = {}
  } = $props();

  const cx = (...values: Array<string | undefined | null | false>) => values.filter(Boolean).join(" ");
  const normalizeFirstDayOfWeek = (day: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 => ((((day % 7) + 7) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  type InputMode = "none" | "text" | "search" | "numeric" | "tel" | "url" | "email" | "decimal";
  const VALID_INPUT_MODES: InputMode[] = ["none", "text", "search", "numeric", "tel", "url", "email", "decimal"];

  let weekStartsOn = $derived(normalizeFirstDayOfWeek(Number(firstDayOfWeek) || 0));
  let resolvedInputMode = $derived((VALID_INPUT_MODES.includes(inputmode as InputMode) ? (inputmode as InputMode) : "none"));

  // If translationLocale is not explicitly provided, it will default to the value of locale. This ensures reactivity as both are directly exposed as props.
  const finalTranslationLocale = $derived(translationLocale ?? locale);

  let isOpen: boolean = $state(false);
  $effect(() => {
    isOpen = inline;
  });
  let showMonthSelector: boolean = $state(false);
  let datepickerContainerElement: HTMLDivElement;
  let currentMonth: Date = $state(new Date());
  $effect(() => {
    currentMonth = value || defaultDate || new Date();
  });
  let focusedDate: Date | null = null;
  let calendarRef: HTMLDivElement | null = $state(null);
  let portalStyle: string = $state("");

  let daysInMonth = $derived(getDaysInMonth(currentMonth));

  onMount(() => {
    if (!inline) {
      const doc = datepickerContainerElement?.ownerDocument ?? document;
      doc.addEventListener("click", handleClickOutside);
      doc.addEventListener("keydown", handleDocumentKeydown);
      return () => {
        doc.removeEventListener("click", handleClickOutside);
        doc.removeEventListener("keydown", handleDocumentKeydown);
      };
    }
  });

  function closeDatepicker(restoreInputFocus = false) {
    isOpen = false;
    showMonthSelector = false;
    if (restoreInputFocus) {
      elementRef?.focus();
    }
  }

  async function updatePortalPosition() {
    if (inline) return;
    await tick();
    const rect = datepickerContainerElement?.getBoundingClientRect();
    if (!rect) return;
    portalStyle = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:var(--layer-popover, 100);`;
  }

  function getDaysInMonth(date: Date): Date[] {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }

  const getWeekdayNames = (): string[] => {
    const referenceDate = new Date(1970, 0, 4 + weekStartsOn);
    return Array.from({ length: 7 }, (_, i) => addDays(referenceDate, i).toLocaleDateString(finalTranslationLocale, { weekday: "short" }));
  };

  let weekdays = $derived(getWeekdayNames());

  const getMonthNames = (): string[] => {
    return Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(finalTranslationLocale, { month: "short" }));
  };
  let monthNames = $derived(getMonthNames());

  const addDay = (date: Date, increment: number): Date => addDays(date, increment);

  function changeMonth(increment: number) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1);
  }

  function changeYear(increment: number) {
    currentMonth = new Date(currentMonth.getFullYear() + increment, currentMonth.getMonth(), 1);
  }

  function selectMonth(monthIndex: number, event: MouseEvent) {
    event.stopPropagation();
    currentMonth = new Date(currentMonth.getFullYear(), monthIndex, 1);
    showMonthSelector = false;
  }

  function toggleMonthSelector(event: MouseEvent) {
    event.stopPropagation();
    showMonthSelector = !showMonthSelector;
  }

  function isDateAvailable(date: Date): boolean {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (availableFrom) {
      const fromDate = new Date(availableFrom.getFullYear(), availableFrom.getMonth(), availableFrom.getDate());
      if (dateOnly < fromDate) return false;
    }

    if (availableTo) {
      const toDate = new Date(availableTo.getFullYear(), availableTo.getMonth(), availableTo.getDate());
      if (dateOnly > toDate) return false;
    }

    return true;
  }

  function handleDaySelect(day: Date) {
    if (!isDateAvailable(day)) return;

    if (range) {
      if (!rangeFrom || (rangeFrom && rangeTo)) {
        rangeFrom = day;
        rangeTo = undefined;
      } else if (day < rangeFrom) {
        const oldRangeFrom = rangeFrom;
        rangeFrom = day;
        rangeTo = oldRangeFrom;
      } else {
        rangeTo = day;
      }
      onselect?.({ from: rangeFrom, to: rangeTo });
    } else {
      value = day;
      onselect?.(value);
      if (autohide && !inline) isOpen = false;
    }
  }

  function handleInputChangeWithDateFns() {
    const inputValue = elementRef?.value?.trim();
    if (!inputValue) {
      rangeFrom = undefined;
      rangeTo = undefined;
      elementRef?.setCustomValidity("");
      return;
    }

    elementRef?.setCustomValidity("");

    if (range) {
      const parts = inputValue.includes(rangeSeparator)
        ? inputValue.split(rangeSeparator)
        : inputValue.includes(" - ")
          ? inputValue.split(" - ")
          : inputValue.includes(" -> ")
            ? inputValue.split(" -> ")
            : [];
      if (parts.length === 2) {
        const parsedFrom = tryParseDate(parts[0].trim());
        const parsedToInput = parts[1].trim();
        const isOpenEnded = parsedToInput.toLowerCase() === openEndedLabel.toLowerCase();
        const parsedTo = isOpenEnded ? undefined : tryParseDate(parsedToInput);

        if (parsedFrom && isValid(parsedFrom) && isDateAvailable(parsedFrom) && (isOpenEnded || (parsedTo && isValid(parsedTo) && isDateAvailable(parsedTo)))) {
          if (parsedTo) {
            [rangeFrom, rangeTo] = parsedFrom > parsedTo ? [parsedTo, parsedFrom] : [parsedFrom, parsedTo];
          } else {
            rangeFrom = parsedFrom;
            rangeTo = undefined;
          }
          onselect?.({ from: rangeFrom, to: rangeTo });
          return;
        } else {
          elementRef?.setCustomValidity(`Please enter date range in format: ${getDateFormatPattern()}${rangeSeparator}${getDateFormatPattern()} (or ${openEndedLabel})`);
          return;
        }
      }
    }

    const parsedDate = tryParseDate(inputValue);

    if (!parsedDate || !isValid(parsedDate)) {
      const formatPattern = getDateFormatPattern();
      elementRef?.setCustomValidity(`Please enter date in format: ${formatPattern}`);
      return;
    }

    if (!isDateAvailable(parsedDate)) {
      elementRef?.setCustomValidity("Selected date is not available");
      return;
    }

    handleDaySelect(parsedDate);
  }

  function tryParseDate(inputValue: string): Date | null {
    const formatPattern = getDateFormatPattern();
    try {
      const parsedDate = parse(inputValue, formatPattern, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (error) {
      // Continue to next strategy
    }

    const commonFormats = [
      "d.M.yyyy", // German: 17.7.2025
      "dd.MM.yyyy", // German: 17.07.2025
      "M/d/yyyy", // US: 7/17/2025
      "MM/dd/yyyy", // US: 07/17/2025
      "d/M/yyyy", // UK: 17/7/2025
      "dd/MM/yyyy", // UK: 17/07/2025
      "yyyy-MM-dd", // ISO: 2025-07-17
      "yyyy-M-d", // ISO: 2025-7-17
      "M-d-yyyy", // US with dashes: 7-17-2025
      "d-M-yyyy" // EU with dashes: 17-7-2025
    ];

    for (const format of commonFormats) {
      try {
        const parsedDate = parse(inputValue, format, new Date());
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      } catch (error) {
        // Continue to next format
      }
    }

    try {
      const nativeDate = new Date(inputValue);
      if (isValid(nativeDate) && !isNaN(nativeDate.getTime())) {
        return nativeDate;
      }
    } catch (error) {
      // Continue
    }

    return null;
  }

  function getDateFormatPattern(): string {
    const actualLocale = locale === "default" ? navigator.language : locale;
    const testDate = new Date(2025, 0, 15); // January 15, 2025
    const formatted = testDate.toLocaleDateString(actualLocale, dateFormat || { year: "numeric", month: "numeric", day: "numeric" });

    if (formatted.includes(".")) {
      // German/European format with dots
      if (formatted.startsWith("15.")) {
        return "d.M.yyyy";
      } else if (formatted.startsWith("01.")) {
        return "M.d.yyyy";
      }
      return "d.M.yyyy"; // Default to day first
    } else if (formatted.includes("/")) {
      // US/UK format with slashes
      if (formatted.startsWith("1/")) {
        return "M/d/yyyy"; // US format
      } else if (formatted.startsWith("15/")) {
        return "d/M/yyyy"; // UK format
      }

      const testDate2 = new Date(2025, 11, 3); // December 3, 2025
      const formatted2 = testDate2.toLocaleDateString(actualLocale, dateFormat || { year: "numeric", month: "numeric", day: "numeric" });
      if (formatted2.startsWith("3/") || formatted2.startsWith("03/")) {
        return "d/M/yyyy";
      } else {
        return "M/d/yyyy";
      }
    } else if (formatted.includes("-")) {
      // ISO or other dash format
      if (formatted.startsWith("2025-")) {
        return "yyyy-M-d";
      } else if (formatted.startsWith("1-")) {
        return "M-d-yyyy";
      } else {
        return "d-M-yyyy";
      }
    }

    // Default fallback - try to detect based on locale
    if (actualLocale.startsWith("en-US")) {
      return "M/d/yyyy";
    } else if (actualLocale.startsWith("de") || actualLocale.startsWith("at") || actualLocale.startsWith("ch")) {
      return "d.M.yyyy";
    } else if (actualLocale.startsWith("en-GB") || actualLocale.startsWith("en-AU")) {
      return "d/M/yyyy";
    }

    return "M/d/yyyy";
  }

  function handleClickOutside(event: MouseEvent) {
    if (!isOpen) return;
    const target = event.target as Node;
    if (datepickerContainerElement?.contains(target) || calendarRef?.contains(target)) return;
    closeDatepicker();
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    if (!isOpen || event.key !== "Escape") return;
    event.preventDefault();
    closeDatepicker(true);
  }

  function handlePanelKeydown(event: KeyboardEvent) {
    if (!isOpen || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeDatepicker(true);
  }

  // Use locale for formatting (not finalTranslationLocale)
  const formatDate = (date?: Date): string => date?.toLocaleDateString(locale, dateFormat) ?? "";
  const formatRangeValue = (from?: Date, to?: Date): string => {
    if (!from) return "";
    return `${formatDate(from)}${rangeSeparator}${to ? formatDate(to) : openEndedLabel}`;
  };
  const isSameDate = (date1?: Date, date2?: Date): boolean => (date1 && date2 ? isSameDay(date1, date2) : false);
  const isToday = (day: Date): boolean => isSameDate(day, new Date());
  const isInRange = (day: Date): boolean => !!(range && rangeFrom && rangeTo && isWithinInterval(day, { start: rangeFrom, end: rangeTo }));

  let isSelected = $derived((day: Date): boolean => (range ? isSameDate(day, rangeFrom) || isSameDate(day, rangeTo) : isSameDate(day, value)));

  function handleCalendarKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    let nextFocusedDate = focusedDate ?? value ?? new Date();

    switch (event.key) {
      case "ArrowLeft":
        nextFocusedDate = addDay(nextFocusedDate, -1);
        break;
      case "ArrowRight":
        nextFocusedDate = addDay(nextFocusedDate, 1);
        break;
      case "ArrowUp":
        nextFocusedDate = addDay(nextFocusedDate, -7);
        break;
      case "ArrowDown":
        nextFocusedDate = addDay(nextFocusedDate, 7);
        break;
      case "Enter":
        if (range) {
          if (rangeFrom && rangeTo) {
            if (autohide && !inline) isOpen = false;
          } else {
            handleDaySelect(nextFocusedDate);
          }
        } else {
          handleDaySelect(nextFocusedDate);
          if (autohide && !inline) isOpen = false;
        }
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        closeDatepicker(true);
        return;
      default:
        return;
    }

    event.preventDefault();
    focusedDate = nextFocusedDate;
    if (nextFocusedDate.getMonth() !== currentMonth.getMonth()) {
      currentMonth = new Date(nextFocusedDate.getFullYear(), nextFocusedDate.getMonth(), 1);
    }

    // Use finalTranslationLocale for aria-label
    setTimeout(() => {
      const focusedButton = calendarRef?.querySelector(
        `button[aria-label="${focusedDate!.toLocaleDateString(finalTranslationLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}"]`
      ) as HTMLButtonElement | null;
      focusedButton?.focus();
    }, 0);
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleInputChangeWithDateFns();
      if (autohide && !inline) {
        isOpen = false;
      }
    } else if (event.key === " ") {
      event.preventDefault();
      isOpen = !isOpen;
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeDatepicker();
    }
  }

  function handleClear() {
    value = rangeFrom = rangeTo = undefined;
    onclear?.();
  }

  function handleApply() {
    const result = range ? { from: rangeFrom, to: rangeTo } : value;
    if (result) onapply?.(result);
    if (!inline) isOpen = false;
  }
</script>

{#snippet navButton(forward: boolean)}
  <button
    type="button"
    class="holos-datepicker-nav-btn"
    onclick={() => changeMonth(forward ? 1 : -1)}
    aria-label={forward ? "Next month" : "Previous month"}
  >
    <svg class="h-3 w-3 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={forward ? "M1 5h12m0 0L9 1m4 4L9 9" : "M13 5H1m0 0 4 4M1 5l4-4"}></path>
    </svg>
  </button>
{/snippet}

{#snippet yearNavButton(forward: boolean)}
  <button
    type="button"
    class="holos-datepicker-nav-btn"
    onclick={() => changeYear(forward ? 1 : -1)}
    aria-label={forward ? "Next year" : "Previous year"}
  >
    <svg class="h-3 w-3 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={forward ? "M1 5h12m0 0L9 1m4 4L9 9" : "M13 5H1m0 0 4 4M1 5l4-4"}></path>
    </svg>
  </button>
{/snippet}

<div bind:this={datepickerContainerElement} class={["relative", inline && "inline-block"]}>
  {#if !inline}
    <div class="relative">
      <button
        type="button"
        class={cx("holos-datepicker-toggle", btnClass, classes?.button)}
        onclick={() => { isOpen = !isOpen; if (isOpen) updatePortalPosition(); }}
        {disabled}
        aria-label={isOpen ? "Close date picker" : "Open date picker"}
      >
        <svg class="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path
            d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z"
          ></path>
        </svg>
      </button>
      <input
        {...inputProps}
        bind:this={elementRef}
        type="text"
        class={cx("holos-datepicker-input", inputClass)}
        {placeholder}
        value={range ? formatRangeValue(rangeFrom, rangeTo) : formatDate(value)}
        onfocus={() => { isOpen = true; updatePortalPosition(); }}
        onchange={handleInputChangeWithDateFns}
        onkeydown={handleInputKeydown}
        {disabled}
        {required}
        inputmode={resolvedInputMode}
        aria-haspopup="dialog"
      />
    </div>
  {/if}

  {#snippet calendarContent()}
    {#if title}
      <h2 class={cx("holos-datepicker-title", classes?.titleVariant)}>{title}</h2>
    {/if}

    {#if showMonthSelector}
      <!-- Month/Year Selector View -->
      <div class={cx("holos-datepicker-nav", classes?.nav)}>
        {@render yearNavButton(false)}
        <h3 class={cx("holos-datepicker-current", classes?.polite)} aria-live="polite">
          {currentMonth.getFullYear()}
        </h3>
        {@render yearNavButton(true)}
      </div>
      <div class="holos-datepicker-month-grid">
        {#each monthNames as month, index (index)}
          <button
            type="button"
            class={cx(
              "holos-datepicker-month-btn",
              currentMonth.getMonth() === index && "holos-datepicker-month-btn-selected",
              classes?.monthButton
            )}
            onclick={(event: MouseEvent) => selectMonth(index, event)}
          >
            {month}
          </button>
        {/each}
      </div>
    {:else}
      <div class={cx("holos-datepicker-nav", classes?.nav)}>
        {@render navButton(false)}
        <button
          type="button"
          class={cx("holos-datepicker-current", classes?.polite)}
          aria-live="polite"
          onclick={(event: MouseEvent) => toggleMonthSelector(event)}
        >
          {currentMonth.toLocaleString(finalTranslationLocale, { month: "long", year: "numeric" })}
        </button>
        {@render navButton(true)}
      </div>
      <div class={cx("holos-datepicker-grid", classes?.grid)} role="grid">
        {#each weekdays as day (day)}
          <div class={cx("holos-datepicker-column-header", classes?.columnHeader)} role="columnheader">{day}</div>
        {/each}
        {#each daysInMonth as day (day)}
          {@const current = day.getMonth() !== currentMonth.getMonth()}
          {@const available = isDateAvailable(day)}
          <button
            type="button"
            class={cx(
              "holos-datepicker-day-btn",
              current && "holos-datepicker-day-btn-outside",
              isToday(day) && "holos-datepicker-day-btn-today",
              isInRange(day) && "holos-datepicker-day-btn-range",
              isSelected(day) && "holos-datepicker-day-btn-selected",
              !available && "holos-datepicker-day-btn-disabled",
              classes?.dayButton
            )}
            onclick={() => handleDaySelect(day)}
            onkeydown={handleCalendarKeydown}
            aria-label={day.toLocaleDateString(finalTranslationLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            aria-selected={isSelected(day)}
            aria-disabled={!available}
            disabled={!available}
            role="gridcell"
          >
            {day.getDate()}
          </button>
        {/each}
      </div>
    {/if}

    {#if showActionButtons && !showMonthSelector}
      <div class={cx("holos-datepicker-actions", classes?.actionButtons)}>
        <button class="holos-datepicker-action-btn" onclick={() => handleDaySelect(new Date())} disabled={!isDateAvailable(new Date())}>Today</button>
        <button class="holos-datepicker-action-btn" onclick={handleClear}>Clear</button>
        <button class="holos-datepicker-action-btn holos-datepicker-action-btn-primary" onclick={handleApply}>Apply</button>
      </div>
    {/if}

    {#if actionSlot}
      <div class={classes?.actionSlot}>
        {@render actionSlot({
          selectedDate: range ? { from: rangeFrom, to: rangeTo } : value,
          handleClear,
          handleApply,
          close: () => {
            isOpen = false;
            showMonthSelector = false;
          }
        })}
      </div>
    {/if}
  {/snippet}

  {#if isOpen || inline}
    {#if inline}
      <div
        bind:this={calendarRef}
        id="datepicker-dropdown"
        class={cx("holos-datepicker-panel", "holos-datepicker-inline", className)}
        transition:fade={{ duration: 100 }}
        role="dialog"
        aria-label="Calendar"
        tabindex="-1"
        onkeydown={handlePanelKeydown}
      >
        {@render calendarContent()}
      </div>
    {:else}
      <Portal>
        <div
          bind:this={calendarRef}
          id="datepicker-dropdown"
          class={cx("holos-datepicker-panel", className)}
          style={portalStyle}
          transition:fade={{ duration: 100 }}
          role="dialog"
          aria-label="Calendar"
          tabindex="-1"
          onkeydown={handlePanelKeydown}
        >
          {@render calendarContent()}
        </div>
      </Portal>
    {/if}
  {/if}
</div>

<style>
  .holos-datepicker-input {
    width: 100%;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    padding: 6px 32px 6px 2px;
    font-size: 14px;
  }

  .holos-datepicker-input:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 1px;
  }

  .holos-datepicker-toggle {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .holos-datepicker-panel {
    width: 280px;
    margin-top: 6px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    box-shadow: var(--shadow-s);
    padding: 8px;
    z-index: 10;
  }

  .holos-datepicker-inline {
    margin-top: 0;
  }

  .holos-datepicker-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .holos-datepicker-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 8px;
  }

  .holos-datepicker-nav-btn,
  .holos-datepicker-current,
  .holos-datepicker-month-btn,
  .holos-datepicker-day-btn,
  .holos-datepicker-action-btn {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary-alt);
    color: var(--text-normal);
    cursor: pointer;
  }

  .holos-datepicker-nav-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .holos-datepicker-current {
    flex: 1;
    text-align: center;
    padding: 4px 6px;
    font-size: 13px;
    font-weight: 600;
  }

  .holos-datepicker-month-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .holos-datepicker-month-btn {
    padding: 6px;
    font-size: 12px;
  }

  .holos-datepicker-month-btn-selected,
  .holos-datepicker-day-btn-selected,
  .holos-datepicker-action-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .holos-datepicker-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .holos-datepicker-column-header {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    padding: 2px 0;
  }

  .holos-datepicker-day-btn {
    height: 30px;
    font-size: 12px;
  }

  .holos-datepicker-day-btn-outside {
    opacity: 0.5;
  }

  .holos-datepicker-day-btn-today {
    border-color: var(--interactive-accent);
  }

  .holos-datepicker-day-btn-range {
    background: color-mix(in srgb, var(--interactive-accent) 20%, var(--background-primary-alt));
  }

  .holos-datepicker-day-btn-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .holos-datepicker-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .holos-datepicker-action-btn {
    flex: 1;
    padding: 6px;
    font-size: 12px;
  }
</style>