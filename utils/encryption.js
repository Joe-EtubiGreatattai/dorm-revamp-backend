const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY; // Must be 32 bytes (64 hex characters)
const IV = process.env.CHAT_ENCRYPTION_IV; // Must be 16 bytes (32 hex characters)
const ALGORITHM = 'aes-256-cbc';

const encrypt = (text) => {
    if (!text) return text;
    if (!ENCRYPTION_KEY || !IV) {
        console.warn('Encryption key or IV not found. Returning plain text.');
        return text;
    }

    try {
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(IV, 'hex'));
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    } catch (error) {
        console.error('Encryption failed:', error);
        return text;
    }
};

const decrypt = (encryptedText) => {
    if (!encryptedText) return encryptedText;
    if (!ENCRYPTION_KEY || !IV) {
        return encryptedText;
    }

    try {
        // Check if it's hex (simple check for AES output)
        if (!/^[0-9a-fA-F]+$/.test(encryptedText)) {
            return encryptedText;
        }

        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(IV, 'hex'));
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        // If decryption fails, it might be plain text from before encryption was enabled
        return encryptedText;
    }
};

module.exports = { encrypt, decrypt };
