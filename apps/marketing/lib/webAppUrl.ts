function normalizeOrigin(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getWebAppOrigin(): string {
  const configured =
    process.env.WEB_APP_URL
    ?? process.env.NEXT_PUBLIC_WEB_APP_URL
    ?? '';

  if (configured.trim().length > 0) {
    return normalizeOrigin(configured.trim());
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }

  return 'https://vitalcv.com';
}

export function buildWebAppUrl(
  pathname: string,
  search = '',
): string {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getWebAppOrigin()}${normalizedPathname}${search}`;
}
