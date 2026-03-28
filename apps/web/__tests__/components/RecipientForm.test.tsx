import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipientForm } from '@/components/ui/RecipientForm';

jest.mock('@/lib/api/recipients', () => ({
  createRecipient: jest.fn(),
  updateRecipient: jest.fn(),
}));

import * as recipientsApi from '@/lib/api/recipients';

const mockRecipient = {
  id: 'r-1',
  userId: 'u-1',
  nickname: 'Mum',
  firstName: 'Grace',
  lastName: 'Adeyemi',
  country: 'NG',
  payoutMethod: 'bank_transfer' as const,
  accountDetails: { accountNumber: '0123456789', bankCode: '058', bankName: 'GTBank' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('RecipientForm', () => {
  const onClose = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('should render add heading when no recipient passed', () => {
    render(<RecipientForm recipient={null} onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Add recipient' })).toBeInTheDocument();
  });

  it('should render edit heading when recipient passed', () => {
    render(<RecipientForm recipient={mockRecipient} onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Edit recipient' })).toBeInTheDocument();
  });

  it('should prefill nickname field when editing', () => {
    render(<RecipientForm recipient={mockRecipient} onClose={onClose} />);
    expect(screen.getByDisplayValue('Mum')).toBeInTheDocument();
  });

  it('should prefill bank name when editing', () => {
    render(<RecipientForm recipient={mockRecipient} onClose={onClose} />);
    expect(screen.getByDisplayValue('GTBank')).toBeInTheDocument();
  });

  it('should call onClose when cancel is clicked', () => {
    render(<RecipientForm recipient={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when × is clicked', () => {
    render(<RecipientForm recipient={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call createRecipient and onClose on successful add', async () => {
    (recipientsApi.createRecipient as jest.Mock).mockResolvedValue({ ...mockRecipient, id: 'r-2' });
    render(<RecipientForm recipient={null} onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Obi');
    await userEvent.type(screen.getByLabelText(/nickname/i), 'Sis Ada');
    await userEvent.selectOptions(screen.getByLabelText(/country/i), 'NG');
    await userEvent.type(screen.getByLabelText(/bank name/i), 'GTBank');
    await userEvent.type(screen.getByLabelText(/bank code/i), '058');
    await userEvent.type(screen.getByLabelText(/account number/i), '0987654321');

    fireEvent.click(screen.getByRole('button', { name: /add recipient/i }));

    await waitFor(() => expect(recipientsApi.createRecipient).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('should call updateRecipient on successful edit', async () => {
    (recipientsApi.updateRecipient as jest.Mock).mockResolvedValue(mockRecipient);
    render(<RecipientForm recipient={mockRecipient} onClose={onClose} />);

    const nicknameInput = screen.getByDisplayValue('Mum');
    await userEvent.clear(nicknameInput);
    await userEvent.type(nicknameInput, 'Mother');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(recipientsApi.updateRecipient).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ nickname: 'Mother' }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('should show server error when API call fails', async () => {
    (recipientsApi.createRecipient as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<RecipientForm recipient={null} onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Obi');
    await userEvent.type(screen.getByLabelText(/nickname/i), 'Sis');
    await userEvent.selectOptions(screen.getByLabelText(/country/i), 'NG');
    await userEvent.type(screen.getByLabelText(/bank name/i), 'GTBank');
    await userEvent.type(screen.getByLabelText(/bank code/i), '058');
    await userEvent.type(screen.getByLabelText(/account number/i), '0987654321');

    fireEvent.click(screen.getByRole('button', { name: /add recipient/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Network error'),
    );
  });
});
