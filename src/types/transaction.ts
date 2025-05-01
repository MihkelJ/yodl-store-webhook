export interface TransactionResponse {
  payment: Payment;
}

export interface Payment {
  chainId: number;
  txHash: string;
  paymentIndex: number;
  destinationChainId: any;
  destinationTxHash: any;
  blockTimestamp: string;
  tokenOutSymbol: string;
  tokenOutAddress: string;
  tokenOutAmountGross: string;
  receiverAddress: string;
  receiverEnsPrimaryName: string;
  receiverYodlConfig: ReceiverYodlConfig;
  invoiceCurrency: string;
  invoiceAmount: string;
  senderAddress: string;
  senderEnsPrimaryName: string;
  memo: string;
}

export interface ReceiverYodlConfig {
  chains: string;
  tokens: string;
}
