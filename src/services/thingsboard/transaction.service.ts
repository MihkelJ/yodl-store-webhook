import createHttpError from 'http-errors';
import { ReasonPhrases } from 'http-status-codes';
import { config } from '../../config/index.js';
import { Payment, TransactionResponse } from '../../types/transaction.js';

export async function fetchTransaction(txHash: string): Promise<Payment> {
  const response = await fetch(`${config.yodl.indexerUrl}/v1/payments/${txHash}`);

  if (!response.ok) {
    throw createHttpError(response.status, ReasonPhrases.INTERNAL_SERVER_ERROR);
  }

  const { payment } = (await response.json()) as TransactionResponse;

  return payment;
}
