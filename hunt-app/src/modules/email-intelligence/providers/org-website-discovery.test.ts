import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractFromPage } from './org-website-discovery';
import { EmailType } from '../../../domain/types';
import { DiscoveryTarget } from '../discovery-provider';

const baseTarget: DiscoveryTarget = { companyId: 'c1', companyName: 'Example Cloud Consulting', companyWebsite: 'https://examplecloud.com' };

describe('extractFromPage', () => {
  it('extracts a generic mailto address and classifies it as COMPANY', () => {
    const $ = cheerio.load('<html><body><a href="mailto:info@examplecloud.com">Contact us</a></body></html>');
    const { candidates } = extractFromPage($, 'https://examplecloud.com/contact', 'hash1', baseTarget);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].address).toBe('info@examplecloud.com');
    expect(candidates[0].emailType).toBe(EmailType.COMPANY);
    expect(candidates[0].extractionMethod).toBe('mailto-href');
  });

  it('binds a mailto address to a nearby name when it matches the recruiter being searched for', () => {
    const html = `
      <html><body>
        <div class="team-card">
          <h3>Jane Smith</h3>
          <p>Cloud Practice Director</p>
          <a href="mailto:jane.smith@examplecloud.com">Email Jane</a>
        </div>
      </body></html>`;
    const $ = cheerio.load(html);
    const target: DiscoveryTarget = { ...baseTarget, recruiterName: 'Jane Smith' };
    const { candidates } = extractFromPage($, 'https://examplecloud.com/team', 'hash2', target);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].emailType).toBe(EmailType.PERSONAL);
    expect(candidates[0].personName).toBe('Jane Smith');
  });

  // rule 6 — a name-shaped local part must not become PERSONAL just
  // because it LOOKS like a name; it needs actual page-adjacency proof.
  it('does not bind a name when no recruiterName was being searched for, even if a name appears nearby', () => {
    const html = `
      <html><body>
        <div class="team-card">
          <h3>Someone Else</h3>
          <a href="mailto:jane.smith@examplecloud.com">Email Jane</a>
        </div>
      </body></html>`;
    const $ = cheerio.load(html);
    const target: DiscoveryTarget = { ...baseTarget, recruiterName: 'Jane Smith' };
    const { candidates } = extractFromPage($, 'https://examplecloud.com/team', 'hash3', target);
    // Nearby name is "Someone Else", not "Jane Smith" — must not match.
    expect(candidates[0].emailType).not.toBe(EmailType.PERSONAL);
    expect(candidates[0].personName).toBeUndefined();
  });

  it('deduplicates the same address appearing twice on one page', () => {
    const html = `
      <html><body>
        <a href="mailto:info@examplecloud.com">Contact</a>
        <a href="mailto:info@examplecloud.com">Also contact</a>
      </body></html>`;
    const $ = cheerio.load(html);
    const { candidates } = extractFromPage($, 'https://examplecloud.com/contact', 'hash4', baseTarget);
    expect(candidates).toHaveLength(1);
  });

  it('detects a contact form with an email input, without extracting an address from it', () => {
    const html = `
      <html><body>
        <form action="/submit-contact">
          <input type="email" name="from">
          <textarea name="message"></textarea>
        </form>
      </body></html>`;
    const $ = cheerio.load(html);
    const { candidates, contactForm } = extractFromPage($, 'https://examplecloud.com/contact', 'hash5', baseTarget);
    expect(candidates).toHaveLength(0);
    expect(contactForm).toEqual({ url: 'https://examplecloud.com/contact' });
  });

  it('a form without an email input is not treated as a contact form', () => {
    const html = '<html><body><form action="/newsletter"><input type="text" name="name"></form></body></html>';
    const $ = cheerio.load(html);
    const { contactForm } = extractFromPage($, 'https://examplecloud.com/newsletter', 'hash6', baseTarget);
    expect(contactForm).toBeUndefined();
  });

  it('classifies a careers/recruitment local part as TEAM', () => {
    const $ = cheerio.load('<html><body><a href="mailto:careers@examplecloud.com">Careers</a></body></html>');
    const { candidates } = extractFromPage($, 'https://examplecloud.com/careers', 'hash7', baseTarget);
    expect(candidates[0].emailType).toBe(EmailType.TEAM);
  });
});
