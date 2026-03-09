'use strict';

const chalk = require('chalk');
const { readProjectConfig } = require('../config');

const VALID_TARGETS = [
  'order.detail.block', 'order.detail.action', 'order.detail.print-action',
  'order.list.action', 'order.list.selection-action',
  'product.detail.block', 'product.detail.action', 'product.detail.print-action',
  'product.list.action', 'product.list.selection-action',
  'customer.detail.block', 'customer.detail.action',
  'customer.list.action', 'customer.list.selection-action',
  'dashboard.widget', 'dashboard.block', 'navigation.link', 'settings.page',
  'pos.action', 'pos.cart.block', 'global.action',
  'checkout.block', 'checkout.action',
  'fulfillment.detail.block', 'fulfillment.detail.action',
];

const VALID_COMPONENTS = [
  'Stack', 'Grid', 'Card', 'Divider', 'Separator', 'Box', 'InlineStack', 'BlockStack', 'InlineGrid', 'Bleed',
  'Layout', 'LayoutSection', 'Page', 'ButtonGroup', 'Collapsible',
  'Text', 'Heading', 'Image', 'Badge', 'Icon', 'KeyValue', 'Table', 'List',
  'Thumbnail', 'Banner', 'CalloutCard', 'EmptyState', 'Tag', 'SkeletonBodyText', 'DescriptionList', 'MediaCard', 'FooterHelp',
  'Avatar', 'SkeletonPage', 'SkeletonDisplayText', 'SkeletonThumbnail', 'VideoThumbnail', 'ExceptionList',
  'IndexTable', 'DataTable', 'Filters', 'Pagination',
  'TextField', 'TextArea', 'Select', 'Checkbox', 'RadioGroup', 'Toggle', 'DatePicker',
  'Autocomplete', 'ColorPicker', 'DropZone', 'RangeSlider',
  'Button', 'Link', 'ActionMenu', 'PageActions',
  'ResourceItem', 'ResourceList',
  'Alert', 'Progress', 'Spinner',
  'Truncate', 'TextStyle',
  'Modal', 'Drawer', 'Tabs', 'Accordion',
  'Popover', 'Tooltip', 'Sheet', 'Scrollable', 'OptionList',
  'Listbox',
];

function validateUI(node, path, errors) {
  if (!node || typeof node !== 'object') {
    errors.push(`${path}: node must be an object`);
    return;
  }

  if (!node.type) {
    errors.push(`${path}: missing "type"`);
    return;
  }

  if (!VALID_COMPONENTS.includes(node.type)) {
    errors.push(`${path}: unknown component "${node.type}"`);
  }

  if (node.children && Array.isArray(node.children)) {
    for (let i = 0; i < node.children.length; i++) {
      validateUI(node.children[i], `${path}.children[${i}]`, errors);
    }
  }
}

module.exports = async function extensionValidate(opts) {
  const config = readProjectConfig(opts.config);
  if (!config) {
    console.log(chalk.red('\n  selorax.config.json not found.\n'));
    process.exit(1);
  }

  if (!config.extensions || !config.extensions.length) {
    console.log(chalk.yellow('\n  No extensions to validate.\n'));
    return;
  }

  console.log(chalk.bold(`\n  Validating ${config.extensions.length} extension(s)\n`));

  let totalErrors = 0;
  const ids = new Set();

  for (const ext of config.extensions) {
    const errors = [];
    const prefix = ext.extension_id || '(unknown)';

    // Required fields
    if (!ext.extension_id) errors.push('Missing extension_id');
    if (!ext.target) errors.push('Missing target');
    if (!ext.title) errors.push('Missing title');

    // Duplicate ID check
    if (ext.extension_id) {
      if (ids.has(ext.extension_id)) {
        errors.push(`Duplicate extension_id: "${ext.extension_id}"`);
      }
      ids.add(ext.extension_id);
    }

    // Valid target
    if (ext.target && !VALID_TARGETS.includes(ext.target)) {
      errors.push(`Invalid target: "${ext.target}"`);
    }

    // Mode validation
    const mode = ext.mode || 'json';
    if (!['json', 'sandbox'].includes(mode)) {
      errors.push(`Invalid mode: "${mode}"`);
    }

    if (mode === 'json') {
      if (!ext.ui) {
        errors.push('JSON mode requires "ui" field');
      } else {
        validateUI(ext.ui, 'ui', errors);
      }
    }

    if (mode === 'sandbox') {
      if (!ext.sandbox_url && !ext.entry) {
        errors.push('Sandbox mode requires "sandbox_url" or "entry" field');
      }
    }

    // Settings schema validation
    if (ext.settings_schema && Array.isArray(ext.settings_schema)) {
      for (let i = 0; i < ext.settings_schema.length; i++) {
        const s = ext.settings_schema[i];
        if (!s.key) errors.push(`settings_schema[${i}]: missing "key"`);
        if (!s.type) errors.push(`settings_schema[${i}]: missing "type"`);
        if (!s.label) errors.push(`settings_schema[${i}]: missing "label"`);
      }
    }

    // Print result
    if (errors.length === 0) {
      console.log(`  ${chalk.green('✓')} ${prefix} ${chalk.dim(`[${mode}] → ${ext.target}`)}`);
    } else {
      console.log(`  ${chalk.red('✗')} ${prefix}`);
      for (const err of errors) {
        console.log(chalk.red(`    • ${err}`));
      }
      totalErrors += errors.length;
    }
  }

  console.log();

  if (totalErrors > 0) {
    console.log(chalk.red(`  ${totalErrors} error(s) found.\n`));
    process.exit(1);
  }

  console.log(chalk.green(`  All extensions valid.\n`));
};
