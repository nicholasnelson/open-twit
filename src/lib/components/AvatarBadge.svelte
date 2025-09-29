<script lang="ts">
const props = $props<{ handle: string; did: string }>();

const hashString = (value: string): number => {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash;
};

const normalizedHandle = $derived(props.handle.replace(/^@/, ''));

const initials = $derived((() => {
	const alphanumeric = normalizedHandle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
	if (alphanumeric.length === 0) return '??';
	if (alphanumeric.length === 1) return alphanumeric[0].repeat(2);
	return alphanumeric[0] + alphanumeric[1];
})());

const avatarColors = $derived((() => {
	const hash = hashString(props.did);
	const hue = hash % 360;
	const saturation = 55 + ((hash >> 8) % 20);
	const lightness = 45 + ((hash >> 16) % 10);
	const background = `hsl(${hue} ${saturation}% ${lightness}%)`;
	const foreground = lightness > 55 ? '#0f172a' : '#f8fafc';
	return { background, foreground };
})());

const inlineStyle = $derived(
	`background-color: ${avatarColors.background}; color: ${avatarColors.foreground};`
);
</script>

<div
	class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wide"
	style={inlineStyle}
	aria-hidden="true"
>
	{initials}
</div>
