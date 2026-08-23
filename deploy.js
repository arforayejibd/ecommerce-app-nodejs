const Client = require('ssh2-sftp-client');
const path = require('path');
const os = require('os');
const fs = require('fs');

const config = {
  host: '103.112.62.87',
  port: 22,
  username: 'xmgvjnsi',
  privateKey: fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_rsa')),
};

const REMOTE_PATH = process.env.REMOTE_PATH || '/home/xmgvjnsi/onecommerce';

const IGNORED = [
  'node_modules',
  '.git',
  '.env',
  'scratch',
  'access.log',
  'cookies.txt',
  'deploy.js',
  'package-lock.json',
  'pixel-config.json',
  'gtm-config.json',
  'banners.json',
  'banner-categories.json',
  'courier-config.json',
  'footer-config.json',
  'media.json'
];

async function syncDir(sftp, localDir, remoteDir) {
  await sftp.mkdir(remoteDir, true);
  const entries = fs.readdirSync(localDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED.includes(entry.name)) continue;

    const localPath = path.join(localDir, entry.name);
    const remotePath = path.posix.join(remoteDir, entry.name);

    if (entry.isDirectory()) {
      await syncDir(sftp, localPath, remotePath);
    } else if (entry.isFile()) {
      console.log(`📤 Uploading: ${path.relative(__dirname, localPath)}`);
      await sftp.fastPut(localPath, remotePath);
    }
  }
}

async function deploy() {
  const sftp = new Client();
  console.log('🚀 Connecting to cPanel via SFTP...');

  try {
    await sftp.connect(config);
    console.log('✅ Connected successfully!');
    console.log(`📂 Syncing project files to ${REMOTE_PATH}...`);

    await syncDir(sftp, __dirname, REMOTE_PATH);

    console.log('🎉 Files uploaded successfully!');

    // Touch tmp/restart.txt to restart cPanel Passenger Node.js app
    const tmpDir = path.posix.join(REMOTE_PATH, 'tmp');
    const restartFile = path.posix.join(tmpDir, 'restart.txt');
    try {
      await sftp.mkdir(tmpDir, true);
      await sftp.put(Buffer.from(new Date().toString()), restartFile);
      console.log('🔄 Triggered Node.js app restart (tmp/restart.txt)');
    } catch (err) {
      console.log('Note: Could not touch tmp/restart.txt:', err.message);
    }

  } catch (err) {
    console.error('❌ Deployment failed:', err.message);
  } finally {
    await sftp.end();
    console.log('🔌 Connection closed.');
  }
}

deploy();
