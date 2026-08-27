import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RatingDistribution, starBucket, type StarBucket } from '../RatingDistribution';

// The distribution counts and the star filter must share one bucket mapping,
// or the filtered list won't match the bar counts (Baymard: bars ARE filters).
describe('starBucket', () => {
  it('rounds half-stars up into the adjacent whole-star bucket', () => {
    expect(starBucket(4.5)).toBe(5);
    expect(starBucket(3.5)).toBe(4);
    expect(starBucket(3.4)).toBe(3);
  });

  it('clamps to the 1–5 range', () => {
    expect(starBucket(0.5)).toBe(1);
    expect(starBucket(0)).toBe(1);
    expect(starBucket(6)).toBe(5);
  });
});

const distribution: Record<StarBucket, number> = { 5: 4, 4: 2, 3: 0, 2: 1, 1: 1 };

describe('RatingDistribution', () => {
  it('renders one clickable bar per star with its count', () => {
    render(<RatingDistribution distribution={distribution} selected={null} onSelect={() => {}} />);
    const bars = screen.getAllByRole('button');
    // 5 star rows (no "Show all" while unfiltered)
    expect(bars).toHaveLength(5);
    expect(screen.getByRole('button', { name: /5 star reviews: 4/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 star reviews: 1/ })).toBeInTheDocument();
  });

  it('selects a star on click (radio semantics)', () => {
    const onSelect = vi.fn();
    render(<RatingDistribution distribution={distribution} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /4 star reviews/ }));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('clears the filter when the active bar is clicked again', () => {
    const onSelect = vi.fn();
    render(<RatingDistribution distribution={distribution} selected={4} onSelect={onSelect} />);
    const activeBar = screen.getByRole('button', { name: /4 star reviews.*filter active/ });
    expect(activeBar).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(activeBar);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('disables empty buckets instead of offering a dead filter', () => {
    render(<RatingDistribution distribution={distribution} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /3 star reviews: 0/ })).toBeDisabled();
  });

  it('offers "Show all reviews" while a filter is active, and it clears', () => {
    const onSelect = vi.fn();
    render(<RatingDistribution distribution={distribution} selected={5} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /show all reviews/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders nothing when there are no reviews at all', () => {
    const empty: Record<StarBucket, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const { container } = render(
      <RatingDistribution distribution={empty} selected={null} onSelect={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
