import createHttpError from 'http-errors';
import { ReasonPhrases } from 'http-status-codes';
import { config } from '../config/index.js';
import { Payment, TransactionResponse } from '../types/transaction.js';

export async function fetchTransaction(txHash: string, logger?: any): Promise<Payment> {
  const startTime = Date.now();
  const url = `${config.yodl.indexerUrl}/v1/payments/${txHash}`;
  
  logger?.info('Fetching transaction from YODL indexer', {
    txHash,
    url,
    startTime,
  });

  try {
    const response = await fetch(url);
    const fetchDuration = Date.now() - startTime;

    logger?.info('YODL indexer response received', {
      txHash,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      fetchDuration,
    });

    if (!response.ok) {
      logger?.error('YODL indexer request failed', {
        txHash,
        status: response.status,
        statusText: response.statusText,
        url,
        fetchDuration,
      });
      throw createHttpError(response.status, ReasonPhrases.INTERNAL_SERVER_ERROR);
    }

    const responseData = (await response.json()) as TransactionResponse;
    const totalDuration = Date.now() - startTime;

    logger?.info('Transaction successfully fetched and parsed', {
      txHash,
      payment: {
        senderAddress: responseData.payment.senderAddress,
        receiverAddress: responseData.payment.receiverAddress,
        receiverEnsPrimaryName: responseData.payment.receiverEnsPrimaryName,
        invoiceAmount: responseData.payment.invoiceAmount,
        invoiceCurrency: responseData.payment.invoiceCurrency,
        memo: responseData.payment.memo,
      },
      totalDuration,
    });

    return responseData.payment;
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    
    logger?.error('Failed to fetch transaction', {
      txHash,
      url,
      error: error instanceof Error ? error.message : String(error),
      errorDuration,
    });

    // Re-throw if it's already an HTTP error
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }

    // Wrap other errors
    throw createHttpError(500, `Failed to fetch transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
}
