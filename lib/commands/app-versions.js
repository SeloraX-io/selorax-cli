'use strict';

const chalk = require('chalk');
const ora = require('ora');
const api = require('../api');

module.exports = async function appVersions() {
  const spinner = ora('Fetching versions...').start();

  try {
    const res = await api.get('/apps/extensions/app/versions');
    spinner.stop();

    const versions = res.data || [];

    if (!versions.length) {
      console.log(chalk.yellow('\n  No version history yet. Deploy at least once.\n'));
      return;
    }

    console.log(chalk.bold(`\n  Extension Versions (${versions.length})\n`));

    for (const v of versions.reverse()) {
      const extCount = v.extensions?.length || 0;
      const date = v.deployed_at ? new Date(v.deployed_at).toLocaleString() : 'unknown';
      console.log(
        `  ${chalk.cyan(`v${v.version}`)}  ${chalk.dim(date)}  ${extCount} extension(s)`
      );
      if (v.extensions) {
        for (const ext of v.extensions) {
          console.log(
            chalk.dim(`    → ${ext.title} [${ext.target}] ${ext.mode || 'json'}`)
          );
        }
      }
    }

    console.log(chalk.dim(`\n  Run "selorax app:rollback -v <number>" to rollback.\n`));
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
};
