#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const pkg = require('../package.json');

program
  .name('selorax')
  .description('SeloraX developer CLI — build, test, and deploy extensions')
  .version(pkg.version);

// ── Auth commands ──────────────────────────────────────────────────────────
program
  .command('auth:login')
  .alias('login')
  .description('Authenticate with SeloraX platform')
  .option('--client-id <id>', 'App client ID')
  .option('--client-secret <secret>', 'App client secret')
  .option('--store-id <id>', 'Store ID')
  .option('--api-url <url>', 'API base URL', 'https://api.selorax.io/api')
  .action(require('../lib/commands/auth-login'));

program
  .command('auth:logout')
  .alias('logout')
  .description('Remove stored credentials')
  .action(require('../lib/commands/auth-logout'));

program
  .command('auth:status')
  .alias('whoami')
  .description('Show current auth status')
  .action(require('../lib/commands/auth-status'));

// ── App commands ───────────────────────────────────────────────────────────
program
  .command('app:dev')
  .alias('dev')
  .description('Start dev server — watches extensions, auto-deploys on change')
  .option('-c, --config <path>', 'Path to selorax.config.json', 'selorax.config.json')
  .option('--port <port>', 'Dev server port for sandbox extensions', '3456')
  .option('--no-open', 'Do not open browser')
  .action(require('../lib/commands/app-dev'));

program
  .command('app:deploy')
  .alias('deploy')
  .description('Deploy all extensions to SeloraX')
  .option('-c, --config <path>', 'Path to selorax.config.json', 'selorax.config.json')
  .option('--force', 'Skip confirmation prompt')
  .option('--dry-run', 'Preview deployment without making changes')
  .action(require('../lib/commands/app-deploy'));

program
  .command('app:versions')
  .alias('versions')
  .description('List extension version history')
  .action(require('../lib/commands/app-versions'));

program
  .command('app:rollback')
  .alias('rollback')
  .description('Rollback extensions to a previous version')
  .option('-v, --version <number>', 'Version number to rollback to')
  .action(require('../lib/commands/app-rollback'));

program
  .command('app:info')
  .alias('info')
  .description('Show current app and extension info')
  .option('-c, --config <path>', 'Path to selorax.config.json', 'selorax.config.json')
  .action(require('../lib/commands/app-info'));

// ── Generate commands ──────────────────────────────────────────────────────
program
  .command('generate:extension')
  .alias('generate')
  .description('Scaffold a new extension')
  .option('-t, --target <target>', 'Extension target (e.g. order.detail.block)')
  .option('-m, --mode <mode>', 'Extension mode: json or sandbox', 'sandbox')
  .option('-n, --name <name>', 'Extension name')
  .action(require('../lib/commands/generate-extension'));

program
  .command('generate:config')
  .description('Generate selorax.config.json for an existing project')
  .action(require('../lib/commands/generate-config'));

// ── Extension commands ─────────────────────────────────────────────────────
program
  .command('extension:build')
  .alias('build')
  .description('Build sandbox extensions with esbuild')
  .option('-c, --config <path>', 'Path to selorax.config.json', 'selorax.config.json')
  .action(require('../lib/commands/extension-build'));

program
  .command('extension:validate')
  .alias('validate')
  .description('Validate extension config and UI trees')
  .option('-c, --config <path>', 'Path to selorax.config.json', 'selorax.config.json')
  .action(require('../lib/commands/extension-validate'));

program.parse();
