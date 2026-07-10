import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGetUser, mockSingle, mockFrom, mockOnAuthStateChange } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockGetUser: vi.fn(), mockSingle, mockFrom, mockOnAuthStateChange: vi.fn() };
});

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser, onAuthStateChange: mockOnAuthStateChange },
    from: mockFrom,
  },
}));
vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), critical: vi.fn() },
}));

import { getCurrentUserRoles, isAdmin, isModerator, hasRole, clearRoleCache } from '../auth';

beforeEach(() => {
  vi.clearAllMocks(); // clears call history + per-call returns, keeps chain impls
  clearRoleCache();   // reset the 5-min LRU between tests
});

describe('getCurrentUserRoles', () => {
  it('returns [] when there is no signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await getCurrentUserRoles()).toEqual([]);
  });

  it('parses profiles.role into a roles array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });
    expect(await getCurrentUserRoles()).toEqual(['admin']);
  });

  it('treats PGRST116 (no row) as the default "user" role, no retry', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } } });
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    expect(await getCurrentUserRoles()).toEqual(['user']);
    expect(mockSingle).toHaveBeenCalledTimes(1);
  });

  it('fails closed to [] on a persistent non-PGRST116 error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u3' } } });
    mockSingle.mockResolvedValue({ data: null, error: { code: '08006', message: 'network' } });
    expect(await getCurrentUserRoles()).toEqual([]); // ~0.9s real backoff (3 attempts)
    expect(mockSingle).toHaveBeenCalledTimes(3);
  });
});

describe('role helpers', () => {
  beforeEach(() => mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } }));

  it('isAdmin true only for admin; isModerator true for admin or moderator', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });
    expect(await isAdmin()).toBe(true);

    clearRoleCache();
    mockSingle.mockResolvedValue({ data: { role: 'moderator' }, error: null });
    expect(await isModerator()).toBe(true);
    expect(await hasRole('moderator')).toBe(true); // served from the cached moderator row
    expect(await hasRole('admin')).toBe(false);    // a moderator is not an admin
  });

  it('isAdmin false for a plain user', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null });
    expect(await isAdmin()).toBe(false);
  });
});
