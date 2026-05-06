import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CalendarBookingEmbed,
  isAllowedBookingUrl,
} from '../components/pricing/CalendarBookingEmbed';

const ORIGINAL = process.env.NEXT_PUBLIC_CALENDLY_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_CALENDLY_URL;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_CALENDLY_URL;
  else process.env.NEXT_PUBLIC_CALENDLY_URL = ORIGINAL;
});

describe('isAllowedBookingUrl — host allow list', () => {
  it('accepts cal.com and subdomains', () => {
    expect(isAllowedBookingUrl('https://cal.com/team/vitalcv/pilot')).toBe(true);
    expect(isAllowedBookingUrl('https://app.cal.com/x')).toBe(true);
  });

  it('accepts calendly.com and subdomains', () => {
    expect(isAllowedBookingUrl('https://calendly.com/vitalcv/pilot')).toBe(true);
    expect(isAllowedBookingUrl('https://app.calendly.com/x')).toBe(true);
  });

  it('rejects http schemes', () => {
    expect(isAllowedBookingUrl('http://cal.com/x')).toBe(false);
  });

  it('rejects unknown hostnames', () => {
    expect(isAllowedBookingUrl('https://evil.com/cal.com/x')).toBe(false);
    expect(isAllowedBookingUrl('https://attacker.example/cal')).toBe(false);
  });

  it('rejects empty / undefined / unparseable', () => {
    expect(isAllowedBookingUrl(undefined)).toBe(false);
    expect(isAllowedBookingUrl('')).toBe(false);
    expect(isAllowedBookingUrl('not a url')).toBe(false);
  });
});

describe('CalendarBookingEmbed — render gating', () => {
  it('returns null when env is unset and no override is given', () => {
    const html = renderToStaticMarkup(<CalendarBookingEmbed />);
    expect(html).toBe('');
  });

  it('returns null when env is set to a disallowed host', () => {
    process.env.NEXT_PUBLIC_CALENDLY_URL = 'https://evil.example/embed';
    const html = renderToStaticMarkup(<CalendarBookingEmbed />);
    expect(html).toBe('');
  });

  it('renders the iframe when the env var points at calendly.com', () => {
    process.env.NEXT_PUBLIC_CALENDLY_URL = 'https://calendly.com/vitalcv/pilot';
    const html = renderToStaticMarkup(<CalendarBookingEmbed />);
    expect(html).toContain('data-testid="calendar-booking-embed"');
    expect(html).toContain('data-booking-host="calendly.com"');
    expect(html).toContain('src="https://calendly.com/vitalcv/pilot"');
    expect(html).toContain('Book a pilot scoping call');
    expect(html).toContain('Booking does not create a paid');
  });

  it('renders the iframe when the env var points at cal.com', () => {
    process.env.NEXT_PUBLIC_CALENDLY_URL = 'https://cal.com/team/vitalcv/pilot';
    const html = renderToStaticMarkup(<CalendarBookingEmbed />);
    expect(html).toContain('data-booking-host="cal.com"');
    expect(html).toContain('src="https://cal.com/team/vitalcv/pilot"');
  });

  it('uses a sandbox attribute that omits allow-top-navigation', () => {
    process.env.NEXT_PUBLIC_CALENDLY_URL = 'https://calendly.com/x';
    const html = renderToStaticMarkup(<CalendarBookingEmbed />);
    // The sandbox should not include allow-top-navigation (the embed
    // must not be able to navigate the parent away from VitalCV).
    expect(html).toMatch(/sandbox="[^"]*"/);
    expect(html).not.toContain('allow-top-navigation');
  });
});
