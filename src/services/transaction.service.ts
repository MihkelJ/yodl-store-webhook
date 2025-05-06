import createHttpError from 'http-errors';
import { ReasonPhrases } from 'http-status-codes';
import { Payment, TransactionResponse } from '../types/transaction.js';

export async function fetchTransaction(txHash: string): Promise<Payment> {
  const response = await fetch(
    `${process.env.YODL_INDEXER_URL}/v1/payments/${txHash}`
  );

  if (!response.ok) {
    throw createHttpError(
      response.status,
      ReasonPhrases.INTERNAL_SERVER_ERROR
    );
  }

  const { payment } = (await response.json()) as TransactionResponse;

  return payment;
}
