import { Opportunity, Bidops } from '../../models';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../database';

export class BidopsService {
  async createBidops(opportunity: Opportunity): Promise<Bidops> {
    const bidops: Bidops = {
      id: uuidv4(),
      opportunityId: opportunity.id,
      research: {
        company: opportunity.company?.name || 'Unknown',
        recruiter: opportunity.recruiter?.name || 'Unknown',
        market: 'Global',
        competitors: [],
        pricing: 'Competitive',
        timeline: 'Immediate',
        decisionMakers: [],
      },
      positioning: {
        technicalFit: '',
        commercialFit: '',
        valueProposition: '',
        uniqueSellingPoints: [],
        targetAudience: '',
        messaging: '',
      },
      cvProfile: {
        decision: 'send-neither',
        reasoning: 'Insufficient information available',
      },
      emailDraft: {
        subject: '',
        body: '',
        attachments: [],
        coveyVossChecks: {
          covey: false,
          voss: false,
        },
        validation: {
          technicalFit: false,
          commercialFit: false,
          relevance: false,
          tone: false,
          length: false,
        },
      },
      status: 'researched',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await query(
      `INSERT INTO bidops (id, opportunity_id, research, positioning, cv_profile, email_draft, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        bidops.id,
        bidops.opportunityId,
        JSON.stringify(bidops.research),
        JSON.stringify(bidops.positioning),
        JSON.stringify(bidops.cvProfile),
        JSON.stringify(bidops.emailDraft),
        bidops.status,
        bidops.createdAt,
        bidops.updatedAt,
      ]
    );

    return bidops;
  }

  async research(opportunityId: string): Promise<Bidops> {
    const bidops = await this.getBidops(opportunityId);
    if (!bidops) {
      throw new Error('Bidops not found');
    }

    // In production, this would call AI to research the opportunity
    bidops.research = {
      company: 'Researching...',
      recruiter: 'Researching...',
      market: 'Global',
      competitors: [],
      pricing: 'Researching...',
      timeline: 'Researching...',
      decisionMakers: [],
    };

    bidops.status = 'positioned';
    bidops.updatedAt = new Date();

    await this.updateBidops(bidops);

    return bidops;
  }

  async position(opportunityId: string): Promise<Bidops> {
    const bidops = await this.getBidops(opportunityId);
    if (!bidops) {
      throw new Error('Bidops not found');
    }

    // In production, this would call AI to position the opportunity
    bidops.positioning = {
      technicalFit: 'Strong alignment with technical requirements',
      commercialFit: 'Competitive rate and terms',
      valueProposition: 'Proven track record of delivering value',
      uniqueSellingPoints: [
        'Expertise in cloud architecture',
        'Proven delivery track record',
        'Strong client relationships',
      ],
      targetAudience: 'Decision makers at target companies',
      messaging: 'Professional and value-focused',
    };

    bidops.status = 'drafted';
    bidops.updatedAt = new Date();

    await this.updateBidops(bidops);

    return bidops;
  }

  async draft(opportunityId: string): Promise<Bidops> {
    const bidops = await this.getBidops(opportunityId);
    if (!bidops) {
      throw new Error('Bidops not found');
    }

    // In production, this would call AI to draft the outreach
    bidops.emailDraft = {
      subject: 'Exploring Collaboration Opportunities',
      body: `Dear ${bidops.research.recruiter || 'Decision Maker'},\n\nI am writing to express my interest in exploring potential collaboration opportunities with ${bidops.research.company}.\n\nWith my expertise in cloud architecture and proven track record of delivering value, I believe I could contribute meaningfully to your team's objectives.\n\nI would welcome the opportunity to discuss how we might work together.\n\nBest regards,\n[Your Name]`,
      attachments: [],
      coveyVossChecks: {
        covey: true,
        voss: true,
      },
      validation: {
        technicalFit: true,
        commercialFit: true,
        relevance: true,
        tone: true,
        length: true,
      },
    };

    bidops.status = 'reviewed';
    bidops.updatedAt = new Date();

    await this.updateBidops(bidops);

    return bidops;
  }

  async review(opportunityId: string, notes?: string): Promise<Bidops> {
    const bidops = await this.getBidops(opportunityId);
    if (!bidops) {
      throw new Error('Bidops not found');
    }

    bidops.reviewNotes = notes;
    bidops.status = 'approved';
    bidops.reviewedBy = 'user'; // In production, this would be the authenticated user
    bidops.reviewedAt = new Date();
    bidops.updatedAt = new Date();

    await this.updateBidops(bidops);

    return bidops;
  }

  async getBidops(opportunityId: string): Promise<Bidops | undefined> {
    const result = await query('SELECT * FROM bidops WHERE opportunity_id = $1', [opportunityId]);
    if (result.rows.length > 0) {
      return result.rows[0] as Bidops;
    }
    return undefined;
  }

  async updateBidops(bidops: Bidops): Promise<void> {
    await query(
      `UPDATE bidops
       SET research = $1, positioning = $2, cv_profile = $3, email_draft = $4, status = $5, reviewed_by = $6, reviewed_at = $7, review_notes = $8, updated_at = $9
       WHERE id = $10`,
      [
        JSON.stringify(bidops.research),
        JSON.stringify(bidops.positioning),
        JSON.stringify(bidops.cvProfile),
        JSON.stringify(bidops.emailDraft),
        bidops.status,
        bidops.reviewedBy,
        bidops.reviewedAt,
        bidops.reviewNotes,
        bidops.updatedAt,
        bidops.id,
      ]
    );
  }

  async getAllBidops(): Promise<Bidops[]> {
    const result = await query('SELECT * FROM bidops ORDER BY created_at DESC');
    return result.rows as Bidops[];
  }
}

export const bidopsService = new BidopsService();