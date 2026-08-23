import crypto from 'node:crypto';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { decryptToken } from './token-crypto';

export interface OutboundAttachment {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface SendMailParams {
  to: string;
  subject: string;
  bodyText: string;
  attachments: OutboundAttachment[];
  idempotencyKey: string;
}

export interface SendMailResult {
  graphMessageId: string;
}

export class GraphSendError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'GraphSendError';
  }
}

export interface GraphTransport {
  readonly verified: boolean;
  sendMail(params: SendMailParams): Promise<SendMailResult>;
}

// Default transport while ENABLE_GRAPH_SEND=false (env.ts, safety-critical
// per ADR-002 — see Sprint 0's fix to the boolean-coercion bug). Proves
// the approval -> send -> audit application logic end-to-end without ever
// touching a real mailbox. Per docs-pack/docs/25, this is explicitly NOT
// proof the Graph integration works — only that the surrounding system
// does the right thing once something sends.
export class MockGraphTransport implements GraphTransport {
  readonly verified = false;
  private readonly sentIdempotencyKeys = new Set<string>();

  async sendMail(params: SendMailParams): Promise<SendMailResult> {
    if (this.sentIdempotencyKeys.has(params.idempotencyKey)) {
      // Mirrors what a real idempotent Graph client should do — the
      // caller (modules/graph/send-service.ts) already prevents this via
      // decideSend(), but the transport itself doesn't silently accept a
      // duplicate either.
      throw new GraphSendError(`Idempotency key ${params.idempotencyKey} was already used`);
    }
    this.sentIdempotencyKeys.add(params.idempotencyKey);
    logger.info(
      { to: params.to, subject: params.subject, attachmentCount: params.attachments.length },
      'MockGraphTransport: simulated send (NOT VERIFIED IN THIS ENVIRONMENT — no real mailbox involved)'
    );
    return { graphMessageId: `mock-${crypto.randomUUID()}` };
  }
}

// Structurally complete Entra-authenticated Graph client, but untestable
// in this environment: no Entra app has been registered, so no delegated
// OAuth token has ever been obtained (see modules/graph/oauth.ts). Kept
// out of the default path entirely — ENABLE_GRAPH_SEND must be explicitly
// true AND a valid OAuthToken must exist, or send-service.ts refuses to
// use this at all.
export class RealGraphTransport implements GraphTransport {
  readonly verified = false;

  constructor(private readonly encryptedAccessToken: string) {}

  async sendMail(params: SendMailParams): Promise<SendMailResult> {
    if (!env.ENCRYPTION_KEY) {
      throw new GraphSendError('ENCRYPTION_KEY not configured — cannot decrypt stored Graph token');
    }
    const accessToken = decryptToken(this.encryptedAccessToken, env.ENCRYPTION_KEY);

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        // Never log accessToken — it never appears in any log call in
        // this file (rule 16), only used here to build the header.
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: 'Text', content: params.bodyText },
          toRecipients: [{ emailAddress: { address: params.to } }],
          attachments: params.attachments.map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.fileName,
            contentType: a.mimeType,
            contentBytes: a.contentBase64,
          })),
        },
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new GraphSendError(`Graph sendMail returned HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
    }

    // Graph's sendMail endpoint returns 202 Accepted with no body and no
    // message ID — the message ID must be looked up from Sent Items
    // separately, which requires Mail.Read and is out of scope while that
    // scope is gated behind ENABLE_REPLY_INGESTION. idempotencyKey is the
    // durable correlation handle until then.
    return { graphMessageId: `pending-lookup-${params.idempotencyKey}` };
  }
}

let mockTransportSingleton: MockGraphTransport | undefined;

// ENABLE_GRAPH_SEND defaults false (Sprint 0 fixed the coercion bug that
// could accidentally flip this) — the mock is the only transport reachable
// unless a caller explicitly supplies a RealGraphTransport constructed
// from a stored OAuthToken, which send-service.ts only does when the flag
// is true AND a token exists.
export function getMockGraphTransport(): GraphTransport {
  if (!mockTransportSingleton) mockTransportSingleton = new MockGraphTransport();
  return mockTransportSingleton;
}
