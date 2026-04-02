export function formatWon(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}
