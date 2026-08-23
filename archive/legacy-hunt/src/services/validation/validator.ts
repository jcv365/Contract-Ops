import { Opportunity, ValidationRule } from '../../models';

export class OpportunityValidator {
  private rules: ValidationRule[] = [];

  addRule(rule: ValidationRule) {
    this.rules.push(rule);
  }

  async validate(opportunity: Opportunity): Promise<{
    valid: boolean;
    failedRules: ValidationRule[];
    reasons: string[];
  }> {
    const failedRules: ValidationRule[] = [];
    const reasons: string[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const passed = this.checkRule(opportunity, rule);
      if (!passed) {
        failedRules.push(rule);
        reasons.push(rule.failureMessage);
      }
    }

    return {
      valid: failedRules.length === 0,
      failedRules,
      reasons,
    };
  }

  private checkRule(opportunity: Opportunity, rule: ValidationRule): boolean {
    switch (rule.category) {
      case 'remote':
        return opportunity.eligibility.remote;

      case 'contract':
        return opportunity.eligibility.contract;

      case 'seniority':
        return opportunity.eligibility.seniority;

      case 'architecture':
        return opportunity.eligibility.architectureRelevant;

      case 'security':
        return !opportunity.eligibility.securityClearance || rule.criteria.clearanceLevel === 'any';

      case 'workAuthorization':
        return opportunity.eligibility.workAuthorization;

      case 'language':
        return !opportunity.eligibility.mandatoryLanguage || rule.criteria.language === opportunity.eligibility.mandatoryLanguage;

      case 'location':
        return !opportunity.eligibility.locationOnsite || rule.criteria.onsiteAllowed;

      case 'permanent':
        return !opportunity.eligibility.permanent;

      case 'engineerOnly':
        return opportunity.eligibility.engineerOnly;

      default:
        return true;
    }
  }

  async validateAll(opportunities: Opportunity[]): Promise<Opportunity[]> {
    const validated: Opportunity[] = [];

    for (const opportunity of opportunities) {
      const result = await this.validate(opportunity);

      if (result.valid) {
        opportunity.status = 'validated';
        validated.push(opportunity);
      } else {
        opportunity.status = 'rejected';
        opportunity.reasons = result.reasons;
      }
    }

    return validated;
  }
}

export const opportunityValidator = new OpportunityValidator();