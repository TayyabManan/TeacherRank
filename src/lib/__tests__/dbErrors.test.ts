import { describe, it, expect } from 'vitest';
import { friendlyWriteError, toFriendlyError } from '../dbErrors';

describe('friendlyWriteError', () => {
  it('extracts the sentence after a RATE_LIMITED trigger tag', () => {
    const err = { code: 'P0001', message: 'RATE_LIMITED: You are posting too fast. Try again soon.' };
    expect(friendlyWriteError(err)).toBe('You are posting too fast. Try again soon.');
  });

  it('handles ANON_IP_LIMIT and ANON_TEACHER_LIMIT tags', () => {
    expect(friendlyWriteError({ message: 'ANON_IP_LIMIT: Too many reviews from your network.' }))
      .toBe('Too many reviews from your network.');
    expect(friendlyWriteError({ message: 'ANON_TEACHER_LIMIT: One review per teacher.' }))
      .toBe('One review per teacher.');
  });

  it('finds the tag even when other text precedes it', () => {
    expect(friendlyWriteError({ message: 'ERROR:  RATE_LIMITED: slow down' })).toBe('slow down');
  });

  it('handles the migration 021 tags (moderation guard, rating input guards)', () => {
    expect(friendlyWriteError({ code: 'P0001', message: 'MODERATION_PROTECTED: Only moderators can change review flags.' }))
      .toBe('Only moderators can change review flags.');
    expect(friendlyWriteError({ code: 'P0001', message: 'INVALID_RATING: Rating must be between 0.5 and 5 stars in half-star steps.' }))
      .toBe('Rating must be between 0.5 and 5 stars in half-star steps.');
  });

  it('maps the anonymous-fingerprint unique violation (23505)', () => {
    const err = { code: '23505', message: 'duplicate key value violates unique constraint "uniq_ratings_anon_fingerprint"' };
    expect(friendlyWriteError(err)).toMatch(/already reviewed this teacher from this device/i);
  });

  it('returns null for a 23505 on a different constraint', () => {
    expect(friendlyWriteError({ code: '23505', message: 'violates "some_other_uniq"' })).toBeNull();
  });

  it('returns null for unknown / empty / nullish errors', () => {
    expect(friendlyWriteError({ code: '23503', message: 'FK violation' })).toBeNull();
    expect(friendlyWriteError(null)).toBeNull();
    expect(friendlyWriteError(undefined)).toBeNull();
    expect(friendlyWriteError({})).toBeNull();
  });
});

describe('toFriendlyError', () => {
  it('wraps a recognized trigger error in a friendly Error', () => {
    const out = toFriendlyError({ code: 'P0001', message: 'RATE_LIMITED: Slow down please.' });
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe('Slow down please.');
  });

  it('passes through an existing Error instance untouched when not recognized', () => {
    const original = new Error('boom');
    expect(toFriendlyError(original)).toBe(original);
  });

  it('builds an Error from a plain object message', () => {
    expect(toFriendlyError({ message: 'raw failure' }).message).toBe('raw failure');
  });

  it('falls back to a generic message for shapeless input', () => {
    expect(toFriendlyError({}).message).toBe('Something went wrong. Please try again.');
    expect(toFriendlyError(null).message).toBe('Something went wrong. Please try again.');
  });
});
