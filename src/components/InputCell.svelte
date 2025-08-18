<script lang="ts">
    let { date, rowID, setCell, getCell, row, col, handleKeyDown } = $props();

    let text = $state(getCell(date, rowID));
</script>

<input id={`cell-${row}-${col}`} bind:value={text} oninput={() => setCell(date, rowID, text)} onkeydown={(e) => handleKeyDown(e, row, col)}/>