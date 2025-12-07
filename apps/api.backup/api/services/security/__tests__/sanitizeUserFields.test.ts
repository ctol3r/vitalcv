import { sanitizeUserFields, USER_SANITIZATION_LIMITS } from '../../security/sanitizeUserFields';

describe('sanitizeUserFields', () => {
  it('trims whitespace and collapses multiple spaces', () => {
    const result = sanitizeUserFields({ name: '  Alice   Smith  ' });
    expect(result.name).toBe('Alice Smith');
  });

  it('strips HTML tags and script content', () => {
    const dirty = `<script>alert('xss')</script><div onclick="hack()"> Alice </div>`;
    const result = sanitizeUserFields({ name: dirty, bio: dirty });

    expect(result.name).toBe('Alice');
    expect(result.bio).toBe('Alice');
  });

  it('removes javascript: protocols in attributes', () => {
    const dirty = `<a href="javascript:alert('x')">Link</a>`;
    const result = sanitizeUserFields({ bio: dirty });

    expect(result.bio).toBe('Link');
  });

  it('enforces maximum lengths for name and bio', () => {
    const longName = 'N'.repeat(USER_SANITIZATION_LIMITS.name + 10);
    const longBio = 'B'.repeat(USER_SANITIZATION_LIMITS.bio + 50);

    const result = sanitizeUserFields({ name: longName, bio: longBio });

    expect(result.name?.length).toBe(USER_SANITIZATION_LIMITS.name);
    expect(result.bio?.length).toBe(USER_SANITIZATION_LIMITS.bio);
  });

  it('ignores null or undefined fields', () => {
    const result = sanitizeUserFields({ name: null, bio: undefined });
    expect(result).toEqual({ name: null, bio: undefined });
  });
});

