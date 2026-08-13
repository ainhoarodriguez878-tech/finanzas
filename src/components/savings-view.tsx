"use client";

import { PiggyBank, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal } from "@/components/app-modal";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { useFinance } from "@/components/finance-provider";
import { categoryById, isSavingsTransaction } from "@/lib/finance-scope";
import { formatCurrency, roundMoney, todayIso } from "@/lib/format";

type SavingsMonth = {
  key: string;
  label: string;
  contributions: number;
  withdrawals: number;
  net: number;
  balance: number;
};

function monthRows(year: number): SavingsMonth[] {
  const formatter = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, month) => ({
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: formatter.format(new Date(Date.UTC(year, month, 1))).replace(/^./, (letter) => letter.toUpperCase()),
    contributions: 0,
    withdrawals: 0,
    net: 0,
    balance: 0,
  }));
}

function signedCurrency(value: number) {
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
}

export function SavingsView() {
  const { categories, transactions } = useFinance();
  const currentYear = Number(todayIso().slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [entryDirection, setEntryDirection] = useState<"income" | "expense" | null>(null);

  const categoriesById = useMemo(() => categoryById(categories), [categories]);
  const savingsTransactions = useMemo(
    () => transactions
      .filter((transaction) => isSavingsTransaction(transaction, categoriesById))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [categoriesById, transactions],
  );
  const years = useMemo(() => {
    const values = new Set<number>([currentYear]);
    savingsTransactions.forEach((transaction) => values.add(Number(transaction.transaction_date.slice(0, 4))));
    return [...values].sort((a, b) => b - a);
  }, [currentYear, savingsTransactions]);

  const analysis = useMemo(() => {
    const rows = monthRows(selectedYear);
    const selectedTransactions = savingsTransactions.filter((transaction) => transaction.transaction_date.startsWith(`${selectedYear}-`));

    selectedTransactions.forEach((transaction) => {
      const row = rows[Number(transaction.transaction_date.slice(5, 7)) - 1];
      if (!row) return;
      if (transaction.amount >= 0) row.contributions += transaction.amount;
      else row.withdrawals += Math.abs(transaction.amount);
    });

    let balance = 0;
    rows.forEach((row) => {
      row.contributions = roundMoney(row.contributions);
      row.withdrawals = roundMoney(row.withdrawals);
      row.net = roundMoney(row.contributions - row.withdrawals);
      balance = roundMoney(balance + row.net);
      row.balance = balance;
    });

    const contributions = roundMoney(rows.reduce((total, row) => total + row.contributions, 0));
    const withdrawals = roundMoney(rows.reduce((total, row) => total + row.withdrawals, 0));
    return {
      rows,
      selectedTransactions,
      contributions,
      withdrawals,
      net: roundMoney(contributions - withdrawals),
    };
  }, [selectedYear, savingsTransactions]);

  return (
    <div className="page property-page">
      <PageHeader
        eyebrow="Objetivo personal"
        title="Ahorros"
        description="Registra lo que apartas cada mes y consulta cómo crece tu colchón sin mezclarlo con tus gastos diarios."
        action={(
          <div className="property-actions">
            <button className="button primary" type="button" onClick={() => setEntryDirection("income")}>
              <Plus size={17} aria-hidden="true" /> Nueva aportación
            </button>
            <button className="button" type="button" onClick={() => setEntryDirection("expense")}>
              <Plus size={17} aria-hidden="true" /> Registrar retirada
            </button>
          </div>
        )}
      />

      <div className="property-year-bar">
        <div>
          <PiggyBank size={20} aria-hidden="true" />
          <label htmlFor="savings-year"><strong>Resumen mensual</strong></label>
          <select id="savings-year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <p>Las aportaciones suman y las retiradas restan. El acumulado se reinicia visualmente al comenzar cada año.</p>
      </div>

      <div className="property-summary" aria-label={`Resumen de ahorros en ${selectedYear}`}>
        <div><span>Aportado en {selectedYear}</span><strong className="positive">{formatCurrency(analysis.contributions)}</strong></div>
        <div><span>Retirado en {selectedYear}</span><strong>{formatCurrency(-analysis.withdrawals)}</strong></div>
        <div><span>Ahorro neto del año</span><strong className={analysis.net >= 0 ? "positive" : ""}>{signedCurrency(analysis.net)}</strong></div>
      </div>

      <section className="property-section" aria-labelledby="savings-months-title">
        <div className="section-heading">
          <div><p className="eyebrow">Seguimiento</p><h2 id="savings-months-title">Mes a mes</h2></div>
        </div>
        <div className="property-table-scroll">
          <table className="data-table property-dashboard-table">
            <thead><tr><th>Mes</th><th>Aportaciones</th><th>Retiradas</th><th>Ahorro del mes</th><th>Acumulado</th></tr></thead>
            <tbody>
              {analysis.rows.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.label}</strong></td>
                  <td className="amount positive">{row.contributions ? signedCurrency(row.contributions) : "—"}</td>
                  <td className="amount">{row.withdrawals ? formatCurrency(-row.withdrawals) : "—"}</td>
                  <td className={`amount ${row.net >= 0 ? "positive" : ""}`}>{row.net ? signedCurrency(row.net) : "—"}</td>
                  <td className={`amount ${row.balance >= 0 ? "positive" : ""}`}>{row.balance ? signedCurrency(row.balance) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="property-section" aria-labelledby="savings-movements-title">
        <div className="section-heading">
          <div><p className="eyebrow">Detalle</p><h2 id="savings-movements-title">Movimientos de ahorro</h2></div>
          <p className="section-note">{analysis.selectedTransactions.length ? `${analysis.selectedTransactions.length} apuntes en ${selectedYear}` : "Todavía no hay apuntes este año."}</p>
        </div>
        <TransactionList transactions={analysis.selectedTransactions} formScope="property" />
      </section>

      {entryDirection ? (
        <AppModal
          className="property-modal"
          title={entryDirection === "income" ? "Nueva aportación" : "Registrar retirada"}
          eyebrow="Ahorros"
          onClose={() => setEntryDirection(null)}
        >
          <TransactionForm
            scope="property"
            fixedDirection={entryDirection}
            onSaved={() => setEntryDirection(null)}
            onCancel={() => setEntryDirection(null)}
          />
        </AppModal>
      ) : null}
    </div>
  );
}
