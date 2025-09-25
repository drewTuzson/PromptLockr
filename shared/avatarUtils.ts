export const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export const USERNAME_RULES = {
  minLength: 3,
  maxLength: 30,
  pattern: /^[a-zA-Z0-9_]+$/,
  reserved: ['admin', 'api', 'www', 'help', 'support', 'settings', 'profile', 'explore'],
  caseSensitive: false
};

export function generateAvatar(displayName: string = '', username: string = '') {
  const name = displayName || username || 'User';
  const initials = name
    .split(' ')
    .map(word => word[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'U';

  // Use email or fallback if username is empty
  const seedString = username || displayName || 'default';
  const colorIndex = seedString.charCodeAt(0) % AVATAR_COLORS.length;

  return {
    initials,
    backgroundColor: AVATAR_COLORS[colorIndex],
    textColor: '#FFFFFF'
  };
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const normalizedUsername = username.toLowerCase(); // Always work with lowercase

  if (normalizedUsername.length < USERNAME_RULES.minLength) {
    return { valid: false, error: `Username must be at least ${USERNAME_RULES.minLength} characters` };
  }
  if (normalizedUsername.length > USERNAME_RULES.maxLength) {
    return { valid: false, error: `Username cannot exceed ${USERNAME_RULES.maxLength} characters` };
  }
  if (!USERNAME_RULES.pattern.test(normalizedUsername)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  if (USERNAME_RULES.reserved.includes(normalizedUsername)) {
    return { valid: false, error: 'This username is reserved' };
  }
  return { valid: true };
}

export function getOptimalAvatarUrl(
  user: { avatar40Url?: string; avatar80Url?: string; avatar160Url?: string; avatar320Url?: string; hasCustomAvatar: boolean },
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
) {
  if (!user.hasCustomAvatar) return null;

  const sizeMap = {
    xs: user.avatar40Url,   // 20px display
    sm: user.avatar80Url,   // 40px display
    md: user.avatar160Url,  // 80px display
    lg: user.avatar160Url,  // 120px display
    xl: user.avatar320Url   // 160px display
  };

  return sizeMap[size];
}