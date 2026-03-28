import { get, post, patch, del } from '../client';
import type { AxiosRequestConfig } from 'axios';

export type PayoutMethod = 'mobile_money' | 'bank_transfer';

export type MobileMoneyDetails = {
  phone: string;
  network: string;
};

export type BankTransferDetails = {
  accountNumber: string;
  bankCode: string;
  bankName: string;
};

export type AccountDetails = MobileMoneyDetails | BankTransferDetails;

export type Recipient = {
  id: string;
  userId: string;
  nickname: string;
  firstName: string;
  lastName: string;
  country: string;
  payoutMethod: PayoutMethod;
  accountDetails: AccountDetails;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecipientRequest = {
  nickname: string;
  firstName: string;
  lastName: string;
  country: string;
  payoutMethod: PayoutMethod;
  accountDetails: AccountDetails;
};

export type UpdateRecipientRequest = Partial<Omit<CreateRecipientRequest, 'country' | 'payoutMethod'>>;

export type GetRecipientsOptions = {
  search?: string;
};

export async function getRecipients(options?: GetRecipientsOptions): Promise<Recipient[]> {
  const config: AxiosRequestConfig | undefined = options?.search
    ? { params: { search: options.search } }
    : undefined;
  return get<Recipient[]>('/recipients', config);
}

export async function getRecipient(id: string): Promise<Recipient> {
  return get<Recipient>(`/recipients/${id}`, undefined);
}

export async function createRecipient(data: CreateRecipientRequest): Promise<Recipient> {
  return post<Recipient>('/recipients', data);
}

export async function updateRecipient(id: string, data: UpdateRecipientRequest): Promise<Recipient> {
  return patch<Recipient>(`/recipients/${id}`, data);
}

export async function deleteRecipient(id: string): Promise<void> {
  return del<void>(`/recipients/${id}`);
}
