// One-off backfill for the 20260826000000_email_engine migration: every
// pre-existing RecruiterEmail row gets classification=UNVERIFIED by column
// default, which is correct for rows that were never independently
// verified through this engine — but a row an operator had already marked
// `verified: true` (via the old free-text verificationSource form) should
// keep presenting as verified rather than silently regressing to
// UNVERIFIED. This script writes one synthetic EmailVerification row per
// such pre-existing email (providerId 'legacy-operator-assertion',
// method 'pre-email-engine-manual-assertion') so classification can be
// derived the same way as every future verification, and then classifies.
//
// Deliberately conservative: a legacy `verified: true` with no
// verificationSource/verifiedAt on record is left UNVERIFIED — there is
// nothing to backfill a synthetic verification FROM.
import { prisma } from '../db/client';
import { logger } from '../config/logger';
import { classifyEmail } from '../modules/email-intelligence/classification';
import { EmailType, EmailVerificationResult } from '../domain/types';

async function backfillEmailClassification(): Promise<{ examined: number; backfilled: number }> {
  const emails = await prisma.recruiterEmail.findMany();
  let backfilled = 0;

  for (const email of emails) {
    let latestResult: EmailVerificationResult | null = null;

    if (email.verified && email.verificationSource && email.verifiedAt) {
      // Give every legacy verified email a real EmailVerification row so
      // it is auditable through the same §75 record as new verifications,
      // rather than a special-cased backfill flag nobody else reads.
      await prisma.emailVerification.create({
        data: {
          recruiterEmailId: email.id,
          address: email.email,
          providerId: 'legacy-operator-assertion',
          result: EmailVerificationResult.VALID,
          checkedAt: email.verifiedAt,
          method: 'pre-email-engine-manual-assertion',
          confidence: 0.5, // operator-asserted, not independently checked — lower than the 0.95 a real deterministic VALID gets
          conclusive: true,
          chainPosition: 0,
          detail: { backfilledFrom: 'RecruiterEmail.verificationSource', originalSource: email.verificationSource },
        },
      });
      latestResult = EmailVerificationResult.VALID;
    }

    // Matches the existing cast convention used at
    // recruiter-intelligence/service.ts:recomputeReadiness — the Prisma
    // client's generated enum is structurally identical to domain/types'
    // but nominally distinct to TypeScript.
    const classification = classifyEmail({ emailType: email.emailType as unknown as EmailType, latestResult });

    await prisma.recruiterEmail.update({
      where: { id: email.id },
      data: { classification, classifiedAt: new Date() },
    });
    backfilled += 1;
  }

  return { examined: emails.length, backfilled };
}

if (require.main === module) {
  backfillEmailClassification()
    .then(({ examined, backfilled }) => {
      logger.info({ examined, backfilled }, 'Email classification backfill complete');
    })
    .catch((e) => {
      logger.error({ err: e }, 'Email classification backfill failed');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { backfillEmailClassification };
