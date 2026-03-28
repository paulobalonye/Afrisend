/**
 * KycTierBadge component — TDD RED phase.
 */
import { render, screen } from '@testing-library/react';
import { KycTierBadge } from '@/components/admin/KycTierBadge';

describe('KycTierBadge', () => {
  it('renders Tier 0 for kycTier 0', () => {
    render(<KycTierBadge tier={0} />);
    expect(screen.getByText('Tier 0')).toBeInTheDocument();
  });

  it('renders Tier 1', () => {
    render(<KycTierBadge tier={1} />);
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
  });

  it('renders Tier 2', () => {
    render(<KycTierBadge tier={2} />);
    expect(screen.getByText('Tier 2')).toBeInTheDocument();
  });

  it('renders Tier 3', () => {
    render(<KycTierBadge tier={3} />);
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
  });

  it('applies muted class for tier 0', () => {
    const { container } = render(<KycTierBadge tier={0} />);
    expect(container.querySelector('span')?.className).toContain('gray');
  });

  it('applies green class for tier 3', () => {
    const { container } = render(<KycTierBadge tier={3} />);
    expect(container.querySelector('span')?.className).toContain('green');
  });
});
