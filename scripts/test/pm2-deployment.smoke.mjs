// Run inside a disposable Ubuntu image with PM2; never uses the production daemon.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { activateRelease, readApps } from '../deploy/deploy-ubuntu.mjs';

const state = fs.mkdtempSync(path.join(os.tmpdir(), 'slacord-pm2-smoke-'));
process.env.PM2_HOME = path.join(state, 'pm2');
const pm2 = (...args) => execFileSync('pm2', args, { encoding: 'utf8', env: process.env });
const release = path.join(state, 'release');
const legacy = path.join(state, 'legacy');
const marker = path.join(state, 'started');
const revision = 'a'.repeat(40);
fs.mkdirSync(legacy);
const directories = ['packages/server/dist', 'packages/web', 'node_modules/next/dist/bin'];
for (const directory of directories) fs.mkdirSync(path.join(release, directory), { recursive: true });
const service = (label) => `require('node:fs').appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(label + '\n')}); setInterval(() => {}, 1000);`;
fs.writeFileSync(path.join(legacy, 'main.js'), service('legacy'));
fs.writeFileSync(path.join(release, 'packages/server/dist/main.js'), service('new-server'));
fs.writeFileSync(path.join(release, 'node_modules/next/dist/bin/next'), service('new-web'));
const initial = path.join(state, 'initial.config.json');
fs.writeFileSync(initial, JSON.stringify({ apps: ['slacord-backend', 'slacord-frontend'].map((name) => ({
  name, script: '/bin/bash', interpreter: 'none', cwd: legacy,
  args: ['-c', `node ${path.join(legacy, 'main.js')}`],
  env: { MONGODB_URI: 'mongodb://unused.invalid/test', JWT_SECRET: 'smoke-only', PM2_HOME: process.env.PM2_HOME },
})) }));
try {
  pm2('start', initial);
  const apps = readApps();
  let attempts = 0;
  await activateRelease({ state, release, apps, revision, origin: 'https://unused.invalid' }, {
    verify: async (_origin, expected) => {
      if (!expected) return;
      while (++attempts < 30) {
        if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').includes('new-web')) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.match(fs.readFileSync(marker, 'utf8'), /new-server/);
      assert.match(fs.readFileSync(marker, 'utf8'), /new-web/);
      const running = readApps();
      assert.equal(running[0].pm2_env.pm_exec_path, path.join(release, 'packages/server/dist/main.js'));
      assert.equal(running[1].pm2_env.pm_exec_path, path.join(release, 'node_modules/next/dist/bin/next'));
    },
  });
  const failedRelease = path.join(state, 'failed-release');
  fs.cpSync(release, failedRelease, { recursive: true });
  await assert.rejects(activateRelease({ state, release: failedRelease, apps: readApps(), revision: 'b'.repeat(40), origin: 'https://unused.invalid' }, {
    verify: async (_origin, expected) => {
      if (expected) throw new Error('simulated health failure');
      assert.equal(readApps()[0].pm2_env.pm_exec_path, path.join(release, 'packages/server/dist/main.js'));
    },
  }), /simulated health failure/);
  assert.equal(fs.realpathSync(path.join(state, 'current')), release);
  console.log('Real PM2 activation and rollback passed; no database was started or contacted.');
} finally {
  pm2('kill');
  fs.rmSync(state, { recursive: true, force: true });
}
