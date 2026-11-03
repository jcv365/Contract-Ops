// Canonical types for HUNT Contract Acquisition OS.
// Mirrors prisma/schema.prisma field-for-field and enum-for-enum — keep
// the two in lockstep; a drift here is a silent type hole in every module
// that imports from here instead of from @prisma/client.

export type UUID = string & { readonly __brand: unique symbol };

export function uuid(v: string): UUID {
  return v as UUID;
}

// ============================================
// Source Registry Types
// ============================================

export enum SourceType {
  JOB_BOARD = 'JOB_BOARD',
  AGGREGATOR = 'AGGREGATOR',
  API = 'API',
  RSS = 'RSS',
  RECRUITER_WEBSITE = 'RECRUITER_WEBSITE',
  COMPANY_CAREERS = 'COMPANY_CAREERS',
  PROCUREMENT_PORTAL = 'PROCUREMENT_PORTAL',
  FRAMEWORK_PORTAL = 'FRAMEWORK_PORTAL',
  PROFESSIONAL_DIRECTORY = 'PROFESSIONAL_DIRECTORY',
  SOURCE_CATALOGUE = 'SOURCE_CATALOGUE',
}

export enum AdapterStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  FAILED = 'FAILED',
  DISABLED = 'DISABLED',
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN',
}

export interface Source {
  id: UUID;
  sourceId: string;
  name: string;
  type: SourceType;
  url?: string;
  country?: string;
  region?: string;
  global: boolean;
  local: boolean;
  apiAvailable: boolean;
  rssAvailable: boolean;
  browserSearchAvailable: boolean;
  mcpAvailable: boolean;
  adapterStatus: AdapterStatus;
  reliabilityScore: number;
  contractRelevance: number;
  remoteRelevance: number;
  internationalRelevance: number;
  termsUrl?: string;
  licence?: string;
  attributionRequired: boolean;
  rateLimit?: number;
  lastHealthCheck?: Date;
  lastSuccessfulSearch?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceHealthCheck {
  id: UUID;
  sourceId: UUID;
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
  checkedAt: Date;
}

// ============================================
// Search runs & coverage (docs 01/12/25)
// ============================================

export enum SearchRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface SearchRun {
  id: UUID;
  tenantId: string;
  startedAt: Date;
  completedAt?: Date;
  status: SearchRunStatus;
  countriesConfigured: string[];
  regionsConfigured: string[];
  sourcesConfigured: string[];
  sourcesSucceeded: string[];
  sourcesFailed: string[];
  coveragePercent?: number;
  totalOpportunitiesFound: number;
  totalOpportunitiesNew: number;
  errorSummary: Record<string, unknown>;
  createdAt: Date;
}

export interface SourceCoverage {
  id: UUID;
  searchRunId: UUID;
  sourceId: UUID;
  attempted: boolean;
  succeeded: boolean;
  resultCount: number;
  latencyMs?: number;
  error?: string;
}

// ============================================
// Company & Recruiter Types
// ============================================

export enum CompanyType {
  CLOUD_CONSULTANCY = 'CLOUD_CONSULTANCY',
  SYSTEMS_INTEGRATOR = 'SYSTEMS_INTEGRATOR',
  PROFESSIONAL_SERVICES = 'PROFESSIONAL_SERVICES',
  SPECIALIST_TECH_CONSULTANCY = 'SPECIALIST_TECH_CONSULTANCY',
  MANAGED_SERVICES = 'MANAGED_SERVICES',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  DIRECT_CLIENT = 'DIRECT_CLIENT',
  RECRUITMENT_AGENCY = 'RECRUITMENT_AGENCY',
  OTHER = 'OTHER',
}

// docs-pack/docs/27 — OUTREACH_READY is computed, never set directly.
export enum CompanyReadiness {
  NOT_READY = 'NOT_READY',
  OUTREACH_READY = 'OUTREACH_READY',
}

// §85 — lifecycle of a contact, distinct from DraftStatus (message
// lifecycle). SUPPRESSED is absorbing.
export enum OutreachState {
  DISCOVERED = 'DISCOVERED',
  RESEARCHING = 'RESEARCHING',
  CONTACT_IDENTIFIED = 'CONTACT_IDENTIFIED',
  EMAIL_FOUND = 'EMAIL_FOUND',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  OUTREACH_READY = 'OUTREACH_READY',
  DRAFTED = 'DRAFTED',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  CONTACTED = 'CONTACTED',
  RESPONDED = 'RESPONDED',
  FOLLOW_UP = 'FOLLOW_UP',
  CONTACT_FORM_AVAILABLE = 'CONTACT_FORM_AVAILABLE',
  NO_USABLE_CONTACT = 'NO_USABLE_CONTACT',
  SUPPRESSED = 'SUPPRESSED',
}

// §73 — "do not automatically target HR."
export enum ContactRoleCategory {
  RECRUITER_ROLE = 'RECRUITER_ROLE',
  COMPANY_DECISION_ROLE = 'COMPANY_DECISION_ROLE',
  HR_ROLE = 'HR_ROLE',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
}

export interface Company {
  id: UUID;
  tenantId: string;
  name: string;
  website?: string;
  country?: string;
  regions: string[];
  type?: CompanyType;
  specialisms: string[];
  score: number;
  outreachReadiness: CompanyReadiness;
  outreachReadinessReason?: string;
  contactFormUrl?: string;
  outreachState: OutreachState;
  outreachStateReason?: string;
  outreachStateAt: Date;
  targetScore: number;
  targetScoreBreakdown: Record<string, unknown>;
  provenance: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum RelationshipStatus {
  UNKNOWN = 'UNKNOWN',
  CONTACTED = 'CONTACTED',
  RESPONDED = 'RESPONDED',
  ENGAGED = 'ENGAGED',
  PARTNER = 'PARTNER',
  DO_NOT_CONTACT = 'DO_NOT_CONTACT',
}

// docs-pack/docs/27 — EMAIL_READY is computed, never set directly.
export enum RecruiterReadiness {
  NOT_READY = 'NOT_READY',
  EMAIL_READY = 'EMAIL_READY',
}

export interface Recruiter {
  id: UUID;
  tenantId: string;
  companyId?: UUID;
  name: string;
  title?: string;
  specialisms: string[];
  region?: string;
  publicProfileUrl?: string;
  relationshipStatus: RelationshipStatus;
  outreachReadiness: RecruiterReadiness;
  outreachReadinessReason?: string;
  lastContact?: Date;
  responseHistory: unknown[];
  opportunityHistory: unknown[];
  outreachState: OutreachState;
  outreachStateReason?: string;
  outreachStateAt: Date;
  roleCategory: ContactRoleCategory;
  contactQualityScore: number;
  contactQualityBreakdown: Record<string, unknown>;
  targetScore: number;
  targetScoreBreakdown: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutreachStateEvent {
  id: UUID;
  tenantId: string;
  entityType: string;
  entityId: UUID;
  fromState?: OutreachState;
  toState: OutreachState;
  trigger: string;
  reason: string;
  actor: string;
  createdAt: Date;
}

export enum EmailType {
  PERSONAL = 'PERSONAL',
  GENERIC = 'GENERIC',
  TEAM = 'TEAM',
  COMPANY = 'COMPANY',
  INFERRED = 'INFERRED',
}

// docs-pack §70-97 — Recruiter & Company Email Engine. EmailType above stays
// the structural axis; these add the evidential axis (what a verification
// attempt concluded) and the derived §74 user-facing label.
export enum EmailVerificationResult {
  VALID = 'VALID',
  INVALID = 'INVALID',
  RISKY = 'RISKY',
  UNKNOWN = 'UNKNOWN',
}

// §74. Derived by src/modules/email-intelligence/classification.ts — never
// set directly.
export enum EmailClassification {
  VERIFIED_NAMED = 'VERIFIED_NAMED',
  VERIFIED_TEAM = 'VERIFIED_TEAM',
  VERIFIED_COMPANY = 'VERIFIED_COMPANY',
  UNVERIFIED = 'UNVERIFIED',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
}

// §80 — declaration order is the priority order.
export enum EmailSourceKind {
  OFFICIAL_COMPANY_SOURCE = 'OFFICIAL_COMPANY_SOURCE',
  OFFICIAL_RECRUITER_PAGE = 'OFFICIAL_RECRUITER_PAGE',
  PUBLIC_BUSINESS_SOURCE = 'PUBLIC_BUSINESS_SOURCE',
  ENRICHMENT_PROVIDER = 'ENRICHMENT_PROVIDER',
  VERIFICATION_PROVIDER = 'VERIFICATION_PROVIDER',
  CONTACT_FORM = 'CONTACT_FORM',
  OPERATOR_ENTERED = 'OPERATOR_ENTERED',
}

export interface RecruiterEmail {
  id: UUID;
  recruiterId?: UUID;
  companyId?: UUID;
  email: string;
  emailType: EmailType;
  verified: boolean;
  verificationSource?: string;
  verifiedAt?: Date;
  classification: EmailClassification;
  classifiedAt?: Date;
  normalisedAddress?: string;
  bouncedAt?: Date;
  bounceThreadId?: string;
  bounceDetail: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailVerification {
  id: UUID;
  recruiterEmailId: UUID;
  address: string;
  providerId: string;
  result: EmailVerificationResult;
  checkedAt: Date;
  method: string;
  confidence: number;
  sourceUrl?: string;
  conclusive: boolean;
  chainPosition: number;
  detail: Record<string, unknown>;
  createdAt: Date;
}

export interface EmailSourceObservation {
  id: UUID;
  recruiterEmailId: UUID;
  sourceUrl: string;
  sourceKind: EmailSourceKind;
  observedAt: Date;
  extractionMethod: string;
  pageTitle?: string;
  contextSnippet?: string;
  contentHash: string;
  domainMatch: boolean;
  personName?: string;
  robotsAllowed: boolean;
}

// ============================================
// Opportunity Types
// ============================================

export enum ContractType {
  FREELANCE = 'FREELANCE',
  CONTRACT = 'CONTRACT',
  SOW = 'SOW',
  PROJECT = 'PROJECT',
  CONSULTING = 'CONSULTING',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN',
}

export enum RemotePolicy {
  FULLY_REMOTE = 'FULLY_REMOTE',
  REMOTE_FIRST = 'REMOTE_FIRST',
  HYBRID = 'HYBRID',
  ONSITE = 'ONSITE',
  UNKNOWN = 'UNKNOWN',
}

export enum ClearanceLevel {
  NONE = 'NONE',
  BASIC = 'BASIC',
  ENHANCED = 'ENHANCED',
  SECURITY_CLEARANCE = 'SECURITY_CLEARANCE',
  UNKNOWN = 'UNKNOWN',
}

export enum WorkAuthorisation {
  ANY = 'ANY',
  SPECIFIC_COUNTRIES = 'SPECIFIC_COUNTRIES',
  VISA_REQUIRED = 'VISA_REQUIRED',
  CITIZENSHIP_REQUIRED = 'CITIZENSHIP_REQUIRED',
  UNKNOWN = 'UNKNOWN',
}

export enum RatePeriod {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
  PROJECT = 'PROJECT',
  UNKNOWN = 'UNKNOWN',
}

export enum OpportunityStatus {
  DISCOVERED = 'DISCOVERED',
  VALIDATED = 'VALIDATED',
  SCORED = 'SCORED',
  ELIGIBLE = 'ELIGIBLE',
  INELIGIBLE = 'INELIGIBLE',
  ARCHIVED = 'ARCHIVED',
  APPLIED = 'APPLIED',
  WON = 'WON',
  LOST = 'LOST',
}

// docs-pack/docs/27 — computed promotion gate, orthogonal to
// OpportunityStatus (the lifecycle state machine above).
export enum Actionability {
  ACTIONABLE = 'ACTIONABLE',
  REVIEW = 'REVIEW',
  EXCLUDED = 'EXCLUDED',
  UNKNOWN = 'UNKNOWN',
}

export interface OpportunityScores {
  technicalFit?: number;
  contractFit?: number;
  remoteFit?: number;
  eligibility?: number;
  commercialFit?: number;
  recruiterAccessibility?: number;
  overallPriority?: number;
}

export interface Opportunity {
  id: UUID;
  tenantId: string;
  sourceId: UUID;
  externalId: string;
  url: string;
  title: string;
  companyId?: UUID;
  recruiterId?: UUID;
  clusterId?: UUID;
  postedAt?: Date;
  discoveredAt: Date;
  contractType?: ContractType;
  duration?: string;
  remotePolicy?: RemotePolicy;
  location?: string;
  language?: string;
  clearance?: ClearanceLevel;
  workAuthorisation?: WorkAuthorisation;
  // Rate: numeric value + currency + period, or explicit unknown, always
  // with a source (docs-pack/docs/27). ZAR conversion never replaces the
  // original.
  originalRate?: number;
  originalCurrency?: string;
  ratePeriod?: RatePeriod;
  rateSource?: string;
  zarRate?: number;
  fxSource?: string;
  fxTimestamp?: Date;
  fxRateId?: UUID;
  scores: OpportunityScores;
  status: OpportunityStatus;
  actionability: Actionability;
  actionabilityReason?: string;
  eligibilityNotes?: string;
  fitScore?: number;
  reasons: string[];
  gaps: string[];
  provenance: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpportunityCluster {
  id: UUID;
  canonicalOpportunityId?: UUID;
  fingerprint: string;
  createdAt: Date;
}

export interface FxRate {
  id: UUID;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  fetchedAt: Date;
}

// ============================================
// BIDOPS & Outreach Types
// ============================================

export enum AttachmentKind {
  CV = 'CV',
  COMPANY_PROFILE = 'COMPANY_PROFILE',
  OTHER = 'OTHER',
}

export interface Attachment {
  id: UUID;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageRef: string;
  checksum?: string;
  ownerId?: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftAttachment {
  id: UUID;
  draftId: UUID;
  attachmentId: UUID;
}

export interface DraftEvidence {
  id: UUID;
  draftId: UUID;
  evidenceId: UUID;
}

export interface PromptTemplate {
  id: UUID;
  name: string;
  version: string;
  content: string;
  createdAt: Date;
}

export enum ValidationCheckResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
}

export interface DraftValidation {
  id: UUID;
  draftId: UUID;
  checkName: string;
  result: ValidationCheckResult;
  issues: unknown[];
  promptVersionId?: string;
  modelProvider?: string;
  modelName?: string;
  createdAt: Date;
}

export enum TargetType {
  RECRUITER = 'RECRUITER',
  COMPANY = 'COMPANY',
  OPPORTUNITY = 'OPPORTUNITY',
}

export enum GreetingMode {
  FIRST_NAME = 'FIRST_NAME',
  COMPANY_TEAM = 'COMPANY_TEAM',
  GENERIC = 'GENERIC',
}

export enum DraftStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface OutreachDraft {
  id: UUID;
  tenantId: string;
  targetType: TargetType;
  targetId: UUID;
  opportunityId?: UUID;
  recruiterId?: UUID;
  companyId?: UUID;
  recipientEmail: string;
  greetingMode: GreetingMode;
  subject: string;
  body: string;
  promptVersion: string;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface OutreachApproval {
  id: UUID;
  draftId: UUID;
  decision: ApprovalDecision;
  userId: UUID;
  timestamp: Date;
  notes?: string;
}

export enum SendStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
}

export interface EmailSend {
  id: UUID;
  draftId: UUID;
  graphMessageId?: string;
  idempotencyKey: string;
  status: SendStatus;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum OAuthProvider {
  MICROSOFT_GRAPH = 'MICROSOFT_GRAPH',
}

export interface OAuthToken {
  id: UUID;
  userId: UUID;
  provider: OAuthProvider;
  scopes: string[];
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum SuppressionReason {
  DO_NOT_CONTACT = 'DO_NOT_CONTACT',
  BOUNCED = 'BOUNCED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  MANUAL = 'MANUAL',
}

export interface Suppression {
  id: UUID;
  email: string;
  domain?: string;
  reason: SuppressionReason;
  notes?: string;
  createdAt: Date;
}

export enum ConflictStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export interface ClaimConflictValue {
  value: unknown;
  source: string;
  sourceUrl?: string;
  retrievedAt: string;
}

export interface ClaimConflict {
  id: UUID;
  entityType: string;
  entityId: UUID;
  field: string;
  values: ClaimConflictValue[];
  status: ConflictStatus;
  resolvedValue?: unknown;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ============================================
// Reply Intelligence Types
// ============================================

export interface EmailThread {
  id: UUID;
  tenantId: string;
  providerThreadId: string;
  participants: unknown[];
  linkedRecruiterId?: UUID;
  linkedCompanyId?: UUID;
  linkedOpportunityId?: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReplyClassification {
  INTERESTED = 'INTERESTED',
  OPPORTUNITY = 'OPPORTUNITY',
  REQUEST_CV = 'REQUEST_CV',
  REQUEST_PROFILE = 'REQUEST_PROFILE',
  REQUEST_RATE = 'REQUEST_RATE',
  REQUEST_CALL = 'REQUEST_CALL',
  NOT_SUITABLE = 'NOT_SUITABLE',
  FUTURE_OPPORTUNITY = 'FUTURE_OPPORTUNITY',
  OUT_OF_OFFICE = 'OUT_OF_OFFICE',
  REJECTED = 'REJECTED',
  DO_NOT_CONTACT = 'DO_NOT_CONTACT',
  UNKNOWN = 'UNKNOWN',
}

export interface Reply {
  id: UUID;
  threadId: UUID;
  graphMessageId: string;
  receivedAt: Date;
  classification: ReplyClassification;
  extractedData: Record<string, unknown>;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum FollowUpStatus {
  PENDING = 'PENDING',
  DRAFTED = 'DRAFTED',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface FollowUp {
  id: UUID;
  targetId: UUID;
  dueAt: Date;
  replyId?: UUID;
  draftId?: UUID;
  status: FollowUpStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Audit Types
// ============================================

export interface AuditEvent {
  id: UUID;
  tenantId: string;
  actor: string;
  actorUserId?: UUID;
  action: string;
  entityType: string;
  entityId: UUID;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

// ============================================
// User & Profile Types
// ============================================

export interface User {
  id: UUID;
  profileId?: UUID;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: UUID;
  userId: UUID;
  headline?: string;
  summary?: string;
  skills: string[];
  certifications: string[];
  domains: string[];
  projects: unknown[];
  achievements: unknown[];
  contractPreferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// docs-pack/docs/24 — 5-state evidence model. Only VERIFIED and
// SOURCE_REPORTED may be presented as fact; INFERRED must be labelled;
// UNKNOWN stays unknown; CONFLICTED requires human resolution (see
// ClaimConflict). Replaces the original boolean `approved`.
export enum EvidenceState {
  VERIFIED = 'VERIFIED',
  SOURCE_REPORTED = 'SOURCE_REPORTED',
  INFERRED = 'INFERRED',
  UNKNOWN = 'UNKNOWN',
  CONFLICTED = 'CONFLICTED',
}

export const CITABLE_EVIDENCE_STATES: ReadonlySet<EvidenceState> = new Set([
  EvidenceState.VERIFIED,
  EvidenceState.SOURCE_REPORTED,
]);

export interface Evidence {
  id: UUID;
  profileId: UUID;
  claim: string;
  source: string;
  sourceLocation?: string;
  confidence: number;
  state: EvidenceState;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Procurement Intelligence (Sprint 6, docs-pack/docs/13)
// ============================================

export enum ProcurementStatus {
  DISCOVERED = 'DISCOVERED',
  REVIEWED = 'REVIEWED',
  PURSUING = 'PURSUING',
  NOT_PURSUING = 'NOT_PURSUING',
  CLOSED = 'CLOSED',
}

export interface ProcurementOpportunity {
  id: UUID;
  tenantId: string;
  buyer: string;
  procurementPortal: string;
  closingDate?: Date;
  scope: string;
  eligibility?: string;
  frameworkDuration?: string;
  supplierRequirements?: string;
  sourceUrl: string;
  status: ProcurementStatus;
  discoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
