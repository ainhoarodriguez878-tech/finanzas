import type { Category, Transaction } from "@/lib/types";

const SAVINGS_CONTEXT = "ahorros";
const LEGACY_MALAGA_CONTEXT = "piso málaga";

export function categoryById(categories: Category[]) {
  return new Map(categories.map((category) => [category.id, category]));
}

export function isSavingsTransaction(
  transaction: Transaction,
  categoriesById: Map<string, Category>,
) {
  const context = transaction.context?.trim().toLocaleLowerCase("es") ?? "";
  const category = transaction.category_id
    ? categoriesById.get(transaction.category_id)
    : undefined;

  return context === SAVINGS_CONTEXT
    || context === LEGACY_MALAGA_CONTEXT
    || category?.category_scope === "property";
}

// Alias para que los módulos históricos del fork sigan siendo compatibles.
export const isMalagaTransaction = isSavingsTransaction;
