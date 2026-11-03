import { describe, it, expect } from 'vitest';
import { extractDomain, registrableDomain, isFreemailDomain, domainOwnershipMatch } from './domain';

describe('extractDomain', () => {
  it('extracts the domain after the last @', () => {
    expect(extractDomain('jane@example.com')).toBe('example.com');
  });
  it('returns null for an address with no @', () => {
    expect(extractDomain('not-an-email')).toBeNull();
  });
});

describe('registrableDomain', () => {
  it('returns a simple two-label domain unchanged', () => {
    expect(registrableDomain('example.com')).toBe('example.com');
  });
  it('strips subdomains down to the registrable domain', () => {
    expect(registrableDomain('mail.team.example.com')).toBe('example.com');
  });
  it('handles a bundled multi-label suffix (.co.uk)', () => {
    expect(registrableDomain('careers.example.co.uk')).toBe('example.co.uk');
  });
  it('handles .co.za (the user\'s own jurisdiction)', () => {
    expect(registrableDomain('mail.examplecloud.co.za')).toBe('examplecloud.co.za');
  });
});

describe('isFreemailDomain', () => {
  it('flags common consumer webmail domains', () => {
    expect(isFreemailDomain('gmail.com')).toBe(true);
    expect(isFreemailDomain('mail.gmail.com')).toBe(true);
  });
  it('does not flag a business domain', () => {
    expect(isFreemailDomain('examplecloud.com')).toBe(false);
  });
});

describe('domainOwnershipMatch', () => {
  // §81: john@gmail.com must never be accepted as a company's business
  // email domain.
  it('flags a freemail domain regardless of company website', () => {
    expect(domainOwnershipMatch('gmail.com', 'https://examplecloud.com')).toBe('FREEMAIL');
  });

  it('returns OWNED when the email domain exactly matches the company website host', () => {
    expect(domainOwnershipMatch('examplecloud.com', 'https://examplecloud.com')).toBe('OWNED');
  });

  it('returns SUBDOMAIN when the email domain is a subdomain of the company site', () => {
    expect(domainOwnershipMatch('mail.examplecloud.com', 'https://examplecloud.com')).toBe('SUBDOMAIN');
  });

  it('returns MISMATCH when the registrable domains differ', () => {
    expect(domainOwnershipMatch('othercompany.com', 'https://examplecloud.com')).toBe('MISMATCH');
  });

  it('returns NO_COMPANY_DOMAIN when no company website is on record', () => {
    expect(domainOwnershipMatch('examplecloud.com', undefined)).toBe('NO_COMPANY_DOMAIN');
  });

  it('returns NO_COMPANY_DOMAIN for an unparseable company website', () => {
    expect(domainOwnershipMatch('examplecloud.com', 'not a url')).toBe('NO_COMPANY_DOMAIN');
  });
});
