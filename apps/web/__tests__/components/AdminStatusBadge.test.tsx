/**
 * AdminStatusBadge component — TDD RED phase.
 */
import { render, screen } from '@testing-library/react';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';

describe('AdminStatusBadge', () => {
  it('renders active status', () => {
    render(<AdminStatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders suspended status', () => {
    render(<AdminStatusBadge status="suspended" />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('renders closed status', () => {
    render(<AdminStatusBadge status="closed" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('applies green class for active', () => {
    const { container } = render(<AdminStatusBadge status="active" />);
    expect(container.querySelector('span')?.className).toContain('green');
  });

  it('applies red class for suspended', () => {
    const { container } = render(<AdminStatusBadge status="suspended" />);
    expect(container.querySelector('span')?.className).toContain('red');
  });

  it('applies gray class for closed', () => {
    const { container } = render(<AdminStatusBadge status="closed" />);
    expect(container.querySelector('span')?.className).toContain('gray');
  });
});
