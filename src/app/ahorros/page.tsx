import type { Metadata } from "next";
import { SavingsAccessGate } from "@/components/malaga-access-gate";

export const metadata: Metadata = { title: "Ahorros" };

export default function SavingsPage() {
  return <SavingsAccessGate />;
}
