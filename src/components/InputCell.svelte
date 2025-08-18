<script lang="ts">
    let { className, date, rowID, setCell, getCell, row, col, handleKeyDown, focusCell } = $props();

    let text = $state(getCell(date, rowID));
</script>

<input 
    class={className} 
    id={`cell-${row}-${col}`} 
    bind:value={text} 
    oninput={() => setCell(date, rowID, text)} 
    onkeydown={(e) => handleKeyDown(e, row, col)} 
    onfocus={() => focusCell(row, col)} 
    tabIndex="0"
/>

<style>
    input.active {
        background-color: var(--theme-color);
    }
</style>