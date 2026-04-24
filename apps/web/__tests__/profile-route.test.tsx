import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

describe('/profile/[npi] route', () => {
  beforeEach(() => {
    vi.resetModules();
    notFoundMock.mockClear();
  });

  it('rejects invalid NPI params before rendering the profile surface', async () => {
    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    await expect(
      ProfilePage({ params: Promise.resolve({ npi: 'not-an-npi' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('trims and renders a valid ten-digit NPI', async () => {
    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    const node = await ProfilePage({
      params: Promise.resolve({ npi: ' 1346053246 ' }),
    });
    const markup = renderToStaticMarkup(node);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(markup).toContain('NPI: 1346053246');
    expect(markup).not.toContain(' 1346053246 ');
  });
});
