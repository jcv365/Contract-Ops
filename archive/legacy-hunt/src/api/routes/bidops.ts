import { Router } from 'express';
import { bidopsService } from '../../services/bidops/bidops';

const router = Router();

router.post('/research', async (req, res) => {
  try {
    const { opportunityId } = req.body;

    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    const bidops = await bidopsService.research(opportunityId);
    res.json(bidops);
  } catch (error) {
    console.error('Error researching bidops:', error);
    res.status(500).json({ error: 'Failed to research bidops' });
  }
});

router.post('/position', async (req, res) => {
  try {
    const { opportunityId } = req.body;

    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    const bidops = await bidopsService.position(opportunityId);
    res.json(bidops);
  } catch (error) {
    console.error('Error positioning bidops:', error);
    res.status(500).json({ error: 'Failed to position bidops' });
  }
});

router.post('/draft', async (req, res) => {
  try {
    const { opportunityId } = req.body;

    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    const bidops = await bidopsService.draft(opportunityId);
    res.json(bidops);
  } catch (error) {
    console.error('Error drafting bidops:', error);
    res.status(500).json({ error: 'Failed to draft bidops' });
  }
});

router.post('/review', async (req, res) => {
  try {
    const { opportunityId, notes } = req.body;

    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    const bidops = await bidopsService.review(opportunityId, notes);
    res.json(bidops);
  } catch (error) {
    console.error('Error reviewing bidops:', error);
    res.status(500).json({ error: 'Failed to review bidops' });
  }
});

router.get('/', async (req, res) => {
  try {
    const bidopsList = await bidopsService.getAllBidops();
    res.json(bidopsList);
  } catch (error) {
    console.error('Error fetching bidops:', error);
    res.status(500).json({ error: 'Failed to fetch bidops' });
  }
});

export default router;