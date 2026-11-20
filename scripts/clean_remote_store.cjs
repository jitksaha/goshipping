const fs = require('fs');
const path = require('path');

const authStorePath = path.resolve(__dirname, '../.auth_store.json');
if (fs.existsSync(authStorePath)) {
  try {
    const d = JSON.parse(fs.readFileSync(authStorePath, 'utf8'));
    d.accounts = [];
    fs.writeFileSync(authStorePath, JSON.stringify(d, null, 2), 'utf8');
    console.log('[CleanRemoteStore] Reset accounts array in .auth_store.json');
  } catch (e) {
    console.error('[CleanRemoteStore] Error resetting accounts:', e);
  }
}
