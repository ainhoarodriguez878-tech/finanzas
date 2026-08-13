"use client";

import { LockKeyhole } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import { SavingsView } from "@/components/savings-view";

export function SavingsAccessGate() {
  const { hasMalagaAccess } = useFinance();

  if (hasMalagaAccess) return <SavingsView />;

  return (
    <div className="page restricted-page">
      <div className="card empty-state">
        <LockKeyhole size={30} />
        <h1>Sección privada</h1>
        <p>Ahorros solo está disponible en tu cuenta personal.</p>
        <AppLink href="/dashboard" className="button primary">Volver al resumen</AppLink>
      </div>
    </div>
  );
}

export const MalagaAccessGate = SavingsAccessGate;
