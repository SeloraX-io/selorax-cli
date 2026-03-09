'use strict';

const chalk = require('chalk');
const { store } = require('../config');

module.exports = async function authLogout() {
  store.clear();
  console.log(chalk.green('\n  Logged out. Credentials removed.\n'));
};
