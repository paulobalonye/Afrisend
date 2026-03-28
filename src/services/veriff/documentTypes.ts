/**
 * Veriff-supported document types mapped per jurisdiction (ISO 3166-1 alpha-2).
 * Controls which document types the session creation will offer per country.
 */

export type VeriffDocumentType = 'passport' | 'national_id' | 'driver_license' | 'residence_permit';

const PASSPORT: VeriffDocumentType = 'passport';
const NATIONAL_ID: VeriffDocumentType = 'national_id';
const DRIVER_LICENSE: VeriffDocumentType = 'driver_license';
const RESIDENCE_PERMIT: VeriffDocumentType = 'residence_permit';

/**
 * Per-jurisdiction document type configuration.
 * First entry in the array is the default/preferred document type.
 */
const JURISDICTION_DOCUMENT_TYPES: Record<string, VeriffDocumentType[]> = {
  // West Africa
  NG: [PASSPORT, NATIONAL_ID, DRIVER_LICENSE],
  GH: [PASSPORT, NATIONAL_ID, DRIVER_LICENSE],
  SN: [PASSPORT, NATIONAL_ID],
  CI: [PASSPORT, NATIONAL_ID],

  // East Africa
  KE: [PASSPORT, NATIONAL_ID, DRIVER_LICENSE],
  TZ: [PASSPORT, NATIONAL_ID],
  UG: [PASSPORT, NATIONAL_ID],
  ET: [PASSPORT, NATIONAL_ID],

  // Southern Africa
  ZA: [PASSPORT, NATIONAL_ID, DRIVER_LICENSE],
  ZW: [PASSPORT, NATIONAL_ID],

  // North Africa
  EG: [PASSPORT, NATIONAL_ID],
  MA: [PASSPORT, NATIONAL_ID],

  // International fallback
  DEFAULT: [PASSPORT, RESIDENCE_PERMIT, DRIVER_LICENSE],
};

/**
 * Returns supported document types for a given country code.
 * Falls back to the DEFAULT list for unsupported jurisdictions.
 */
export function getSupportedDocumentTypes(countryCode: string): VeriffDocumentType[] {
  const upper = countryCode.toUpperCase();
  return JURISDICTION_DOCUMENT_TYPES[upper] ?? JURISDICTION_DOCUMENT_TYPES.DEFAULT;
}

/**
 * Returns the default (preferred) document type for a given country code.
 */
export function getDefaultDocumentType(countryCode: string): VeriffDocumentType {
  const types = getSupportedDocumentTypes(countryCode);
  return types[0];
}

/**
 * Returns true when the given document type is accepted in a jurisdiction.
 */
export function isDocumentTypeSupported(
  documentType: VeriffDocumentType,
  countryCode: string,
): boolean {
  return getSupportedDocumentTypes(countryCode).includes(documentType);
}
