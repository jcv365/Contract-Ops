import { describe, it, expect } from 'vitest';
import { decideSend } from './idempotency';

describe('decideSend', () => {
  // Mandatory test #6: failed send retries idempotently without duplicate.
  it('never sends again once a draft is already SENT', () => {
    expect(decideSend('SENT').shouldSend).toBe(false);
  });

  it('refuses a concurrent send while one is already SENDING', () => {
    expect(decideSend('SENDING').shouldSend).toBe(false);
  });

  it('allows a retry from FAILED', () => {
    expect(decideSend('FAILED').shouldSend).toBe(true);
  });

  it('allows a retry from RETRY', () => {
    expect(decideSend('RETRY').shouldSend).toBe(true);
  });

  it('allows the first send when no EmailSend row exists yet', () => {
    expect(decideSend(null).shouldSend).toBe(true);
  });
});
