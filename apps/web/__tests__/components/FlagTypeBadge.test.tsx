/**
 * FlagTypeBadge component — TDD RED phase.
 */
import { render, screen } from '@testing-library/react';
import { FlagTypeBadge } from '@/components/admin/FlagTypeBadge';

describe('FlagTypeBadge', () => {
  it('renders aml_alert flag', () => {
    render(<FlagTypeBadge flagType="aml_alert" />);
    expect(screen.getByText('AML Alert')).toBeInTheDocument();
  });

  it('renders sanctions_hit flag', () => {
    render(<FlagTypeBadge flagType="sanctions_hit" />);
    expect(screen.getByText('Sanctions Hit')).toBeInTheDocument();
  });

  it('renders manual_review flag', () => {
    render(<FlagTypeBadge flagType="manual_review" />);
    expect(screen.getByText('Manual Review')).toBeInTheDocument();
  });

  it('renders high_risk flag', () => {
    render(<FlagTypeBadge flagType="high_risk" />);
    expect(screen.getByText('High Risk')).toBeInTheDocument();
  });

  it('applies orange class for aml_alert', () => {
    const { container } = render(<FlagTypeBadge flagType="aml_alert" />);
    expect(container.querySelector('span')?.className).toContain('orange');
  });

  it('applies red class for sanctions_hit', () => {
    const { container } = render(<FlagTypeBadge flagType="sanctions_hit" />);
    expect(container.querySelector('span')?.className).toContain('red');
  });
});
