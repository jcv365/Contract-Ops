import { EmailVerificationResult, EmailSourceKind } from '../../domain/types';

export interface VerificationObservationInput {
  sourceUrl: string;
  sourceKind: EmailSourceKind;
  domainMatch: boolean;
  observedAt: Date;
  personName?: string;
}

export interface VerificationTarget {
  address: string;
  companyWebsite?: string;
  companyName: string;
  personName?: string;
  observations: VerificationObservationInput[];
}

export interface VerificationAttempt {
  providerId: string;
  result: EmailVerificationResult;
  method: string;
  confidence: number;
  sourceUrl?: string;
  checkedAt: Date;
  detail: Record<string, unknown>;
  // A conclusive attempt stops the failover chain. Only VALID/INVALID may
  // be conclusive — RISKY/UNKNOWN must let the next provider try
  // (§78/§79).
  conclusive: boolean;
}

export interface EmailVerificationProvider {
  readonly providerId: string;
  readonly implemented: boolean;
  readonly verified: boolean;
  verify(target: VerificationTarget): Promise<VerificationAttempt>;
}
