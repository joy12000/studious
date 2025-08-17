import { describe, it, expect } from 'vitest';
import { escapeRegExp } from './classify';

describe('escapeRegExp', () => {
  it('정규식 특수 문자를 올바르게 이스케이프해야 합니다', () => {
    const specialChars = '.*+?^${}()|[]\\';
    const expected = '\.\*\+\?\^\$\{\}\(\)\|\[\]\\';
    expect(escapeRegExp(specialChars)).toBe(expected);
  });

  it('특수 문자가 없는 문자열은 그대로 반환해야 합니다', () => {
    const normalString = 'hello world 123';
    expect(escapeRegExp(normalString)).toBe(normalString);
  });

  it('특수 문자와 일반 문자가 섞인 문자열도 올바르게 처리해야 합니다', () => {
    const mixedString = 'a.b*c+d?e^f${g}(h)|i[j]\\k';
    const expected = 'a\.b\*c\+d\?e\^f\$\{g\}\(h\)\|i\[j\]\\k';
    expect(escapeRegExp(mixedString)).toBe(expected);
  });

  it('빈 문자열은 빈 문자열로 반환해야 합니다', () => {
    expect(escapeRegExp('')).toBe('');
  });
});