'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const api = require('../api');

module.exports = async function appRollback(opts) {
  let version = opts.version ? Number(opts.version) : null;

  if (!version) {
    // Show versions and let user pick
    const spinner = ora('Fetching versions...').start();
    let versions;
    try {
      const res = await api.get('/apps/extensions/app/versions');
      versions = res.data || [];
      spinner.stop();
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
      process.exit(1);
    }

    if (!versions.length) {
      console.log(chalk.yellow('\n  No versions available to rollback to.\n'));
      return;
    }

    const choices = versions.map((v) => ({
      name: `v${v.version} — ${v.extensions?.length || 0} extension(s) — ${v.deployed_at || 'unknown'}`,
      value: v.version,
    }));

    const answer = await inquirer.prompt([
      {
        name: 'version',
        type: 'list',
        message: 'Select version to rollback to:',
        choices,
      },
    ]);

    version = answer.version;
  }

  const { confirm } = await inquirer.prompt([
    {
      name: 'confirm',
      type: 'confirm',
      message: `Rollback to version ${version}? This replaces all current extensions.`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('  Cancelled.\n'));
    return;
  }

  const spinner = ora(`Rolling back to v${version}...`).start();

  try {
    await api.post('/apps/extensions/app/rollback', { version });
    spinner.succeed(chalk.green(`Rolled back to v${version}`));
  } catch (err) {
    spinner.fail(`Rollback failed: ${err.message}`);
    process.exit(1);
  }

  console.log();
};
