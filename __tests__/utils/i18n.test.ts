import { SUPPORTED_LANGUAGES, getLanguageName } from '../../src/i18n';

describe('i18n', () => {
  it('supports English, French, and Portuguese', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('fr');
    expect(SUPPORTED_LANGUAGES).toContain('pt');
  });

  it('returns correct language names', () => {
    expect(getLanguageName('en')).toBe('English');
    expect(getLanguageName('fr')).toBe('Français');
    expect(getLanguageName('pt')).toBe('Português');
  });

  it('has exactly 3 supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(3);
  });
});
