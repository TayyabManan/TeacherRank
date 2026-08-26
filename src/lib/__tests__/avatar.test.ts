import { describe, it, expect } from 'vitest';
import { getInitials, avatarTint } from '../avatar';

describe('getInitials', () => {
  it('takes first + last word initials for Latin names', () => {
    expect(getInitials('Muhammad Haris')).toBe('MH');
    expect(getInitials('Prof. Dr. Raja Ali Riaz')).toBe('PR');
  });

  it('uses only the primary name for bilingual "Hebrew (English)" names', () => {
    // The parenthetical transliteration used to leak in, producing "לD".
    expect(getInitials('ליאל דדון (Liel Dadon)')).toBe('לד');
    expect(getInitials('שרה לוי (Sarah Levy)')).toBe('של');
  });

  it('handles single-word and empty input', () => {
    expect(getInitials('Sarah')).toBe('SA');
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('(Only Parenthetical)')).toBe('?');
  });
});

describe('avatarTint', () => {
  it('is deterministic per name and returns a tint class pair', () => {
    const t = avatarTint('ליאל דדון (Liel Dadon)');
    expect(t).toBe(avatarTint('ליאל דדון (Liel Dadon)'));
    expect(t).toMatch(/bg-.+text-/);
  });
});
