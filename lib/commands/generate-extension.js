'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { readProjectConfig, writeProjectConfig } = require('../config');

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

module.exports = async function generateExtension(opts) {
  console.log(chalk.bold('\n  Generate Extension\n'));

  let name = opts.name;
  let target = opts.target;
  let mode = opts.mode || 'sandbox';

  if (!name || !target) {
    const answers = await inquirer.prompt([
      {
        name: 'name',
        message: 'Extension name:',
        when: !name,
        validate: (v) => (v ? true : 'Name is required'),
      },
      {
        name: 'target',
        type: 'list',
        message: 'Target:',
        choices: VALID_TARGETS,
        when: !target,
      },
      {
        name: 'mode',
        type: 'list',
        message: 'Mode:',
        choices: ['sandbox', 'json'],
        default: 'sandbox',
        when: !opts.mode,
      },
    ]);

    name = name || answers.name;
    target = target || answers.target;
    mode = answers.mode || mode;
  }

  if (!VALID_TARGETS.includes(target)) {
    console.error(chalk.red(`Invalid target: "${target}"`));
    console.error(chalk.yellow(`Valid targets: ${VALID_TARGETS.join(', ')}`));
    process.exit(1);
  }

  // Generate extension_id from name
  const extensionId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (mode === 'sandbox') {
    // Create extension directory with entry file
    const dir = path.resolve(process.cwd(), 'extensions', extensionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entryFile = path.join(dir, 'index.js');
    if (!fs.existsSync(entryFile)) {
      fs.writeFileSync(
        entryFile,
        generateSandboxTemplate(name, extensionId, target),
        'utf8'
      );
      console.log(chalk.green(`  ✓ Created ${path.relative(process.cwd(), entryFile)}`));
    }

    // Update selorax.config.json
    const configPath = 'selorax.config.json';
    let config = readProjectConfig(configPath) || { name: '', extensions: [] };
    if (!config.extensions) config.extensions = [];

    config.extensions.push({
      extension_id: extensionId,
      target,
      title: name,
      mode: 'sandbox',
      entry: `extensions/${extensionId}/index.js`,
      sandbox_url: `http://localhost:3456/${extensionId}.js`,
    });

    writeProjectConfig(configPath, config);
    console.log(chalk.green(`  ✓ Updated selorax.config.json`));
  } else {
    // JSON mode — create a config entry
    const configPath = 'selorax.config.json';
    let config = readProjectConfig(configPath) || { name: '', extensions: [] };
    if (!config.extensions) config.extensions = [];

    config.extensions.push({
      extension_id: extensionId,
      target,
      title: name,
      mode: 'json',
      ui: {
        type: 'Card',
        props: { title: name },
        children: [
          {
            type: 'Text',
            props: { content: `Hello from ${name}!` },
          },
        ],
      },
    });

    writeProjectConfig(configPath, config);
    console.log(chalk.green(`  ✓ Updated selorax.config.json with JSON extension`));
  }

  console.log(chalk.dim(`\n  Extension ID: ${extensionId}`));
  console.log(chalk.dim(`  Target: ${target}`));
  console.log(chalk.dim(`  Mode: ${mode}`));
  console.log();

  if (mode === 'sandbox') {
    console.log(chalk.bold('  Next steps:'));
    console.log(`  1. Edit ${chalk.cyan(`extensions/${extensionId}/index.js`)}`);
    console.log(`  2. Run ${chalk.cyan('selorax dev')} to start dev server`);
    console.log(`  3. Run ${chalk.cyan('selorax deploy')} to publish\n`);
  } else {
    console.log(chalk.bold('  Next steps:'));
    console.log(`  1. Edit the UI tree in ${chalk.cyan('selorax.config.json')}`);
    console.log(`  2. Run ${chalk.cyan('selorax deploy')} to publish\n`);
  }
};

function generateSandboxTemplate(name, extensionId, target) {
  const isBlock = target.includes('.block') || target.includes('.widget');
  const isAction = target.includes('.action');

  if (isBlock) {
    return `// ${name} — Sandbox Extension
// Target: ${target}

import { Card, Text, Stack, Button, Badge } from '@selorax/ui';

// Wait for host to initialize
selorax.ready();

// Render initial UI
selorax.render(
  Card({ title: '${name}' },
    Stack({ direction: 'vertical', gap: 'md' },
      Text({ content: 'Hello from ${name}!' }),
      Badge({ content: 'Active', variant: 'success' }),
      Button({
        label: 'Load Data',
        action: {
          type: 'set_state',
          key: 'data_loaded',
          value: true,
        },
      })
    )
  )
);

// Listen for context updates
selorax.onContextUpdate((ctx) => {
  console.log('Context updated:', ctx);
});
`;
  }

  if (isAction) {
    return `// ${name} — Sandbox Extension
// Target: ${target}

import { Stack, Button } from '@selorax/ui';

selorax.ready();

selorax.render(
  Stack({ direction: 'horizontal', gap: 'sm' },
    Button({
      label: '${name}',
      variant: 'outline',
      action: {
        type: 'set_state',
        key: 'action_triggered',
        value: true,
      },
    })
  )
);
`;
  }

  return `// ${name} — Sandbox Extension
// Target: ${target}

import { Card, Text } from '@selorax/ui';

selorax.ready();

selorax.render(
  Card({ title: '${name}' },
    Text({ content: 'Extension loaded successfully.' })
  )
);
`;
}
