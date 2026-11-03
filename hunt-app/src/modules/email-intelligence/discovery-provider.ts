import { EmailType, EmailSourceKind } from '../../domain/types';

export interface DiscoveryTarget {
  companyId: string;
  companyName: string;
  companyWebsite: string;
  recruiterId?: string;
  // Used ONLY to match a name printed on a page — never to construct an
  // address from it (§76 / rule 6).
  recruiterName?: string;
  recruiterProfileUrl?: string;
  roleHint?: string;
}

export interface DiscoveredEmailCandidate {
  address: string;
  emailType: EmailType;
  sourceUrl: string;
  sourceKind: EmailSourceKind;
  extractionMethod: 'mailto-href' | 'text-node' | 'json-ld' | 'provider-api';
  observedAt: Date;
  contentHash: string;
  pageTitle?: string;
  contextSnippet?: string;
  personName?: string;
  confidence: number;
}

export type DiscoveryOutcome =
  // contactFormUrl (§88): a same-domain form with an email field, found on
  // a permitted page. Recorded for the caller to persist and show; never
  // auto-submitted in Phase 1.
  | { status: 'FOUND'; candidates: DiscoveredEmailCandidate[]; contactFormUrl?: string }
  | { status: 'NONE_FOUND'; checkedUrls: string[]; contactFormUrl?: string }
  | { status: 'UNAVAILABLE'; reason: string }
  | { status: 'NOT_PERMITTED'; reason: string };

export interface EmailDiscoveryProvider {
  readonly providerId: string;
  readonly sourceKind: EmailSourceKind;
  // Paid slots ship false and are skipped by the chain without being
  // called (docs/25 honesty — never claim capability that isn't real).
  readonly implemented: boolean;
  readonly verified: boolean;
  discover(target: DiscoveryTarget): Promise<DiscoveryOutcome>;
}
