import { describe, it, expect } from 'vitest';
import { escapeRegExp } from './classify';

describe('escapeRegExp', () => {
  it('should escape special regular expression characters', () => {
    const specialChars = '.*+?^${}()|[]\';
    const expected = '\.\*\+\?\^\$\{\}\(\)\|\[\]\\';
    expect(escapeRegExp(specialChars)).toBe(expected);
  });

  it('should not change a string with no special characters', () => {
    const normalString = 'hello world 123';
    expect(escapeRegExp(normalString)).toBe(normalString);
  });

  it('should correctly handle a mixed string of special and normal characters', () => {
    const mixedString = 'a.b*c+d?e^f${g}(h)|i[j]\k';
    const expected = 'a\.b\*c\+d\?e\^f\$\{g\}\(h\)\|i\[j\]\\k';
    expect(escapeRegExp(mixedString)).toBe(expected);
  });

  it('should return an empty string for an empty input', () => {
    expect(escapeRegExp('')).toBe('');
  });
});
