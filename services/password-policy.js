/**
 * One password rule for every place a password is set (team accounts, My account, reset).
 * Existing passwords keep working; this applies when a password is created or changed.
 */
const COMMON = new Set([
  'password1234', 'password@123', 'admin@123456', 'qwerty123456', '123456789012', 'welcome@1234',
  'sainand@1234', 'sainandchits', 'india@123456', 'changeme1234', 'letmein12345', 'abcd@1234567',
]);

function passwordProblem(password, username = '') {
  const value = String(password || '');
  if (value.length < 12) return 'Password must be at least 12 characters.';
  if (value.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Password must contain both letters and numbers.';
  if (COMMON.has(value.toLowerCase())) return 'This password is too common. Please choose another.';
  if (username && value.toLowerCase().includes(String(username).toLowerCase())) return 'Password must not contain the username.';
  if (/^(.)\1+$/.test(value)) return 'Password is too simple.';
  return null;
}

module.exports = { passwordProblem, PASSWORD_HINT: 'min 12 characters, letters and numbers' };
