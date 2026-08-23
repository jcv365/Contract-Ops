import { Router } from 'express';
import { huntDiscovery } from '../../services/sources/discovery';
import { opportunityValidator } from '../../services/validation/validator';
import { opportunityScorer } from '../../services/scoring/scorer';
import { bidopsService } from '../../services/bidops/bidops';
import { query } from '../../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/run', async (req, res) => {
  try {
    const { searchTerms, maxResults } = req.body;

    if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      return res.status(400).json({ error: 'searchTerms is required and must be a non-empty array' });
    }

    // Discover opportunities
    const opportunities = await huntDiscovery.discoverOpportunities(searchTerms, maxResults || 50);

    // Validate opportunities
    const validated = await opportunityValidator.validateAll(opportunities);

    // Score opportunities
    const scored = await opportunityScorer.scoreAll(validated);

    // Save to database
    for (const opportunity of scored) {
      await query(
        `INSERT INTO opportunities (id, title, description, source_id, source_url, advertised_date, company_id, recruiter_id, location, remote_policy, contract_type, duration, rate, currency, zar_rate, eligibility, fit_scores, reasons, gaps, status, last_updated, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           source_id = EXCLUDED.source_id,
           source_url = EXCLUDED.source_url,
           advertised_date = EXCLUDED.advertised_date,
           company_id = EXCLUDED.company_id,
           recruiter_id = EXCLUDED.recruiter_id,
           location = EXCLUDED.location,
           remote_policy = EXCLUDED.remote_policy,
           contract_type = EXCLUDED.contract_type,
           duration = EXCLUDED.duration,
           rate = EXCLUDED.rate,
           currency = EXCLUDED.currency,
           zar_rate = EXCLUDED.zar_rate,
           eligibility = EXCLUDED.eligibility,
           fit_scores = EXCLUDED.fit_scores,
           reasons = EXCLUDED.reasons,
           gaps = EXCLUDED.gaps,
           status = EXCLUDED.status,
           last_updated = EXCLUDED.last_updated`,
        [
          opportunity.id,
          opportunity.title,
          opportunity.description,
          opportunity.source.id,
          opportunity.sourceUrl,
          opportunity.advertisedDate,
          opportunity.company?.id,
          opportunity.recruiter?.id,
          opportunity.location,
          opportunity.remotePolicy,
          opportunity.contractType,
          opportunity.duration,
          opportunity.rate,
          opportunity.currency,
          opportunity.zarRate,
          JSON.stringify(opportunity.eligibility),
          JSON.stringify(opportunity.fitScores),
          JSON.stringify(opportunity.reasons),
          JSON.stringify(opportunity.gaps),
          opportunity.status,
          opportunity.lastUpdated,
          opportunity.createdAt,
        ]
      );

      // Create bidops entry
      await bidopsService.createBidops(opportunity);
    }

    res.json({
      success: true,
      count: scored.length,
      opportunities: scored,
    });
  } catch (error) {
    console.error('Error running hunt:', error);
    res.status(500).json({ error: 'Failed to run hunt' });
  }
});

router.get('/opportunities', async (req, res) => {
  try {
    const { status, minScore, maxScore } = req.query;

    let queryText = 'SELECT * FROM opportunities WHERE 1=1';
    const params: any[] = [];

    if (status) {
      queryText += ' AND status = $1';
      params.push(status);
    }

    if (minScore !== undefined) {
      queryText += ' AND fit_scores->>\'overall\'::numeric >= $1';
      params.push(minScore);
    }

    if (maxScore !== undefined) {
      queryText += ' AND fit_scores->>\'overall\'::numeric <= $1';
      params.push(maxScore);
    }

    queryText += ' ORDER BY fit_scores->>\'overall\'::numeric DESC, advertised_date DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

router.get('/opportunities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM opportunities WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

router.post('/opportunities/:id/revalidate', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch opportunity
    const result = await query('SELECT * FROM opportunities WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const opportunity = result.rows[0];

    // Re-validate
    const validation = await opportunityValidator.validate(opportunity);
    const scored = await opportunityScorer.score(opportunity);

    // Update database
    await query(
      `UPDATE opportunities
       SET eligibility = $1, fit_scores = $2, reasons = $3, gaps = $4, status = $5, last_updated = $6
       WHERE id = $7`,
      [
        JSON.stringify(scored.eligibility),
        JSON.stringify(scored.fitScores),
        JSON.stringify(scored.reasons),
        JSON.stringify(scored.gaps),
        scored.status,
        scored.lastUpdated,
        id,
      ]
    );

    res.json({
      success: true,
      opportunity: scored,
    });
  } catch (error) {
    console.error('Error revalidating opportunity:', error);
    res.status(500).json({ error: 'Failed to revalidate opportunity' });
  }
});

export default router;