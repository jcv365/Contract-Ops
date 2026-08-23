import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

export async function initializeDatabase() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS sources (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        last_checked TIMESTAMP,
        health_status VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        source_id VARCHAR(255) REFERENCES sources(id),
        source_url TEXT NOT NULL,
        advertised_date TIMESTAMP NOT NULL,
        company_id VARCHAR(255),
        recruiter_id VARCHAR(255),
        location VARCHAR(255),
        remote_policy VARCHAR(20) NOT NULL,
        contract_type VARCHAR(50) NOT NULL,
        duration VARCHAR(100),
        rate NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        zar_rate NUMERIC(10,2),
        eligibility JSONB,
        fit_scores JSONB,
        reasons TEXT[],
        gaps TEXT[],
        status VARCHAR(50) DEFAULT 'discovered',
        applied_date TIMESTAMP,
        applied_url TEXT,
        applied_by VARCHAR(255),
        applied_notes TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS recruiters (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        website TEXT,
        linkedin TEXT,
        verified BOOLEAN DEFAULT false,
        verification_date TIMESTAMP,
        source_id VARCHAR(255) REFERENCES sources(id),
        source_provenance TEXT,
        last_contacted TIMESTAMP,
        contact_count INTEGER DEFAULT 0,
        relationship_score NUMERIC(5,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(255),
        website TEXT,
        linkedin TEXT,
        size VARCHAR(50),
        location VARCHAR(255),
        description TEXT,
        verified BOOLEAN DEFAULT false,
        verification_date TIMESTAMP,
        source_id VARCHAR(255) REFERENCES sources(id),
        source_provenance TEXT,
        last_contacted TIMESTAMP,
        contact_count INTEGER DEFAULT 0,
        relationship_score NUMERIC(5,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bidops (
        id VARCHAR(255) PRIMARY KEY,
        opportunity_id VARCHAR(255) REFERENCES opportunities(id),
        research JSONB,
        positioning JSONB,
        cv_profile JSONB,
        email_draft JSONB,
        status VARCHAR(50) DEFAULT 'researched',
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS outreach (
        id VARCHAR(255) PRIMARY KEY,
        draft_id VARCHAR(255) REFERENCES bidops(id),
        opportunity_id VARCHAR(255) REFERENCES opportunities(id),
        status VARCHAR(50) DEFAULT 'draft',
        sent_date TIMESTAMP,
        delivered_date TIMESTAMP,
        opened_date TIMESTAMP,
        clicked_date TIMESTAMP,
        reply_date TIMESTAMP,
        reply_thread_id VARCHAR(255),
        approval JSONB,
        metrics JSONB,
        audit_log JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS replies (
        id VARCHAR(255) PRIMARY KEY,
        thread_id VARCHAR(255),
        opportunity_id VARCHAR(255) REFERENCES opportunities(id),
        sender VARCHAR(255),
        sender_email VARCHAR(255),
        subject VARCHAR(500),
        body TEXT,
        sent_date TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'received',
        classification JSONB,
        extracted JSONB,
        promoted_to_opportunity VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export default pool;