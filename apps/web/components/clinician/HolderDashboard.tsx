"use client";
import { useState } from "react";
import type { CredentialItem } from "@/lib/api";
import { CredentialLargeCard } from "./CredentialLargeCard";
import { FocusMode } from "./FocusMode";

const DEMO: CredentialItem[] = [
  {
    id: "1", name: "Medical License — California", issuer: "Medical Board of California",
    scope: "Full Medical Practice", status: "Valid", claimLevel: "L3",
    issueDate: "2020-06-15", expirationDate: "2026-06-15",
    licenseNumber: "G-78432", npi: "1003000126", holderName: "Dr. Jordan Ellis",
    pouBinding: "Employment: Valley Health System",
    methodologyVersion: "vitalcv.psv/2.1.0",
    audit: { sourceQueried: "CA Medical Board API" },
  },
  {
    id: "2", name: "Board Certification — Internal Medicine", issuer: "American Board of Internal Medicine",
    scope: "Internal Medicine", status: "Valid", claimLevel: "L2",
    issueDate: "2019-09-01", expirationDate: "2029-09-01",
    pouBinding: "Privileging: Valley Health",
  },
  {
    id: "3", name: "DEA Registration", issuer: "Drug Enforcement Administration",
    scope: "Schedule II-V", status: "Expiring", claimLevel: "L2",
    issueDate: "2021-01-10", expirationDate: "2025-01-10",
  },
  {
    id: "4", name: "NPI — 1003000126", issuer: "CMS / NPPES",
    scope: "National Provider", status: "Valid", claimLevel: "L3",
    issueDate: "2018-03-20",
  },
  {
    id: "5", name: "Doctor of Medicine", issuer: "Stanford University School of Medicine",
    scope: "Medical Degree", status: "Valid", claimLevel: "L1",
    issueDate: "2016-06-01",
  },
  {
    id: "6", name: "OIG Exclusion Check", issuer: "HHS Office of Inspector General",
    scope: "Federal Sanctions", status: "Valid", claimLevel: "L3",
    issueDate: "2024-10-01",
  },
];

export default function HolderDashboard() {
  const [focusCred, setFocusCred] = useState<CredentialItem | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Clinician Wallet</h1>
          <p className="text-gray-500 mt-1">Dr. Jordan Ellis · NPI 1003000126 · L3 Verified</p>
        </div>
        <div className="flex flex-col gap-4">
          {DEMO.map((cred) => (
            <CredentialLargeCard key={cred.id} credential={cred} onFocusMode={() => setFocusCred(cred)} />
          ))}
        </div>
      </div>
      <FocusMode credential={focusCred} onClose={() => setFocusCred(null)} />
    </div>
  );
}
