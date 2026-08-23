export interface Source {
  id: string;
  name: string;
  type: 'job-board' | 'recruiter' | 'company' | 'procurement' | 'other';
  url: string;
  enabled: boolean;
  lastChecked?: Date;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

export interface Recruiter {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  verified: boolean;
  verificationDate?: Date;
  sourceId: string;
  sourceProvenance: string;
  lastContacted?: Date;
  contactCount: number;
  relationshipScore: number;
  notes?: string;
}

export interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  linkedin?: string;
  size?: string;
  location?: string;
  description?: string;
  verified: boolean;
  verificationDate?: Date;
  sourceId: string;
  sourceProvenance: string;
  lastContacted?: Date;
  contactCount: number;
  relationshipScore: number;
  notes?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  description?: string;
  source: Source;
  sourceUrl: string;
  advertisedDate: Date;
  company?: Company;
  recruiter?: Recruiter;
  location?: string;
  remotePolicy: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  contractType: 'freelance' | 'contract' | 'sow' | 'project' | 'consulting';
  duration?: string;
  rate: number;
  currency: string;
  zarRate?: number;
  eligibility: {
    remote: boolean;
    contract: boolean;
    seniority: boolean;
    architectureRelevant: boolean;
    securityClearance?: boolean;
    workAuthorization?: boolean;
    mandatoryLanguage?: string;
    locationOnsite?: boolean;
    permanent: boolean;
    engineerOnly: boolean;
  };
  fitScores: {
    technical: number;
    contract: number;
    remote: number;
    eligibility: number;
    commercial: number;
    recruiterAccessibility: number;
    overall: number;
  };
  reasons: string[];
  gaps: string[];
  status: 'discovered' | 'validated' | 'scored' | 'rejected' | 'applied' | 'won' | 'lost';
  appliedDate?: Date;
  appliedUrl?: string;
  appliedBy?: string;
  appliedNotes?: string;
  lastUpdated: Date;
  createdAt: Date;
}

export interface Bidops {
  id: string;
  opportunityId: string;
  research: {
    company: string;
    recruiter: string;
    market: string;
    competitors: string[];
    pricing: string;
    timeline: string;
    decisionMakers: string[];
  };
  positioning: {
    technicalFit: string;
    commercialFit: string;
    valueProposition: string;
    uniqueSellingPoints: string[];
    targetAudience: string;
    messaging: string;
  };
  cvProfile: {
    decision: 'send-cv' | 'send-company-profile' | 'send-both' | 'send-neither';
    reasoning: string;
  };
  emailDraft: {
    subject: string;
    body: string;
    attachments: string[];
    coveyVossChecks: {
      covey: boolean;
      voss: boolean;
      coveyNotes?: string;
      vossNotes?: string;
    };
    validation: {
      technicalFit: boolean;
      commercialFit: boolean;
      relevance: boolean;
      tone: boolean;
      length: boolean;
    };
  };
  status: 'researched' | 'positioned' | 'drafted' | 'reviewed' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outreach {
  id: string;
  draftId: string;
  opportunityId: string;
  status: 'draft' | 'pending-approval' | 'approved' | 'rejected' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied';
  sentDate?: Date;
  deliveredDate?: Date;
  openedDate?: Date;
  clickedDate?: Date;
  replyDate?: Date;
  replyThreadId?: string;
  approval: {
    approvedBy?: string;
    approvedAt?: Date;
    rejectionReason?: string;
  };
  metrics: {
    sentCount: number;
    deliveredCount: number;
    openedCount: number;
    clickedCount: number;
    replyCount: number;
  };
  auditLog: Array<{
    timestamp: Date;
    action: string;
    userId?: string;
    details?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reply {
  id: string;
  threadId: string;
  opportunityId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  sentDate: Date;
  status: 'received' | 'classified' | 'extracted' | 'promoted' | 'ignored';
  classification: {
    type: 'opportunity' | 'informational' | 'rejection' | 'follow-up' | 'other';
    confidence: number;
    reasoning: string;
  };
  extracted: {
    opportunityId?: string;
    opportunityTitle?: string;
    recruiter?: string;
    company?: string;
    rate?: number;
    currency?: string;
    contractType?: string;
    timeline?: string;
    nextSteps?: string;
  };
  promotedToOpportunity?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  userId?: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  category: 'remote' | 'contract' | 'seniority' | 'architecture' | 'security' | 'workAuthorization' | 'language' | 'location' | 'permanent' | 'engineerOnly';
  enabled: boolean;
  criteria: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  failureMessage: string;
}

export interface ScoringModel {
  id: string;
  name: string;
  weights: {
    technical: number;
    contract: number;
    remote: number;
    eligibility: number;
    commercial: number;
    recruiterAccessibility: number;
  };
  thresholds: {
    high: number;
    medium: number;
    low: number;
  };
  description: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  opportunities: Opportunity[];
  metrics: {
    total: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
}

export interface CRMRecord {
  id: string;
  opportunityId: string;
  type: 'opportunity' | 'recruiter' | 'company';
  status: 'active' | 'inactive' | 'won' | 'lost';
  lastActivity: Date;
  notes: string[];
  tags: string[];
  metaRecord<string, any>;
}