import { render, screen, fireEvent } from '@testing-library/react';
import { RecipientCard } from '@/components/ui/RecipientCard';
import type { Recipient } from '@/types';

const mockRecipient: Recipient = {
  id: 'r-1',
  userId: 'u-1',
  nickname: 'Mum',
  firstName: 'Grace',
  lastName: 'Adeyemi',
  country: 'NG',
  payoutMethod: 'bank_transfer',
  accountDetails: { accountNumber: '0123456789', bankCode: '058', bankName: 'GTBank' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('RecipientCard', () => {
  it('should display nickname and full name', () => {
    render(<RecipientCard recipient={mockRecipient} />);
    expect(screen.getByText('Mum')).toBeInTheDocument();
    expect(screen.getByText('Grace Adeyemi')).toBeInTheDocument();
  });

  it('should display country', () => {
    render(<RecipientCard recipient={mockRecipient} />);
    expect(screen.getByText(/Nigeria|NG/)).toBeInTheDocument();
  });

  it('should display bank name for bank_transfer', () => {
    render(<RecipientCard recipient={mockRecipient} />);
    expect(screen.getByText(/GTBank/)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<RecipientCard recipient={mockRecipient} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockRecipient);
  });

  it('should call onEdit when edit button clicked', () => {
    const onEdit = jest.fn();
    render(<RecipientCard recipient={mockRecipient} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(mockRecipient);
  });

  it('should call onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(<RecipientCard recipient={mockRecipient} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('r-1');
  });
});
