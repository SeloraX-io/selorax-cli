'use strict';

const chalk = require('chalk');
const { store } = require('../config');

module.exports = async function authStatus() {
  const clientId = store.get('clientId');
  const storeId = store.get('storeId');
  const apiUrl = store.get('apiUrl');
  const appName = store.get('appName');

  if (!clientId) {
    console.log(chalk.yellow('\n  Not authenticated. Run: selorax auth:login\n'));
    return;
  }

  console.log(chalk.bold('\n  SeloraX Auth Status\n'));
  console.log(`  Client ID:  ${chalk.cyan(clientId)}`);
  console.log(`  Store ID:   ${chalk.cyan(storeId || '(not set)')}`);
  console.log(`  API URL:    ${chalk.dim(apiUrl)}`);
  if (appName) {
    console.log(`  App Name:   ${chalk.green(appName)}`);
  }
  console.log(chalk.dim(`\n  Config: ${store.path}\n`));
};
