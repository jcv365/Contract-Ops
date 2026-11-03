import { describe, it, expect } from 'vitest';
import { inferEmailTypeFromLocalPart } from './local-part';
import { EmailType } from '../../domain/types';

describe('inferEmailTypeFromLocalPart', () => {
  it('classifies known generic local parts as COMPANY', () => {
    for (const address of ['info@example.com', 'contact@example.com', 'hello@example.com']) {
      expect(inferEmailTypeFromLocalPart({ address, nameBoundOnPage: false })).toBe(EmailType.COMPANY);
    }
  });

  it('classifies known recruitment/team local parts as TEAM', () => {
    for (const address of ['careers@example.com', 'talent@example.com', 'cv@example.com']) {
      expect(inferEmailTypeFromLocalPart({ address, nameBoundOnPage: false })).toBe(EmailType.TEAM);
    }
  });

  it('classifies a name-shaped local part as PERSONAL only when the page binds it to a person', () => {
    expect(inferEmailTypeFromLocalPart({ address: 'jane.smith@example.com', nameBoundOnPage: true })).toBe(
      EmailType.PERSONAL
    );
  });

  it('never classifies a name-shaped local part as PERSONAL without page-bound proof (rule 6)', () => {
    expect(inferEmailTypeFromLocalPart({ address: 'jane.smith@example.com', nameBoundOnPage: false })).toBe(
      EmailType.GENERIC
    );
  });

  it('falls back to GENERIC for an unrecognised, non-name-shaped local part', () => {
    expect(inferEmailTypeFromLocalPart({ address: 'sales123@example.com', nameBoundOnPage: false })).toBe(
      EmailType.GENERIC
    );
  });

  it('treats a malformed address as INFERRED rather than guessing a structure', () => {
    expect(inferEmailTypeFromLocalPart({ address: 'not-an-email', nameBoundOnPage: false })).toBe(EmailType.INFERRED);
  });
});
