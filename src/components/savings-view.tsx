"use client";

import { ArrowDownToLine, CalendarClock, Pencil, PiggyBank, Plus, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal } from "@/components/app-modal";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { useFinance } from "@/components/finance-provider";
import { categoryById, isSavingsTransaction } from "@/lib/finance-scope";
import { formatCurrency, formatDate, roundMoney, todayIso } from "@/lib/format";
import type { RecurringRule, SavingsAutomationInput } from "@/lib/types";

type SavingsMonth = {
  key: string;
  label: string;
  normalContributions: number;
  investmentContributions: number;
  normalWithdrawals: number;
  investmentWithdrawals: number;
  totalNet: number;
  normalBalance: number;
  investmentBalance: number;
};

type SavingsAutomationSummary = {
  totalAmount: number;
  investmentAmount: number;
  effectiveFrom: string;
  isActive: boolean;
};

function monthRows(year: number): SavingsMonth[] {
  const formatter = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, month) => ({
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: formatter.format(new Date(Date.UTC(year, month, 1))).replace(/^./, (letter) => letter.toUpperCase()),
    normalContributions: 0,
    investmentContributions: 0,
    normalWithdrawals: 0,
    investmentWithdrawals: 0,
    totalNet: 0,
    normalBalance: 0,
    investmentBalance: 0,
  }));
}

function signedCurrency(value: number) {
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
}

function parseAmount(value: string) {
  return Number(value.replace(",", "."));
}

function automationFromRules(rules: RecurringRule[], today: string): SavingsAutomationSummary | null {
  const normal = rules.find((rule) => rule.name === "Ahorro automático");
  const investment = rules.find((rule) => rule.name === "Inversión automática");
  if (!normal && !investment) return null;
  return {
    totalAmount: roundMoney(Math.abs(Number(normal?.amount ?? 0)) + Math.abs(Number(investment?.amount ?? 0))),
    investmentAmount: roundMoney(Math.abs(Number(investment?.amount ?? 0))),
    effectiveFrom: normal?.effective_from ?? investment?.effective_from ?? today,
    isActive: Boolean(normal?.is_active || investment?.is_active),
  };
}

export function SavingsView() {
  const { categories, recurringRules, subcategories, transactions } = useFinance();
  const currentYear = Number(todayIso().slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [entryDirection, setEntryDirection] = useState<"income" | "expense" | "investment" | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);

  const categoriesById = useMemo(() => categoryById(categories), [categories]);
  const subcategoryNames = useMemo(() => new Map(subcategories.map((item) => [item.id, item.name])), [subcategories]);
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
  const automationRules = useMemo(
    () => recurringRules.filter((rule) =>
      rule.context?.toLocaleLowerCase("es") === "ahorros"
      && (rule.name === "Ahorro automático" || rule.name === "Inversión automática"),
    ),
    [recurringRules],
  );
  const automation = useMemo(
    () => automationFromRules(automationRules, todayIso()),
    [automationRules],
  );

  const analysis = useMemo(() => {
    const rows = monthRows(selectedYear);
    const selectedTransactions = savingsTransactions.filter((transaction) => transaction.transaction_date.startsWith(`${selectedYear}-`));

    selectedTransactions.forEach((transaction) => {
      const row = rows[Number(transaction.transaction_date.slice(5, 7)) - 1];
      if (!row) return;
      const subcategory = subcategoryNames.get(transaction.subcategory_id ?? "")?.toLocaleLowerCase("es") ?? "";
      const investment = subcategory === "inversión" || subcategory === "desinversión";
      if (transaction.amount >= 0) {
        if (investment) row.investmentContributions += transaction.amount;
        else row.normalContributions += transaction.amount;
      } else if (investment) {
        row.investmentWithdrawals += Math.abs(transaction.amount);
      } else {
        row.normalWithdrawals += Math.abs(transaction.amount);
      }
    });

    let normalBalance = 0;
    let investmentBalance = 0;
    rows.forEach((row) => {
      row.normalContributions = roundMoney(row.normalContributions);
      row.investmentContributions = roundMoney(row.investmentContributions);
      row.normalWithdrawals = roundMoney(row.normalWithdrawals);
      row.investmentWithdrawals = roundMoney(row.investmentWithdrawals);
      const normalNet = row.normalContributions - row.normalWithdrawals;
      const investmentNet = row.investmentContributions - row.investmentWithdrawals;
      row.totalNet = roundMoney(normalNet + investmentNet);
      normalBalance = roundMoney(normalBalance + normalNet);
      investmentBalance = roundMoney(investmentBalance + investmentNet);
      row.normalBalance = normalBalance;
      row.investmentBalance = investmentBalance;
    });

    const normalContributions = roundMoney(rows.reduce((total, row) => total + row.normalContributions, 0));
    const investmentContributions = roundMoney(rows.reduce((total, row) => total + row.investmentContributions, 0));
    const normalWithdrawals = roundMoney(rows.reduce((total, row) => total + row.normalWithdrawals, 0));
    const investmentWithdrawals = roundMoney(rows.reduce((total, row) => total + row.investmentWithdrawals, 0));
    return {
      rows,
      selectedTransactions,
      normalNet: roundMoney(normalContributions - normalWithdrawals),
      investmentNet: roundMoney(investmentContributions - investmentWithdrawals),
      totalNet: roundMoney(normalContributions + investmentContributions - normalWithdrawals - investmentWithdrawals),
      totalWithdrawals: roundMoney(normalWithdrawals + investmentWithdrawals),
    };
  }, [selectedYear, savingsTransactions, subcategoryNames]);

  return (
    <div className="page property-page">
      <PageHeader
        eyebrow="Objetivo personal"
        title="Ahorros"
        description="Registra lo que apartas cada mes, separa la parte invertida y consulta qué dinero sigue disponible."
        action={(
          <div className="property-actions">
            <button className="button primary" type="button" onClick={() => setEntryDirection("income")}>
              <Plus size={17} aria-hidden="true" /> Nueva aportación
            </button>
            <button className="button" type="button" onClick={() => setEntryDirection("investment")}>
              <TrendingUp size={17} aria-hidden="true" /> Nueva inversión
            </button>
            <button className="button" type="button" onClick={() => setEntryDirection("expense")}>
              <ArrowDownToLine size={17} aria-hidden="true" /> Registrar retirada
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
        <p>La inversión se muestra aparte del ahorro normal. El balance disponible del resumen descuenta ambos apartados.</p>
      </div>

      <section className="card savings-automation" aria-labelledby="savings-automation-title">
        <div className="savings-automation-head">
          <div>
            <p className="eyebrow"><CalendarClock size={15} aria-hidden="true" /> Automático</p>
            <h2 id="savings-automation-title">Ahorro mensual programado</h2>
            <p>Se crea cada mes el importe indicado y se descuenta del balance disponible para gastar.</p>
          </div>
          <button className="button small" type="button" onClick={() => setAutomationOpen(true)}>
            {automation ? <Pencil size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
            {automation ? "Editar automatización" : "Automatizar ahorro"}
          </button>
        </div>
        {automation ? (
          <div className="savings-automation-summary">
            <div><span>Total cada mes</span><strong>{formatCurrency(automation.totalAmount)}</strong></div>
            <div><span>Ahorro normal</span><strong className="positive">{formatCurrency(automation.totalAmount - automation.investmentAmount)}</strong></div>
            <div><span>Inversión</span><strong>{formatCurrency(automation.investmentAmount)}</strong></div>
            <div><span>Comienza</span><strong>{formatDate(automation.effectiveFrom)}</strong></div>
            <span className={`badge ${automation.isActive ? "green" : ""}`}>{automation.isActive ? "Activa" : "En pausa"}</span>
          </div>
        ) : (
          <p className="savings-automation-empty">Todavía no hay una cantidad mensual automática. Puedes repartir una parte entre ahorro normal y otra entre inversión.</p>
        )}
      </section>

      <div className="property-summary savings-summary" aria-label={`Resumen de ahorros en ${selectedYear}`}>
        <div><span>Ahorro normal</span><strong className={analysis.normalNet >= 0 ? "positive" : ""}>{signedCurrency(analysis.normalNet)}</strong></div>
        <div><span>Invertido</span><strong className={analysis.investmentNet >= 0 ? "positive" : ""}>{signedCurrency(analysis.investmentNet)}</strong></div>
        <div><span>Saldo total actual</span><strong className={analysis.totalNet >= 0 ? "positive" : ""}>{signedCurrency(analysis.totalNet)}</strong></div>
        <div><span>Retirado</span><strong>{formatCurrency(-analysis.totalWithdrawals)}</strong></div>
      </div>

      <section className="property-section" aria-labelledby="savings-months-title">
        <div className="section-heading">
          <div><p className="eyebrow">Seguimiento</p><h2 id="savings-months-title">Mes a mes</h2></div>
        </div>
        <div className="property-table-scroll">
          <table className="data-table property-dashboard-table savings-table">
            <thead><tr><th>Mes</th><th>Ahorro normal</th><th>Inversión</th><th>Retiradas</th><th>Neto del mes</th><th>Normal acumulado</th><th>Invertido acumulado</th></tr></thead>
            <tbody>
              {analysis.rows.map((row) => {
                const withdrawals = row.normalWithdrawals + row.investmentWithdrawals;
                return (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong></td>
                    <td className="amount positive">{row.normalContributions ? signedCurrency(row.normalContributions) : "—"}</td>
                    <td className="amount">{row.investmentContributions ? signedCurrency(row.investmentContributions) : "—"}</td>
                    <td className="amount">{withdrawals ? formatCurrency(-withdrawals) : "—"}</td>
                    <td className={`amount ${row.totalNet >= 0 ? "positive" : ""}`}>{row.totalNet ? signedCurrency(row.totalNet) : "—"}</td>
                    <td className={`amount ${row.normalBalance >= 0 ? "positive" : ""}`}>{row.normalBalance ? signedCurrency(row.normalBalance) : "—"}</td>
                    <td className={`amount ${row.investmentBalance >= 0 ? "positive" : ""}`}>{row.investmentBalance ? signedCurrency(row.investmentBalance) : "—"}</td>
                  </tr>
                );
              })}
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
          title={entryDirection === "investment" ? "Nueva inversión" : entryDirection === "income" ? "Nueva aportación" : "Registrar retirada"}
          eyebrow="Ahorros"
          onClose={() => setEntryDirection(null)}
        >
          <TransactionForm
            scope="property"
            fixedDirection={entryDirection === "investment" ? "income" : entryDirection}
            preferredSubcategoryName={entryDirection === "investment" ? "Inversión" : entryDirection === "expense" ? "Retirada" : undefined}
            onSaved={() => setEntryDirection(null)}
            onCancel={() => setEntryDirection(null)}
          />
        </AppModal>
      ) : null}

      {automationOpen ? (
        <AppModal
          className="property-modal savings-automation-modal"
          title={automation ? "Editar automatización" : "Automatizar ahorro"}
          eyebrow="Ahorros"
          onClose={() => setAutomationOpen(false)}
        >
          <SavingsAutomationForm
            initial={automation}
            onSaved={() => setAutomationOpen(false)}
            onCancel={() => setAutomationOpen(false)}
          />
        </AppModal>
      ) : null}
    </div>
  );
}

function SavingsAutomationForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: SavingsAutomationSummary | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { saveSavingsAutomation } = useFinance();
  const [totalAmount, setTotalAmount] = useState(initial ? String(initial.totalAmount) : "");
  const [investmentAmount, setInvestmentAmount] = useState(initial ? String(initial.investmentAmount) : "");
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom ?? todayIso());
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const total = parseAmount(totalAmount);
  const investment = parseAmount(investmentAmount || "0");
  const normal = Number.isFinite(total) && Number.isFinite(investment) ? Math.max(0, total - investment) : 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const input: SavingsAutomationInput = {
      total_amount: total,
      investment_amount: investment,
      effective_from: effectiveFrom,
      is_active: isActive,
    };
    try {
      await saveSavingsAutomation(input);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la automatización.");
    }
  }

  return (
    <form className="quick-form savings-automation-form" onSubmit={(event) => void submit(event)}>
      <p className="form-intro">Indica cuánto apartas cada mes. La parte de inversión se registrará separada y ambas cantidades dejarán de contar como dinero disponible para gastar.</p>
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <div className="field">
        <label htmlFor="savings-total">Total que apartas cada mes</label>
        <input id="savings-total" type="text" inputMode="decimal" placeholder="0,00" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="savings-investment">De ese total, cuánto va a inversión</label>
        <input id="savings-investment" type="text" inputMode="decimal" placeholder="0,00" value={investmentAmount} onChange={(event) => setInvestmentAmount(event.target.value)} />
        <span className="field-help">Ahorro normal automático: {Number.isFinite(normal) ? formatCurrency(normal) : "—"}.</span>
      </div>
      <div className="field">
        <label htmlFor="savings-start">Empezar el</label>
        <input id="savings-start" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required />
        <span className="field-help">Se repetirá cada mes en el mismo día.</span>
      </div>
      <label className="check-row" htmlFor="savings-active">
        <input id="savings-active" type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        <span>Crear los apuntes automáticamente</span>
      </label>
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>Cancelar</button>
        <button className="button primary" type="submit">Guardar automatización</button>
      </div>
    </form>
  );
}
