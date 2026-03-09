'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { writeProjectConfig } = require('../config');

module.exports = async function generateConfig() {
  const configPath = path.resolve(process.cwd(), 'selorax.config.json');

  if (fs.existsSync(configPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        name: 'overwrite',
        type: 'confirm',
        message: 'selorax.config.json already exists. Overwrite?',
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.dim('  Cancelled.\n'));
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      name: 'name',
      message: 'App name:',
      default: path.basename(process.cwd()),
    },
    {
      name: 'appId',
      message: 'App ID (used for CDN paths):',
      default: path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    },
    {
      name: 'outDir',
      message: 'Build output directory:',
      default: 'dist',
    },
    {
      name: 'setupS3',
      type: 'confirm',
      message: 'Configure S3/R2 for bundle hosting?',
      default: false,
    },
    {
      name: 's3Endpoint',
      message: 'S3 endpoint URL:',
      when: (a) => a.setupS3,
    },
    {
      name: 's3Bucket',
      message: 'S3 bucket:',
      default: 'pap',
      when: (a) => a.setupS3,
    },
    {
      name: 's3AccessKey',
      message: 'S3 access key:',
      when: (a) => a.setupS3,
    },
    {
      name: 's3SecretKey',
      message: 'S3 secret key:',
      type: 'password',
      when: (a) => a.setupS3,
    },
    {
      name: 's3PublicUrl',
      message: 'S3 public URL (CDN):',
      default: 'https://assets.selorax.io',
      when: (a) => a.setupS3,
    },
  ]);

  const config = {
    name: answers.name,
    appId: answers.appId,
    outDir: answers.outDir,
    extensions: [],
  };

  if (answers.setupS3) {
    config.s3 = {
      endpoint: answers.s3Endpoint,
      bucket: answers.s3Bucket,
      accessKey: answers.s3AccessKey,
      secretKey: answers.s3SecretKey,
      publicUrl: answers.s3PublicUrl,
    };
  }

  writeProjectConfig('selorax.config.json', config);

  console.log(chalk.green('\n  ✓ Created selorax.config.json'));

  // Warn if selorax.config.json is not in .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('selorax.config.json')) {
      console.log(chalk.yellow('\n  ⚠ Warning: Add selorax.config.json to your .gitignore to avoid committing credentials.'));
    }
  }

  console.log(chalk.dim(`\n  Next: Run ${chalk.cyan('selorax generate:extension')} to add extensions.\n`));
};
