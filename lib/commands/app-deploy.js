'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { readProjectConfig, store } = require('../config');
const api = require('../api');
const { uploadExtensionBundle } = require('../s3');

module.exports = async function appDeploy(opts) {
  const storeId = store.get('storeId');
  if (!storeId) {
    console.log(chalk.red('\n  No store ID configured. Run: selorax auth:login\n'));
    process.exit(1);
  }

  const config = readProjectConfig(opts.config);
  if (!config) {
    console.log(chalk.red('\n  selorax.config.json not found. Run: selorax generate:config\n'));
    process.exit(1);
  }

  if (!config.extensions || !config.extensions.length) {
    console.log(chalk.yellow('\n  No extensions defined in selorax.config.json\n'));
    process.exit(1);
  }

  // ── Step 1: Build sandbox extensions ─────────────────────────────────────
  const sandboxExts = config.extensions.filter((e) => e.mode === 'sandbox' && e.entry);

  if (sandboxExts.length > 0) {
    let esbuild;
    try {
      esbuild = require('esbuild');
    } catch {
      console.log(chalk.yellow('  esbuild not installed — skipping sandbox builds. Sandbox URLs must be set manually.\n'));
    }

    if (esbuild) {
      const outDir = path.resolve(process.cwd(), config.outDir || 'dist');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      console.log(chalk.bold('\n  Building sandbox extensions...\n'));

      for (const ext of sandboxExts) {
        const entryPath = path.resolve(process.cwd(), ext.entry);
        if (!fs.existsSync(entryPath)) {
          console.log(chalk.red(`  ✗ ${ext.extension_id}: entry not found at ${ext.entry}`));
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
            metafile: true,
            define: {
              'process.env.NODE_ENV': '"production"',
            },
          });

          const outputs = result.metafile?.outputs || {};
          const mainOutput = outputs[path.relative(process.cwd(), outFile)];
          const kb = ((mainOutput?.bytes || 0) / 1024).toFixed(1);
          spinner.succeed(`${ext.extension_id} (${kb}KB)`);
        } catch (err) {
          spinner.fail(`${ext.extension_id}: ${err.message}`);
        }
      }

      // ── Step 2: Upload to R2 if S3 config is present ─────────────────────
      const s3Config = config.s3 || {};
      if (s3Config.endpoint && s3Config.accessKey && s3Config.secretKey) {
        console.log(chalk.bold('\n  Uploading bundles to CDN...\n'));

        const appId = config.appId || store.get('clientId') || 'unknown';

        for (const ext of sandboxExts) {
          const outFile = path.join(outDir, `${ext.extension_id}.js`);
          if (!fs.existsSync(outFile)) continue;

          const spinner = ora(`Uploading ${ext.extension_id}...`).start();
          try {
            const publicUrl = await uploadExtensionBundle(
              {
                endpoint: s3Config.endpoint,
                bucket: s3Config.bucket || 'pap',
                accessKey: s3Config.accessKey,
                secretKey: s3Config.secretKey,
                publicUrl: s3Config.publicUrl || s3Config.endpoint,
              },
              appId,
              ext.extension_id,
              outFile
            );

            // Update sandbox_url in the config for deploy
            ext.sandbox_url = publicUrl;
            spinner.succeed(`${ext.extension_id} → ${chalk.underline(publicUrl)}`);
          } catch (err) {
            spinner.fail(`${ext.extension_id}: upload failed — ${err.message}`);
          }
        }
      } else if (sandboxExts.some((e) => !e.sandbox_url)) {
        console.log(
          chalk.yellow(
            '\n  No S3 config in selorax.config.json. Set sandbox_url manually or add s3 config:'
          )
        );
        console.log(
          chalk.dim(
            '  "s3": { "endpoint": "...", "bucket": "...", "accessKey": "...", "secretKey": "...", "publicUrl": "..." }\n'
          )
        );
      }
    }

    // Check for upload failures
    const failedUploads = sandboxExts.filter(e => !e.sandbox_url);
    if (failedUploads.length > 0) {
      console.log(chalk.red('\n  Upload failures — cannot deploy:'));
      for (const f of failedUploads) {
        console.log(chalk.red(`    • ${f.extension_id}: missing sandbox_url`));
      }
      process.exit(1);
    }
  }

  // ── Step 3: Show summary and confirm ───────────────────────────────────
  console.log(chalk.bold('\n  Extensions to deploy:\n'));
  for (const ext of config.extensions) {
    const mode = ext.mode || 'json';
    const modeColor = mode === 'sandbox' ? chalk.magenta : chalk.blue;
    console.log(
      `  ${chalk.cyan('→')} ${ext.title} ${chalk.dim(`(${ext.extension_id})`)} ${modeColor(`[${mode}]`)} → ${chalk.yellow(ext.target)}`
    );
    if (mode === 'sandbox' && ext.sandbox_url) {
      console.log(chalk.dim(`    ${ext.sandbox_url}`));
    }
  }
  console.log();

  // ── Dry run: show summary and exit without deploying ─────────────────
  if (opts.dryRun) {
    console.log(chalk.yellow.bold('  DRY RUN — no changes made.\n'));
    return;
  }

  if (!opts.force) {
    const { confirm } = await inquirer.prompt([
      {
        name: 'confirm',
        type: 'confirm',
        message: `Deploy ${config.extensions.length} extension(s)? This replaces all current extensions.`,
        default: true,
      },
    ]);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled.\n'));
      return;
    }
  }

  // ── Step 4: Deploy to platform ─────────────────────────────────────────
  const spinner = ora('Deploying extensions...').start();

  // Clean extensions payload (remove local-only fields like "entry")
  const deployPayload = config.extensions.map((ext) => {
    const clean = { ...ext };
    delete clean.entry; // Local-only field
    return clean;
  });

  try {
    const res = await api.post('/apps/extensions/app/deploy', {
      extensions: deployPayload,
    });

    spinner.succeed(
      chalk.green(
        `Deployed ${res.data?.deployed || config.extensions.length} extension(s) to ${res.data?.installations_updated || 0} installation(s)`
      )
    );
  } catch (err) {
    spinner.fail(`Deploy failed: ${err.message || err.data?.message || 'Unknown error'}`);
    if (err.data?.errors) {
      console.log(chalk.red('\n  Validation errors:'));
      for (const e of err.data.errors) {
        console.log(chalk.red(`    • ${e}`));
      }
    }
    if (!err.data?.errors && err.data?.message) {
      console.log(chalk.red(`\n  ${err.data.message}`));
    }
    process.exit(1);
  }

  console.log();
};
