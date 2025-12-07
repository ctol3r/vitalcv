import { languages } from '../i18n/config';

export type SupportedLocale = string;

export const formatValidDate = (date: Date | string | number): Date => {
  return date instanceof Date ? date : new Date(date);
};

export const formatDate = (
  date: Date | string | number,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string => {
  try {
    return new Intl.DateTimeFormat(locale, options).format(formatValidDate(date));
  } catch (e) {
    console.error(`Error formatting date with locale ${locale}`, e);
    return new Date(date).toLocaleDateString();
  }
};

export const formatTimestamp = (
  date: Date | string | number,
  locale: string = 'en-US'
): string => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(formatValidDate(date));
  } catch (e) {
    console.error(`Error formatting timestamp with locale ${locale}`, e);
    return new Date(date).toLocaleString();
  }
};

export const formatMoney = (
  amount: number,
  currency: string,
  locale: string = 'en-US'
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch (e) {
    console.error(`Error formatting money with locale ${locale} and currency ${currency}`, e);
    return `${currency} ${amount}`;
  }
};

export const formatPhoneNumber = (
  phoneNumber: string,
  locale: string = 'en-US'
): string => {
  // Placeholder for phone number formatting
  // Ideally use libphonenumber-js
  return phoneNumber;
};














