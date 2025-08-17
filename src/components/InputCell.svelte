<script lang="ts">
    let { date, rowID, setCell, getCell } = $props();

    let text = $state(getCell(date, rowID));
</script>

<input bind:value={text} oninput={() => setCell(date, rowID, text)} />