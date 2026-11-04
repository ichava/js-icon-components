// The Ember flavour's one template: a template-only Glimmer component in template-tag format.
// The build turns it into dist/ember/Icon.js with content-tag, and checks the template compiles
// with the Glimmer precompiler. It takes an icon's data:
//
//   import { Icon } from '@ichava/js-icon-components/ember';
//   import { IconMug } from '@ichava/js-icon-components/ember/tabler';
//   <template><Icon @icon={{IconMug}} @size={{20}} @title="Coffee" /></template>
//
// Arguments: @icon, @size, @color, @strokeWidth, @title, @class, and for illustrations
// @primaryColor and @variant.
import { iconMarkup } from './markup.js';

<template>{{{iconMarkup @icon @size @color @strokeWidth @title @class @primaryColor @variant}}}</template>
