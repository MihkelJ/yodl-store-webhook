import { Address, Hex } from "viem";

export interface TransactionResponse {
  payment: Payment;
}

export interface Payment {
  chainId: number;
  txHash: Hex;
  paymentIndex: number;
  destinationChainId: number;
  destinationTxHash: Hex;
  blockTimestamp: string;
  tokenOutSymbol: string;
  tokenOutAddress: Address;
  tokenOutAmountGross: string;
  receiverAddress: Address;
  receiverEnsPrimaryName: string;
  receiverYodlConfig: ReceiverYodlConfig;
  invoiceCurrency: string;
  invoiceAmount: string;
  senderAddress: Address;
  senderEnsPrimaryName: string;
  memo: string;
}

export interface ReceiverYodlConfig {
  chains: string;
  tokens: string;
}
