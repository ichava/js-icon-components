<!--
  The Svelte 5 flavour's one template. It ships as source (the Svelte convention), and each
  generated icon is a two-line wrapper that passes its data in as `icon`.
-->
<svelte:options namespace="svg" />

<script lang="ts">
  import { rootAttributes, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

  interface Props extends IconProps {
    icon: IconData;
    [attribute: string]: unknown;
  }

  let { icon, size, color, strokeWidth, title, class: className, ...rest }: Props = $props();
  const root = $derived(rootAttributes(icon, { size, color, strokeWidth, title }));
  // A caller's class adds to `ichava-icon` rather than replacing it, as Vue's fallthrough does.
  const classes = $derived(className ? `${root.class} ${String(className)}` : root.class);
</script>

{#snippet node(child: IconChild)}
  {#if typeof child === 'string'}{child}{:else}<svelte:element this={child[0]} {...child[1]}>{#each child[2] ?? [] as c, i (i)}{@render node(c)}{/each}</svelte:element>{/if}
{/snippet}

<svg {...root} {...rest} class={classes}>{#if title}<title>{title}</title>{/if}{#each icon.nodes as c, i (i)}{@render node(c)}{/each}</svg>
