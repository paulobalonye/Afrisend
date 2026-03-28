import {
  getSupportedDocumentTypes,
  getDefaultDocumentType,
  isDocumentTypeSupported,
} from '../../../src/services/veriff/documentTypes';

describe('getSupportedDocumentTypes', () => {
  it('returns Nigeria-specific document types', () => {
    const types = getSupportedDocumentTypes('NG');
    expect(types).toContain('passport');
    expect(types).toContain('national_id');
    expect(types).toContain('driver_license');
  });

  it('is case-insensitive for country codes', () => {
    const upper = getSupportedDocumentTypes('KE');
    const lower = getSupportedDocumentTypes('ke');
    expect(upper).toEqual(lower);
  });

  it('falls back to DEFAULT list for unknown country code', () => {
    const types = getSupportedDocumentTypes('XX');
    expect(types.length).toBeGreaterThan(0);
    expect(types).toContain('passport');
  });

  it('returns South Africa document types', () => {
    const types = getSupportedDocumentTypes('ZA');
    expect(types).toContain('passport');
    expect(types).toContain('national_id');
  });
});

describe('getDefaultDocumentType', () => {
  it('returns passport as default for most African countries', () => {
    expect(getDefaultDocumentType('NG')).toBe('passport');
    expect(getDefaultDocumentType('KE')).toBe('passport');
    expect(getDefaultDocumentType('GH')).toBe('passport');
  });

  it('returns passport as default for unknown jurisdictions', () => {
    expect(getDefaultDocumentType('ZZ')).toBe('passport');
  });
});

describe('isDocumentTypeSupported', () => {
  it('returns true for supported document types', () => {
    expect(isDocumentTypeSupported('passport', 'NG')).toBe(true);
    expect(isDocumentTypeSupported('national_id', 'NG')).toBe(true);
    expect(isDocumentTypeSupported('driver_license', 'NG')).toBe(true);
  });

  it('returns false for unsupported document types', () => {
    // Senegal does not include driver_license
    expect(isDocumentTypeSupported('driver_license', 'SN')).toBe(false);
  });

  it('returns true for passport in any jurisdiction', () => {
    expect(isDocumentTypeSupported('passport', 'XX')).toBe(true);
  });
});
