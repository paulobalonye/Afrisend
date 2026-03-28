import { render, screen } from '@testing-library/react';
import { QuoteCard } from '@/components/send/QuoteCard';
import type { RateQuote } from '@/types';

const mockQuote: RateQuote = {
  corridorId: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 145000,
  exchangeRate: 1450,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  quoteId: 'q-1',
};

describe('QuoteCard', () => {
  it('should display destination amount', () => {
    render(<QuoteCard quote={mockQuote} countdownSeconds={55} />);
    expect(screen.getByText(/145,000/)).toBeInTheDocument();
  });

  it('should display destination currency in amount row', () => {
    const { container } = render(<QuoteCard quote={mockQuote} countdownSeconds={55} />);
    // The bold destination amount span contains "NGN"
    const amountSpan = container.querySelector('.text-brand-600');
    expect(amountSpan?.textContent).toContain('NGN');
  });

  it('should display exchange rate', () => {
    render(<QuoteCard quote={mockQuote} countdownSeconds={55} />);
    expect(screen.getByText(/1,450/)).toBeInTheDocument();
  });

  it('should display fee', () => {
    render(<QuoteCard quote={mockQuote} countdownSeconds={55} />);
    expect(screen.getByText(/2\.50/)).toBeInTheDocument();
  });

  it('should display countdown timer', () => {
    render(<QuoteCard quote={mockQuote} countdownSeconds={55} />);
    const countdown = screen.getByTestId('quote-countdown');
    expect(countdown).toBeInTheDocument();
    expect(countdown.textContent).toContain('0:55');
  });

  it('should show expired style when countdown is 0', () => {
    render(<QuoteCard quote={mockQuote} countdownSeconds={0} />);
    const countdown = screen.getByTestId('quote-countdown');
    expect(countdown.className).toContain('red');
  });
});
