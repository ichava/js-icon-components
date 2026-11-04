<!--
  The Vue 3 flavour's one template. The build compiles it with @vue/compiler-sfc (script and
  template) into dist/vue/index.js; every generated Vue icon is `defineIcon(data)`.
-->
<script lang="ts">
import { computed, defineComponent, h, type FunctionalComponent, type PropType, type VNodeChild } from 'vue';
import { rootAttributes, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

function renderChild(child: IconChild): VNodeChild {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  return h(tag, { ...attrs }, children?.map(renderChild));
}

const IconNodes: FunctionalComponent<{ nodes: readonly IconChild[] }> = (props) => props.nodes.map(renderChild);

const Icon = defineComponent({
  name: 'IchavaIcon',
  components: { IconNodes },
  props: {
    icon: { type: Object as PropType<IconData>, required: true },
    size: { type: [Number, String] as PropType<number | string>, default: undefined },
    color: { type: String, default: undefined },
    strokeWidth: { type: [Number, String] as PropType<number | string>, default: undefined },
    title: { type: String, default: undefined },
  },
  setup(props) {
    const root = computed(() => rootAttributes(props.icon, props));
    return { root };
  },
});

export default Icon;

/** One named component per icon. Pure, so an unused icon is dropped by the bundler. */
export function defineIcon(icon: IconData): FunctionalComponent<IconProps> {
  const component: FunctionalComponent<IconProps> = (_props, { attrs }) => h(Icon, { ...attrs, icon });
  component.displayName = icon.id;
  return component;
}
</script>

<template>
  <svg v-bind="root"><title v-if="title">{{ title }}</title><IconNodes :nodes="icon.nodes" /></svg>
</template>
