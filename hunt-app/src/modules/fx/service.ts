import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

// exchangerate.host started requiring a paid access key (discovered live
// during Sprint 7 deployment — the original choice never actually worked).
// Frankfurter is ECB-sourced, genuinely free, and needs no key.
const FX_PROVIDER_URL = 'https://api.frankfurter.app/latest';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — rates don't need to be per-second fresh

export interface FxConversion {
  rate: number;
  source: string;
  fetchedAt: Date;
  fxRateId: string;
}

// Rule 11 / doc 12: ZAR conversion must be timestamped and sourced, and
// must never replace the original currency/rate. This fails closed on any
// provider error, timeout, or malformed response — no fallback guess, no
// stale-rate reuse past the cache window. A caller that gets `null` back
// must leave zarRate/fxSource/fxTimestamp unset on the opportunity rather
// than inventing a value (doc 24/25).
export async function convertToZar(fromCurrency: string): Promise<FxConversion | null> {
  if (fromCurrency.toUpperCase() === 'ZAR') {
    return null; // nothing to convert; caller should treat original as the ZAR value directly if needed
  }

  const cached = await prisma.fxRate.findFirst({
    where: { fromCurrency: fromCurrency.toUpperCase(), toCurrency: 'ZAR' },
    orderBy: { fetchedAt: 'desc' },
  });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { rate: cached.rate, source: cached.source, fetchedAt: cached.fetchedAt, fxRateId: cached.id };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const url = `${FX_PROVIDER_URL}?from=${encodeURIComponent(fromCurrency.toUpperCase())}&to=ZAR`;
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': env.USER_AGENT } });
    if (!response.ok) {
      logger.warn({ fromCurrency, status: response.status }, 'FX provider returned non-2xx; failing closed');
      return null;
    }
    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.ZAR;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      logger.warn({ fromCurrency, data }, 'FX provider response missing a usable ZAR rate; failing closed');
      return null;
    }

    const stored = await prisma.fxRate.create({
      data: { fromCurrency: fromCurrency.toUpperCase(), toCurrency: 'ZAR', rate, source: FX_PROVIDER_URL },
    });
    return { rate, source: FX_PROVIDER_URL, fetchedAt: stored.fetchedAt, fxRateId: stored.id };
  } catch (err) {
    logger.warn({ fromCurrency, err }, 'FX conversion failed; failing closed, no rate applied');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Applies a conversion to an opportunity's rate fields, or leaves them
// untouched if none is available. Never invents zarRate.
export async function applyFxToOpportunity(opportunityId: string): Promise<void> {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  if (!opportunity.originalCurrency || opportunity.originalRate == null) return;

  const conversion = await convertToZar(opportunity.originalCurrency);
  if (!conversion) return;

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      zarRate: opportunity.originalRate * conversion.rate,
      fxSource: conversion.source,
      fxTimestamp: conversion.fetchedAt,
      fxRateId: conversion.fxRateId,
    },
  });
}
