import createHttpError from 'http-errors';
import { Payment, TransactionResponse } from '../types/transaction.js';

export async function fetchTransaction(txHash: string): Promise<Payment> {
  const response = await fetch(
    `${process.env.YODL_INDEXER_URL}/v1/payments/${txHash}`
  );

  if (!response.ok) {
    throw createHttpError(response.status, response.statusText);
  }

  const { payment } = (await response.json()) as TransactionResponse;

  return payment;
}
