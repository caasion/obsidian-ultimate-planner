<script lang="ts">
    let { date, rowID, setCell, getCell, row, col, handleKeyDown, focusCell } = $props();

    let text = $state(getCell(date, rowID));
</script>

<input 
    id={`cell-${row}-${col}`} 
    bind:value={text} 
    oninput={() => setCell(date, rowID, text)} 
    onkeydown={(e) => handleKeyDown(e, row, col)} 
    onfocus={() => focusCell(row, col)} 
    tabIndex="0"
/>

