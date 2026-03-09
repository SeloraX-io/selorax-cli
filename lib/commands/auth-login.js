'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { store, setClientSecret } = require('../config');
const api = require('../api');

module.exports = async function authLogin(opts) {
  console.log(chalk.bold('\n  SeloraX Authentication\n'));

  let clientId = opts.clientId;
  let clientSecret = opts.clientSecret;
  let storeId = opts.storeId;
  let apiUrl = opts.apiUrl || 'https://api.selorax.io/api';

  // Interactive prompts if not provided via flags
  if (!clientId || !clientSecret) {
    const answers = await inquirer.prompt([
      {
        name: 'apiUrl',
        message: 'API URL:',
        default: apiUrl,
        when: !opts.apiUrl,
      },
      {
        name: 'clientId',
        message: 'Client ID:',
        when: !clientId,
        validate: (v) => (v ? true : 'Client ID is required'),
      },
      {
        name: 'clientSecret',
        message: 'Client Secret:',
        type: 'password',
        when: !clientSecret,
        validate: (v) => (v ? true : 'Client Secret is required'),
      },
      {
        name: 'storeId',
        message: 'Store ID (for testing):',
        when: !storeId,
      },
    ]);

    clientId = clientId || answers.clientId;
    clientSecret = clientSecret || answers.clientSecret;
    storeId = storeId || answers.storeId;
    apiUrl = answers.apiUrl || apiUrl;
  }

  // Validate URL format
  try {
    const parsed = new URL(apiUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.error(chalk.red('  Invalid URL: must use http:// or https://'));
      process.exit(1);
    }
  } catch {
    console.error(chalk.red('  Invalid URL format. Please include the protocol (e.g., https://api.selorax.io/api)'));
    process.exit(1);
  }

  // Save credentials
  store.set('clientId', clientId);
  setClientSecret(clientSecret);
  store.set('storeId', storeId || '');
  store.set('apiUrl', apiUrl);

  // Verify by fetching app extensions
  const spinner = ora('Verifying credentials...').start();
  try {
    const res = await api.get('/apps/extensions/app');
    store.set('appName', res.data?.app_name || res.appName || '');
    spinner.succeed(
      `Authenticated! ${res.data ? (Array.isArray(res.data) ? res.data.length + ' extensions found.' : 'Connected.') : 'Connected.'}`
    );
  } catch (err) {
    spinner.fail(`Auth failed: ${err.message}`);
    console.log(chalk.dim('  Check your Client ID, Client Secret, and Store ID.'));
    process.exit(1);
  }

  console.log(chalk.dim(`\n  Credentials saved to ${store.path}\n`));
};
