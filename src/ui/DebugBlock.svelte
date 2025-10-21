<script lang="ts">
    let { label, object } = $props();

    let show = $state(true);
</script>

<div style="display: flex; align-items: center;">
    <p>{label}</p>
    <button aria-label={show ? "hide" : "show"} onclick={() => show = !show}>{show ? "hide" : "show"}</button>
</div>


{#if show}
    <pre>{JSON.stringify(object, null, 2)}</pre>
{/if}