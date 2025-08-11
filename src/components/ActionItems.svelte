<script lang="ts">

	// Action Items
	let actionItemsText = $state("");

	const actionItems = $derived(
		actionItemsText
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean)
	)

	$inspect(actionItems);
</script>

<textarea bind:value={actionItemsText}></textarea>
