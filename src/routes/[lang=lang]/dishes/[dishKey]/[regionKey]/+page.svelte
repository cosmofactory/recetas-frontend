<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- FE-2 stub; the Recipe screen arrives with FE-6. -->
<h1>{data.recipe.name}</h1>
