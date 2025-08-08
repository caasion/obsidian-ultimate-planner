<script lang="ts">
	let name: string = "Enders";
</script>

<input bind:value={name} placeholder="Type your name" />
<p>Hello {name}!!!!!!</p>

<style>
	input {
		padding: 5px;
		margin-bottom: 10px;
	}
</style> 