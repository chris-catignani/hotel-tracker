import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      expect(cn('class1', { class2: true, class3: false })).toBe('class1 class2');
      expect(cn('px-2 py-2', 'px-4')).toBe('py-2 px-4'); // tailwind-merge handles this
    });
  });

  describe('formatCurrency', () => {
    it('should format numbers as USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(10.5)).toBe('$10.50');
    });

    it('should handle large numbers correctly', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });
  });
});
