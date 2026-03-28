import { get, post } from './client';
import type { Corridor, RateQuote, Payment, PaymentMethod } from '@/types';

export type GetRatesRequest = {
  corridorId: string;
  sourceAmount: number;
  refreshIntervalSeconds?: number;
};

export type InitiatePaymentRequest = {
  quoteId: string;
  recipientId: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
};

export async function listSupportedCorridors(): Promise<Corridor[]> {
  return get<Corridor[]>('/fx/corridors');
}

export async function getRates(req: GetRatesRequest): Promise<RateQuote> {
  return post<RateQuote>('/fx/rates', req);
}

export async function initiatePayment(req: InitiatePaymentRequest): Promise<Payment> {
  return post<Payment>('/remittance/initiate', req);
}

export async function getPaymentStatus(paymentId: string): Promise<Payment> {
  return get<Payment>(`/remittance/${paymentId}`);
}
