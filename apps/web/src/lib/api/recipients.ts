import { get, post, patch, del } from './client';
import type { Recipient, CreateRecipientRequest, UpdateRecipientRequest } from '@/types';

export async function getRecipients(search?: string): Promise<Recipient[]> {
  return get<Recipient[]>('/recipients', search ? { params: { search } } : undefined);
}

export async function getRecipient(id: string): Promise<Recipient> {
  return get<Recipient>(`/recipients/${id}`);
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
