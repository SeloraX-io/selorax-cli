'use strict';

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { readProjectConfig } = require('../config');

module.exports = async function extensionBuild(opts) {
  const config = readProjectConfig(opts.config);
  if (!config) {
    console.log(chalk.red('\n  selorax.config.json not found.\n'));
    process.exit(1);
  }

  const sandboxExts = (config.extensions || []).filter(
    (e) => e.mode === 'sandbox' && e.entry
  );

  if (!sandboxExts.length) {
    console.log(chalk.yellow('\n  No sandbox extensions with "entry" to build.\n'));
    return;
  }

  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch {
    console.log(chalk.red('  esbuild not found. Install: npm i -D esbuild\n'));
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), config.outDir || 'dist');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(chalk.bold(`\n  Building ${sandboxExts.length} extension(s)\n`));

  let hasErrors = false;

  for (const ext of sandboxExts) {
    const entryPath = path.resolve(process.cwd(), ext.entry);
    if (!fs.existsSync(entryPath)) {
      console.log(chalk.red(`  ✗ ${ext.extension_id}: entry not found at ${ext.entry}`));
      hasErrors = true;
      continue;
    }

    const outFile = path.join(outDir, `${ext.extension_id}.js`);
    const spinner = ora(`Building ${ext.extension_id}...`).start();

    try {
      const result = await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        outfile: outFile,
        format: 'iife',
        target: 'es2020',
        minify: true,
        sourcemap: false,
        metafile: true,
        define: {
          'process.env.NODE_ENV': '"production"',
        },
      });

      // Check bundle size
      const outputs = result.metafile?.outputs || {};
      const mainOutput = outputs[path.relative(process.cwd(), outFile)];
      const bytes = mainOutput?.bytes || 0;
      const kb = (bytes / 1024).toFixed(1);

      const sizeColor = bytes > 50000 ? chalk.red : bytes > 10000 ? chalk.yellow : chalk.green;

      spinner.succeed(
        `${ext.extension_id} → ${path.relative(process.cwd(), outFile)} ${sizeColor(`(${kb}KB)`)}`
      );

      if (bytes > 50000) {
        console.log(chalk.yellow(`    ⚠ Bundle exceeds 50KB. Consider code-splitting.`));
      }
    } catch (err) {
      spinner.fail(`${ext.extension_id}: build failed`);
      console.log(chalk.red(`    ${err.message}`));
      hasErrors = true;
    }
  }

  console.log();

  if (hasErrors) {
    console.log(chalk.yellow('  Some extensions failed to build.\n'));
    process.exit(1);
  }

  console.log(chalk.green(`  All extensions built to ${path.relative(process.cwd(), outDir)}/\n`));
};
