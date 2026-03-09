'use strict';

const chalk = require('chalk');
const ora = require('ora');
const { readProjectConfig } = require('../config');
const api = require('../api');

module.exports = async function appInfo(opts) {
  // Show local config
  const config = readProjectConfig(opts.config);
  if (config) {
    console.log(chalk.bold('\n  Local Config\n'));
    console.log(`  App Name:    ${chalk.cyan(config.name || '(not set)')}`);
    console.log(`  Extensions:  ${chalk.cyan(config.extensions?.length || 0)}`);
    if (config.extensions) {
      for (const ext of config.extensions) {
        const mode = ext.mode || 'json';
        const modeColor = mode === 'sandbox' ? chalk.magenta : chalk.blue;
        console.log(
          `    ${chalk.dim('→')} ${ext.title} ${modeColor(`[${mode}]`)} → ${chalk.yellow(ext.target)}`
        );
      }
    }
  } else {
    console.log(chalk.dim('\n  No local selorax.config.json found.'));
  }

  // Show remote info
  const spinner = ora('Fetching remote extensions...').start();
  try {
    const res = await api.get('/apps/extensions/app');
    spinner.stop();

    const remote = res.data || [];
    console.log(chalk.bold(`\n  Remote Extensions (${remote.length})\n`));

    if (remote.length === 0) {
      console.log(chalk.dim('  No extensions deployed yet.'));
    } else {
      for (const ext of remote) {
        const mode = ext.mode || 'json';
        const modeColor = mode === 'sandbox' ? chalk.magenta : chalk.blue;
        console.log(
          `  ${chalk.cyan('→')} ${ext.title} ${chalk.dim(`(${ext.extension_id})`)} ${modeColor(`[${mode}]`)} → ${chalk.yellow(ext.target)}`
        );
      }
    }
  } catch (err) {
    spinner.fail(`Failed to fetch remote info: ${err.message}`);
  }

  console.log();
};
