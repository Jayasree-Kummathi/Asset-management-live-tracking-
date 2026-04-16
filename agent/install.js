'use strict';
const Service = require('node-windows').Service;

const UNINSTALL = process.argv.includes('--uninstall');

const svc = new Service({
  name:        'MindteckAssetOpsAgent',
  description: 'Mindteck IT AssetOps — Location & Status Tracking Agent',

  // ✅ FIXED HERE
  script: process.execPath,

  wait: 5,
  grow: 0.5,
  maxRestarts: 20,
});

if (UNINSTALL) {
  svc.on('uninstall', () => {
    console.log('✅ Uninstalled.');
    process.exit(0);
  });
  svc.uninstall();

} else {
  svc.on('install', () => svc.start());

  svc.on('start', () => {
    console.log('\n✅ Mindteck AssetOps Agent installed & running silently.');
    console.log('   Log: %TEMP%\\mindteck-agent.log');
    setTimeout(() => process.exit(0), 1000);
  });

  svc.on('error', e => {
    console.error('❌', e);
    process.exit(1);
  });

  svc.install();
}