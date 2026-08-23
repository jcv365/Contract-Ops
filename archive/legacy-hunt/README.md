# HUNT Contract Acquisition OS

Phase 1 Contract Acquisition OS - A personal system designed to help find and win remote international contracts.

## Features

- **Opportunity Hunt**: Discover freelance contracts, consulting engagements, and project opportunities worldwide
- **Market Outreach Hunt**: Find recruiters, recruitment companies, and professional services firms
- **Validation & Scoring**: Validate opportunities against criteria and score them based on fit
- **BIDOPS**: Research, position, and draft outreach communications
- **Human Approval**: Approval workflow for outbound communication
- **Microsoft Graph Integration**: Send emails via Outlook
- **Reply Intelligence**: Process replies and extract opportunities
- **Audit & Observability**: Comprehensive logging and monitoring

## Architecture

The system follows an API-first, evidence-first approach with the following layers:

1. Source Registry - Manage external sources
2. Source Adapters - Connect to various job sources
3. HUNT Discovery - Search for contracts and recruiters
4. Normalisation/Deduplication - Standardise and deduplicate opportunities
5. Eligibility/Validation - Validate opportunities against criteria
6. Opportunity Scoring - Score opportunities based on fit
7. Recruiter & Company Intelligence - Track recruiters and companies
8. Evidence Layer - Store evidence for opportunities
9. BIDOPS - Research, positioning, and outreach drafting
10. Human Approval - Approval workflow for outbound communication
11. Microsoft Graph Outreach - Send emails via Outlook
12. Reply Intelligence - Process replies and extract opportunities
13. Pipeline/CRM - Manage opportunities through the pipeline
14. Audit/Observability - Logging and monitoring
15. AEOS integration boundary

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- WinRM access to target server (for deployment)

## Installation

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd HUNT
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize database:
```bash
npm run typecheck
```

5. Start the development server:
```bash
npm run dev
```

6. Access the API:
```
http://localhost:3000
```

### Docker Deployment

1. Build the Docker image:
```bash
docker build -t hunt-app:latest .
```

2. Start the application:
```bash
docker-compose up -d
```

3. Check the logs:
```bash
docker-compose logs -f
```

## API Endpoints

### Hunt

- `POST /api/hunt/run` - Run a hunt for opportunities
- `GET /api/hunt/opportunities` - Get all opportunities
- `GET /api/hunt/opportunities/:id` - Get a specific opportunity
- `POST /api/hunt/opportunities/:id/revalidate` - Revalidate an opportunity

### Bidops

- `POST /api/bidops/research` - Research an opportunity
- `POST /api/bidops/position` - Position an opportunity
- `POST /api/bidops/draft` - Draft outreach communication
- `POST /api/bidops/review` - Review and approve bidops
- `GET /api/bidops` - Get all bidops

### Health

- `GET /health` - Health check endpoint

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hunt

# Server
PORT=3000
NODE_ENV=development

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Microsoft Graph
GRAPH_CLIENT_ID=your_client_id
GRAPH_CLIENT_SECRET=your_client_secret
GRAPH_TENANT_ID=your_tenant_id

# Email
EMAIL_FROM=noreply@hunt.com
EMAIL_TO=your.email@example.com

# Logging
LOG_LEVEL=info

# Sources
ENABLE_CAREER_OPS=true
ENABLE_JOBICY=true
ENABLE_JOBSCOLLIDER=true
ENABLE_JOBSPY=true
```

## Deployment

### Using the Deployment Script

```bash
# Set your WinRM password
export WINRM_PASSWORD='your_password'

# Run the deployment script
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment

1. Build the Docker image:
```bash
docker build -t hunt-app:latest .
```

2. Copy files to the remote server:
```bash
scp -r . administrator@192.168.1.195:/opt/hunt/
```

3. SSH to the server and start containers:
```bash
ssh administrator@192.168.1.195
cd /opt/hunt
docker-compose up -d
```

4. Check the logs:
```bash
docker-compose logs -f
```

## Development

### Running Tests

```bash
npm test
```

### Code Quality

```bash
npm run lint
npm run typecheck
```

### Building for Production

```bash
npm run build
```

## Project Structure

```
HUNT/
├── src/
│   ├── api/
│   │   └── routes/
│   │       ├── hunt.ts
│   │       └── bidops.ts
│   ├── models/
│   │   └── opportunity.ts
│   ├── services/
│   │   ├── sources/
│   │   │   ├── registry.ts
│   │   │   └── discovery.ts
│   │   ├── validation/
│   │   │   └── validator.ts
│   │   ├── scoring/
│   │   │   └── scorer.ts
│   │   ├── bidops/
│   │   │   └── bidops.ts
│   │   ├── audit/
│   │   ├── graph/
│   │   ├── outreach/
│   │   ├── replies/
│   │   ├── evidence/
│   │   ├── dedup/
│   │   ├── normalization/
│   │   ├── approval/
│   │   ├── pipeline/
│   │   ├── crm/
│   │   └── providers/
│   ├── database.ts
│   └── index.ts
├── Dockerfile
├── docker-compose.yml
├── deploy.sh
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

This is a Phase 1 implementation. Future phases will include:
- Sprint 2: Recruiter/company intelligence
- Sprint 3: BIDOPS enhancements
- Sprint 4: Graph outreach
- Sprint 5: Reply intelligence
- Sprint 6: Commercial/market intelligence
- Sprint 7: Hardening and production readiness

## License

MIT

## Support

For issues and questions, please open an issue in the repository.