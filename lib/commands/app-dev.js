'use strict';

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { readProjectConfig } = require('../config');
const api = require('../api');

module.exports = async function appDev(opts) {
  const config = readProjectConfig(opts.config);
  if (!config) {
    console.log(chalk.red('\n  selorax.config.json not found. Run: selorax generate:config\n'));
    process.exit(1);
  }

  if (!config.extensions || !config.extensions.length) {
    console.log(chalk.yellow('\n  No extensions defined in selorax.config.json\n'));
    process.exit(1);
  }

  const sandboxExts = config.extensions.filter((e) => e.mode === 'sandbox');
  const jsonExts = config.extensions.filter((e) => e.mode !== 'sandbox');
  const sseClients = [];
  const cleanupHandles = []; // Collect all handles for cleanup on SIGINT

  console.log(chalk.bold('\n  SeloraX Dev Server\n'));
  console.log(`  ${chalk.cyan('JSON extensions:')}    ${jsonExts.length}`);
  console.log(`  ${chalk.magenta('Sandbox extensions:')} ${sandboxExts.length}`);
  console.log();

  // Build sandbox extensions if any
  if (sandboxExts.length > 0) {
    let esbuild;
    try {
      esbuild = require('esbuild');
    } catch {
      console.log(chalk.red('  esbuild not found. Install: npm i -D esbuild\n'));
      process.exit(1);
    }

    // Build each sandbox extension
    for (const ext of sandboxExts) {
      if (!ext.entry) {
        console.log(chalk.yellow(`  Skipping ${ext.extension_id} — no "entry" field in config`));
        continue;
      }

      const entryPath = path.resolve(process.cwd(), ext.entry);
      if (!fs.existsSync(entryPath)) {
        console.log(chalk.red(`  Entry not found: ${ext.entry}`));
        continue;
      }

      const outDir = path.resolve(process.cwd(), config.outDir || 'dist');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const outFile = path.join(outDir, `${ext.extension_id}.js`);

      console.log(chalk.dim(`  Building ${ext.extension_id}...`));

      // Initial build
      let ctx;
      try {
        ctx = await esbuild.context({
          entryPoints: [entryPath],
          bundle: true,
          outfile: outFile,
          format: 'iife',
          target: 'es2020',
          minify: false,
          sourcemap: true,
          define: {
            'process.env.NODE_ENV': '"development"',
          },
        });
      } catch (err) {
        console.error(chalk.red(`  Build failed for ${ext.extension_id}:`), err.message);
        process.exit(1);
      }

      // Watch mode
      await ctx.watch();
      cleanupHandles.push({ type: 'esbuild', dispose: () => ctx.dispose() });
      console.log(chalk.green(`  ✓ Watching ${ext.entry} → ${path.relative(process.cwd(), outFile)}`));
    }
  }

  // Serve sandbox bundles via HTTP
  if (sandboxExts.length > 0) {
    const http = require('http');
    const port = parseInt(opts.port) || 3456;
    const outDir = path.resolve(process.cwd(), config.outDir || 'dist');

    const server = http.createServer((req, res) => {
      // CORS headers for sandbox iframes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // SSE endpoint for live reload
      if (req.url === '/__reload') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        sseClients.push(res);
        req.on('close', () => {
          const idx = sseClients.indexOf(res);
          if (idx !== -1) sseClients.splice(idx, 1);
        });
        return;
      }

      const requested = decodeURIComponent(req.url).replace(/^\//, '');
      const filePath = path.resolve(outDir, requested);
      // Prevent path traversal — ensure resolved path is within outDir
      if (!filePath.startsWith(path.resolve(outDir) + path.sep) && filePath !== path.resolve(outDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = ext === '.js' ? 'application/javascript' : ext === '.map' ? 'application/json' : 'text/plain';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red(`Port ${port} is already in use. Try a different port with --port`));
      } else {
        console.error(chalk.red('Dev server error:'), err.message);
      }
      process.exit(1);
    });

    server.listen(port, () => {
      console.log(chalk.cyan(`\n  Dev server: http://localhost:${port}`));
      console.log(chalk.dim(`  Serving: ${outDir}\n`));

      // Show sandbox URLs
      for (const ext of sandboxExts) {
        if (ext.entry) {
          console.log(
            `  ${ext.extension_id}: ${chalk.underline(`http://localhost:${port}/${ext.extension_id}.js`)}`
          );
        }
      }
      console.log(chalk.dim(`  Live reload: connect to http://localhost:${port}/__reload (SSE)\n`));
    });

    // Watch outDir for esbuild rebuilds and notify SSE clients
    const outDirWatcher = fs.watch(outDir, (eventType, filename) => {
      if (filename && filename.endsWith('.js')) {
        for (const client of sseClients) {
          client.write('data: reload\n\n');
        }
      }
    });
    cleanupHandles.push({ type: 'outDirWatcher', dispose: () => outDirWatcher.close() });
  }

  // Deploy JSON extensions immediately
  if (jsonExts.length > 0) {
    const spinner = ora('Deploying JSON extensions...').start();
    try {
      await api.post('/apps/extensions/app/deploy', {
        extensions: jsonExts,
      });
      spinner.succeed(`Deployed ${jsonExts.length} extension(s)`);
    } catch (err) {
      spinner.fail(`Deploy failed: ${err.message}`);
    }
  }

  // Watch config file for changes
  let chokidar;
  try {
    chokidar = require('chokidar');
  } catch {
    console.log(chalk.dim('  Install chokidar for config file watching: npm i -D chokidar'));
    return;
  }

  const configPath = path.resolve(process.cwd(), opts.config || 'selorax.config.json');
  const watcher = chokidar.watch(configPath, { ignoreInitial: true });
  cleanupHandles.push({ type: 'chokidar', dispose: () => watcher.close() });

  watcher.on('change', async () => {
    console.log(chalk.dim(`\n  Config changed, redeploying...`));
    try {
      const freshConfig = readProjectConfig(opts.config);
      if (freshConfig?.extensions) {
        const freshJsonExts = freshConfig.extensions.filter((e) => e.mode !== 'sandbox');
        await api.post('/apps/extensions/app/deploy', {
          extensions: freshJsonExts,
        });
        console.log(chalk.green(`  ✓ Redeployed ${freshJsonExts.length} extension(s)\n`));
        // Notify connected clients to reload
        for (const client of sseClients) {
          client.write('data: reload\n\n');
        }
      }
    } catch (err) {
      console.log(chalk.red(`  ✗ Redeploy failed: ${err.message}\n`));
    }
  });

  console.log(chalk.bold.green('  Dev mode active. Press Ctrl+C to stop.\n'));

  // Single SIGINT handler that cleans up everything
  process.on('SIGINT', () => {
    console.log(chalk.dim('\n  Shutting down...\n'));
    for (const handle of cleanupHandles) {
      try {
        handle.dispose();
      } catch { /* ignore cleanup errors */ }
    }
    process.exit(0);
  });
};
