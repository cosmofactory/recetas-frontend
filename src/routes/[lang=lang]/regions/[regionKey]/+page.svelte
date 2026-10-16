<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- FE-2 stub; the region screen arrives with FE-4. -->
<h1>{data.region.name}</h1>
