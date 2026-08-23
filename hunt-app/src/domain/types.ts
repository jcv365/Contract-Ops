// Canonical types for HUNT Contract Acquisition OS
// These match the Prisma schema and API contracts

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

export interface Company {
  id: UUID;
  name: string;
  website?: string;
  country?: string;
  regions: string[];
  type?: CompanyType;
  specialisms: string[];
  score: number;
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

export interface Recruiter {
  id: UUID;
  companyId?: UUID;
  name: string;
  title?: string;
  specialisms: string[];
  region?: string;
  publicProfileUrl?: string;
  relationshipStatus: RelationshipStatus;
  lastContact?: Date;
  responseHistory: unknown[];
  opportunityHistory: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export enum EmailType {
  PERSONAL = 'PERSONAL',
  GENERIC = 'GENERIC',
  TEAM = 'TEAM',
  COMPANY = 'COMPANY',
  INFERRED = 'INFERRED',
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
  createdAt: Date;
  updatedAt: Date;
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
  sourceId: UUID;
  externalId: string;
  url: string;
  title: string;
  companyId?: UUID;
  recruiterId?: UUID;
  postedAt?: Date;
  discoveredAt: Date;
  contractType?: ContractType;
  duration?: string;
  remotePolicy?: RemotePolicy;
  location?: string;
  language?: string;
  clearance?: ClearanceLevel;
  workAuthorisation?: WorkAuthorisation;
  originalRate?: number;
  originalCurrency?: string;
  ratePeriod?: RatePeriod;
  zarRate?: number;
  fxSource?: string;
  fxTimestamp?: Date;
  scores: OpportunityScores;
  status: OpportunityStatus;
  eligibilityNotes?: string;
  fitScore?: number;
  reasons: string[];
  gaps: string[];
  provenance: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// BIDOPS & Outreach Types
// ============================================

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
  targetType: TargetType;
  targetId: UUID;
  recipientEmail: string;
  greetingMode: GreetingMode;
  subject: string;
  body: string;
  evidenceIds: UUID[];
  attachmentIds: UUID[];
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

// ============================================
// Reply Intelligence Types
// ============================================

export interface EmailThread {
  id: UUID;
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
  actor: string;
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

export interface Evidence {
  id: UUID;
  profileId: UUID;
  claim: string;
  source: string;
  sourceLocation?: string;
  confidence: number;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}