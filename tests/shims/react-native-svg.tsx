import { createElement, type ReactNode } from 'react';

/**
 * A stand-in for react-native-svg in a Node test, where the real package's native modules cannot
 * load. Each component renders a host element named after it (`Path` → `<rn-path>`) carrying its
 * props, so a snapshot shows exactly which component and which props the template chose. The names
 * are the real package's: the template imports them from `react-native-svg`, and `npm run
 * typecheck` checks them against that package's own types.
 */
const host = (name: string) => {
  const tag = `rn-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
  return function Element({ children, ref: _ref, ...props }: Record<string, unknown> & { children?: ReactNode }) {
    return createElement(tag, props, children);
  };
};

const NAMES = [
  'Circle', 'ClipPath', 'Defs', 'Ellipse', 'FeBlend', 'FeColorMatrix', 'FeComponentTransfer', 'FeComposite', 'FeConvolveMatrix',
  'FeDiffuseLighting', 'FeDisplacementMap', 'FeDropShadow', 'FeFlood', 'FeFuncA', 'FeFuncB', 'FeFuncG', 'FeFuncR', 'FeGaussianBlur',
  'FeMerge', 'FeMergeNode', 'FeMorphology', 'FeOffset', 'FeSpecularLighting', 'FeTile', 'FeTurbulence', 'Filter', 'G', 'Line',
  'LinearGradient', 'Marker', 'Mask', 'Path', 'Pattern', 'Polygon', 'Polyline', 'RadialGradient', 'Rect', 'Stop', 'Symbol', 'Text',
  'TextPath', 'TSpan', 'Use',
] as const;

const components = Object.fromEntries(NAMES.map((n) => [n, host(n)]));
export const {
  Circle, ClipPath, Defs, Ellipse, FeBlend, FeColorMatrix, FeComponentTransfer, FeComposite, FeConvolveMatrix,
  FeDiffuseLighting, FeDisplacementMap, FeDropShadow, FeFlood, FeFuncA, FeFuncB, FeFuncG, FeFuncR, FeGaussianBlur,
  FeMerge, FeMergeNode, FeMorphology, FeOffset, FeSpecularLighting, FeTile, FeTurbulence, Filter, G, Line,
  LinearGradient, Marker, Mask, Path, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Symbol, Text,
  TextPath, TSpan, Use,
} = components;
export default host('Svg');
