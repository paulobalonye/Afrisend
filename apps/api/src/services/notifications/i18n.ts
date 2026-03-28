/**
 * Localization strings for notification templates.
 * Supported locales: en, fr, pt.
 * Falls back to 'en' for unsupported locales.
 */

export type Locale = 'en' | 'fr' | 'pt';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr', 'pt'];

export function resolveLocale(raw: string): Locale {
  if (SUPPORTED_LOCALES.includes(raw as Locale)) {
    return raw as Locale;
  }
  return 'en';
}

// ─── String maps ──────────────────────────────────────────────────────────────

export type NotificationStrings = {
  transactionInitiated: {
    emailSubject: string;
    emailTitle: string;
    pushTitle: string;
    pushBody: (amount: string, currency: string) => string;
  };
  transactionCompleted: {
    emailSubject: string;
    emailTitle: string;
    pushTitle: string;
    pushBody: (amount: string, currency: string) => string;
  };
  transactionFailed: {
    emailSubject: string;
    emailTitle: string;
    pushTitle: string;
    pushBody: (reason?: string) => string;
  };
  kycApproved: {
    emailSubject: string;
    emailTitle: string;
    pushTitle: string;
    pushBody: string;
  };
  payoutDelivered: {
    emailSubject: string;
    emailTitle: string;
    pushTitle: string;
    pushBody: (amount: string, currency: string) => string;
  };
};

export const strings: Record<Locale, NotificationStrings> = {
  en: {
    transactionInitiated: {
      emailSubject: 'Transfer initiated — your money is on its way',
      emailTitle: 'Transfer Initiated',
      pushTitle: 'Transfer Initiated',
      pushBody: (amount, currency) => `Your transfer of ${amount} ${currency} is being processed.`,
    },
    transactionCompleted: {
      emailSubject: 'Transfer completed successfully',
      emailTitle: 'Transfer Completed',
      pushTitle: 'Transfer Complete',
      pushBody: (amount, currency) => `Your transfer of ${amount} ${currency} was completed.`,
    },
    transactionFailed: {
      emailSubject: 'Transfer failed — action required',
      emailTitle: 'Transfer Failed',
      pushTitle: 'Transfer Failed',
      pushBody: (reason?) => reason ? `Your transfer failed: ${reason}` : 'Your transfer could not be completed.',
    },
    kycApproved: {
      emailSubject: 'Your identity has been verified — account approved',
      emailTitle: 'Identity Verified',
      pushTitle: 'Identity Verified',
      pushBody: 'Your account has been approved. You can now send money.',
    },
    payoutDelivered: {
      emailSubject: 'Payout delivered to recipient',
      emailTitle: 'Payout Delivered',
      pushTitle: 'Payout Delivered',
      pushBody: (amount, currency) => `${amount} ${currency} has been delivered to your recipient.`,
    },
  },

  fr: {
    transactionInitiated: {
      emailSubject: 'Transfert initié — votre argent est en route',
      emailTitle: 'Transfert Initié',
      pushTitle: 'Transfert Initié',
      pushBody: (amount, currency) => `Votre transfert de ${amount} ${currency} est en cours de traitement.`,
    },
    transactionCompleted: {
      emailSubject: 'Transfert terminée avec succès',
      emailTitle: 'Transfert Réussie',
      pushTitle: 'Transfert Réussie',
      pushBody: (amount, currency) => `Votre transfert de ${amount} ${currency} a été complété.`,
    },
    transactionFailed: {
      emailSubject: 'Transfert échoué — action requise',
      emailTitle: 'Transfert Échoué',
      pushTitle: 'Transfert Échoué',
      pushBody: (reason?) => reason ? `Votre transfert a échoué : ${reason}` : 'Votre transfert n\'a pas pu être complété.',
    },
    kycApproved: {
      emailSubject: 'Votre identité a été vérifiée — compte approuvé',
      emailTitle: 'Identité Vérifiée',
      pushTitle: 'Identité Vérifiée',
      pushBody: 'Votre compte a été approuvé. Vous pouvez maintenant envoyer de l\'argent.',
    },
    payoutDelivered: {
      emailSubject: 'Paiement livré au bénéficiaire',
      emailTitle: 'Paiement Livré',
      pushTitle: 'Paiement Livré',
      pushBody: (amount, currency) => `${amount} ${currency} a été livré à votre bénéficiaire.`,
    },
  },

  pt: {
    transactionInitiated: {
      emailSubject: 'Transferência iniciada — o seu dinheiro está a caminho',
      emailTitle: 'Transferência Iniciada',
      pushTitle: 'Transferência Iniciada',
      pushBody: (amount, currency) => `A sua transferência de ${amount} ${currency} está a ser processada.`,
    },
    transactionCompleted: {
      emailSubject: 'Transferência concluída com sucesso',
      emailTitle: 'Transferência Concluída',
      pushTitle: 'Transferência Concluída',
      pushBody: (amount, currency) => `A sua transferência de ${amount} ${currency} foi concluída.`,
    },
    transactionFailed: {
      emailSubject: 'Transferência falhou — ação necessária',
      emailTitle: 'Transferência Falhou',
      pushTitle: 'Transferência Falhou',
      pushBody: (reason?) => reason ? `A sua transferência falhou: ${reason}` : 'A sua transferência não pôde ser concluída.',
    },
    kycApproved: {
      emailSubject: 'A sua identidade foi verificada — conta aprovada',
      emailTitle: 'Identidade Verificada',
      pushTitle: 'Identidade Verificada',
      pushBody: 'A sua conta foi aprovada. Já pode enviar dinheiro.',
    },
    payoutDelivered: {
      emailSubject: 'Pagamento entregue ao destinatário',
      emailTitle: 'Pagamento Entregue',
      pushTitle: 'Pagamento Entregue',
      pushBody: (amount, currency) => `${amount} ${currency} foi entregue ao seu destinatário.`,
    },
  },
};
