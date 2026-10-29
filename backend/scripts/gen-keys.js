// Prints fresh secrets for .env. Run: npm run gen:keys
const { randomBytes } = require('node:crypto');
console.log('JWT_ACCESS_SECRET=' + randomBytes(32).toString('hex'));
console.log('CONTACT_HASH_SECRET=' + randomBytes(32).toString('hex'));
console.log('CONTACT_ENC_KEY=' + randomBytes(32).toString('base64'));
console.log('WEBHOOK_SHARED_SECRET=' + randomBytes(24).toString('hex'));
console.log('WHATSAPP_VERIFY_TOKEN=' + randomBytes(16).toString('hex'));
