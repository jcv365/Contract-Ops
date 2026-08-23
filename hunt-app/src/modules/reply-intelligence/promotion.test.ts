import { describe, it, expect } from 'vitest';
import { isPromotableClassification } from './promotion';

describe('isPromotableClassification', () => {
  it.each(['INTERESTED', 'OPPORTUNITY', 'REQUEST_CV', 'REQUEST_PROFILE', 'REQUEST_RATE', 'REQUEST_CALL', 'FUTURE_OPPORTUNITY'])(
    'treats %s as promotable',
    (classification) => {
      expect(isPromotableClassification(classification)).toBe(true);
    }
  );

  it.each(['NOT_SUITABLE', 'OUT_OF_OFFICE', 'REJECTED', 'DO_NOT_CONTACT', 'UNKNOWN'])(
    'never promotes %s to an opportunity',
    (classification) => {
      expect(isPromotableClassification(classification)).toBe(false);
    }
  );
});
