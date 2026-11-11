import {
  CalculateBudgetInputSchema,
  CalculateBudgetOutputSchema,
  type CalculateBudgetInput,
  type CalculateBudgetOutput,
} from "./contracts";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateBudget(input: CalculateBudgetInput): CalculateBudgetOutput {
  const { items, budgetLimit, bufferRate } = CalculateBudgetInputSchema.parse(input);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const buffer = roundMoney(subtotal * bufferRate);
  const total = roundMoney(subtotal + buffer);
  const breakdown = Object.fromEntries(
    [...new Set(items.map((item) => item.category))].map((category) => [
      category,
      roundMoney(items.filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
    ]),
  );

  return CalculateBudgetOutputSchema.parse({
    subtotal: roundMoney(subtotal),
    buffer,
    total,
    withinBudget: total <= budgetLimit,
    breakdown,
  });
}
