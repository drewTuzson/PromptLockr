import { randomBytes, createHash } from 'node:crypto';

interface ApiKeyData {
  name: string;
  permissions: string[];
  rateLimit?: number;
}

interface GeneratedApiKey {
  keyId: string;
  plainKey: string;
  hashedKey: string;
  keyPrefix: string;
}

export class ApiKeyService {
  /**
   * Generate a new API key with secure random bytes
   * Format: pk_live_1234567890abcdef (prefix + environment + random)
   */
  static generateApiKey(): GeneratedApiKey {
    const keyId = randomBytes(16).toString('hex');
    const keySecret = randomBytes(32).toString('hex');
    const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const keyPrefix = `pk_${environment}_`;
    const plainKey = `${keyPrefix}${keyId}${keySecret}`;
    
    // Hash the full key for secure storage
    const hashedKey = this.hashApiKey(plainKey);
    
    return {
      keyId,
      plainKey,
      hashedKey,
      keyPrefix
    };
  }

  /**
   * Hash API key using SHA-256 + salt (more performant than bcrypt for API keys)
   * API keys are compared frequently, so we use faster hashing
   */
  static hashApiKey(plainKey: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(plainKey + salt)
      .digest('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify API key against stored hash
   */
  static verifyApiKey(plainKey: string, hashedKey: string): boolean {
    try {
      const [salt, hash] = hashedKey.split(':');
      if (!salt || !hash) return false;

      const computedHash = createHash('sha256')
        .update(plainKey + salt)
        .digest('hex');
      
      return hash === computedHash;
    } catch {
      return false;
    }
  }

  /**
   * Extract key ID from full API key for lookup
   */
  static extractKeyId(plainKey: string): string | null {
    try {
      const match = plainKey.match(/^pk_(live|test)_([a-f0-9]{32})/);
      return match ? match[2] : null;
    } catch {
      return null;
    }
  }

  /**
   * Mask API key for safe display (show only last 4 characters)
   */
  static maskApiKey(plainKey: string): string {
    if (plainKey.length <= 8) return '••••••••';
    return `${plainKey.slice(0, 7)}...${plainKey.slice(-4)}`;
  }

  /**
   * Validate API key format
   */
  static isValidKeyFormat(plainKey: string): boolean {
    return /^pk_(live|test)_[a-f0-9]{96}$/.test(plainKey);
  }

  /**
   * Check if API key is expired based on creation date and TTL
   */
  static isKeyExpired(createdAt: Date, ttlDays: number = 365): boolean {
    const expirationDate = new Date(createdAt);
    expirationDate.setDate(expirationDate.getDate() + ttlDays);
    return new Date() > expirationDate;
  }

  /**
   * Generate secure API key name if not provided
   */
  static generateKeyName(): string {
    const adjectives = ['Swift', 'Secure', 'Smart', 'Quick', 'Prime', 'Elite', 'Pro', 'Ultra'];
    const nouns = ['Key', 'Access', 'Token', 'Gateway', 'Pass', 'Link', 'Bridge', 'Portal'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const suffix = Math.floor(Math.random() * 1000);
    
    return `${adjective} ${noun} ${suffix}`;
  }
}