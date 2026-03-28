/**
 * User service interface + default implementation.
 *
 * Handles user profile management, saved recipients, and tier progression.
 */

// ─── Tier limits ───────────────────────────────────────────────────────────────

export const TIER_LIMITS: Readonly<Record<number, number>> = {
  0: 0,
  1: 500,
  2: 5000,
  3: 25000,
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationPreferences = {
  email: boolean;
  sms: boolean;
  push: boolean;
};

export type UserProfile = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  residenceCountry: string | null;
  preferredCurrency: string | null;
  notificationPreferences: NotificationPreferences;
  kycTier: number;
  kycStatus: string;
  monthlyLimit: number;
  createdAt: string;
};

export type RecipientAccountDetails =
  | { type: 'mobile_money'; phoneNumber: string; provider: string }
  | { type: 'bank_transfer'; accountNumber: string; bankCode: string; bankName: string };

export type SavedRecipient = {
  id: string;
  userId: string;
  name: string;
  country: string;
  payoutMethod: 'mobile_money' | 'bank_transfer';
  accountDetails: RecipientAccountDetails;
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileInput = {
  displayName?: string;
  residenceCountry?: string;
  preferredCurrency?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
};

export type CreateRecipientInput = {
  name: string;
  country: string;
  payoutMethod: 'mobile_money' | 'bank_transfer';
  accountDetails: RecipientAccountDetails;
};

export type UpdateRecipientInput = Partial<CreateRecipientInput>;

// ─── Interface ─────────────────────────────────────────────────────────────────

export interface IUserService {
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  listRecipients(userId: string): Promise<SavedRecipient[]>;
  createRecipient(userId: string, input: CreateRecipientInput): Promise<SavedRecipient>;
  updateRecipient(userId: string, recipientId: string, input: UpdateRecipientInput): Promise<SavedRecipient>;
  deleteRecipient(userId: string, recipientId: string): Promise<void>;
  updateTierFromKyc(userId: string, kycTier: number): Promise<UserProfile>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email: true,
  sms: true,
  push: true,
};

// ─── In-memory implementation ─────────────────────────────────────────────────

type StoredProfile = UserProfile;
type StoredRecipient = SavedRecipient;

export class DefaultUserService implements IUserService {
  private readonly profiles = new Map<string, StoredProfile>();
  private readonly recipients = new Map<string, StoredRecipient[]>();

  async getProfile(userId: string): Promise<UserProfile> {
    const existing = this.profiles.get(userId);
    if (existing) return { ...existing };

    // Bootstrap a default profile for new users
    const profile: StoredProfile = {
      id: userId,
      email: null,
      phone: null,
      firstName: '',
      lastName: '',
      displayName: null,
      residenceCountry: null,
      preferredCurrency: null,
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFS },
      kycTier: 0,
      kycStatus: 'none',
      monthlyLimit: TIER_LIMITS[0],
      createdAt: new Date().toISOString(),
    };
    this.profiles.set(userId, profile);
    return { ...profile };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const current = await this.getProfile(userId);
    const updated: StoredProfile = {
      ...current,
      displayName: input.displayName !== undefined ? input.displayName : current.displayName,
      residenceCountry: input.residenceCountry !== undefined ? input.residenceCountry : current.residenceCountry,
      preferredCurrency: input.preferredCurrency !== undefined ? input.preferredCurrency : current.preferredCurrency,
      notificationPreferences: input.notificationPreferences
        ? { ...current.notificationPreferences, ...input.notificationPreferences }
        : current.notificationPreferences,
    };
    this.profiles.set(userId, updated);
    return { ...updated };
  }

  async listRecipients(userId: string): Promise<SavedRecipient[]> {
    return (this.recipients.get(userId) ?? []).map(r => ({ ...r }));
  }

  async createRecipient(userId: string, input: CreateRecipientInput): Promise<SavedRecipient> {
    const now = new Date().toISOString();
    const recipient: StoredRecipient = {
      id: generateId(),
      userId,
      name: input.name,
      country: input.country,
      payoutMethod: input.payoutMethod,
      accountDetails: { ...input.accountDetails },
      createdAt: now,
      updatedAt: now,
    };
    const existing = this.recipients.get(userId) ?? [];
    this.recipients.set(userId, [...existing, recipient]);
    return { ...recipient };
  }

  async updateRecipient(
    userId: string,
    recipientId: string,
    input: UpdateRecipientInput,
  ): Promise<SavedRecipient> {
    const list = this.recipients.get(userId) ?? [];
    const idx = list.findIndex(r => r.id === recipientId);
    if (idx === -1) throw new Error('Recipient not found');

    const current = list[idx];
    const updated: StoredRecipient = {
      ...current,
      name: input.name !== undefined ? input.name : current.name,
      country: input.country !== undefined ? input.country : current.country,
      payoutMethod: input.payoutMethod !== undefined ? input.payoutMethod : current.payoutMethod,
      accountDetails: input.accountDetails !== undefined ? { ...input.accountDetails } : current.accountDetails,
      updatedAt: new Date().toISOString(),
    };
    const newList = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
    this.recipients.set(userId, newList);
    return { ...updated };
  }

  async deleteRecipient(userId: string, recipientId: string): Promise<void> {
    const list = this.recipients.get(userId) ?? [];
    const idx = list.findIndex(r => r.id === recipientId);
    if (idx === -1) throw new Error('Recipient not found');
    this.recipients.set(userId, [...list.slice(0, idx), ...list.slice(idx + 1)]);
  }

  async updateTierFromKyc(userId: string, kycTier: number): Promise<UserProfile> {
    const current = await this.getProfile(userId);
    const tier = Math.min(Math.max(Math.floor(kycTier), 0), 3) as 0 | 1 | 2 | 3;
    const updated: StoredProfile = {
      ...current,
      kycTier: tier,
      monthlyLimit: TIER_LIMITS[tier] ?? 0,
    };
    this.profiles.set(userId, updated);
    return { ...updated };
  }
}
