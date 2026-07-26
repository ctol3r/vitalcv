// VitalCV · Trust Surfaces · Priority 4 · Signed Receipt
// The notarized artifact. Inverted register · key glyph · 8 KV facts · signature footer.

import * as React from "react";
import type { Lineage, ChainNode, SignerContinuity } from "@/lib/trust/types";
import { lineageWhen } from "@/lib/trust/format";
import { LineageFooter } from "@/components/trust/LineageHeader";
import { SurfaceHeader, SurfaceControlFooter, type SurfaceControl } from "@/components/trust/SurfaceHeader";
import { ChainStrip } from "@/components/trust/ChainStrip";
import { SignaturePanel } from "@/components/trust/SignaturePanel";
import { SectionHeader, IdRender } from "@/components/trust/primitives";

// === STUB ====================================================================
async function getReceipt(id: string) {
  const now = new Date();
  const w = lineageWhen(new Date(now.getTime() - 10_000).toISOString(), now);

  const lineage: Lineage = {
    state: "signed",
    object: `Receipt ${id}`,
    objectSub: "CA medical license · A-148293",
    ownership: "subject",
    checkedAtIso: w.checkedAtIso,
    checkedAgo: w.checkedAgo,
    channel: "verify.vitalcv.health",
    replay: "anchored",
    runId: "7a2c…b8d3",
  };

  const signer: SignerContinuity = {
    did: "did:web:vitalcv.health",
    activeKeyFingerprint: "4f2a · 91c5 · 7e08 · b8d3",
    activeKeyInServiceDays: 190,
    activeKeyRotationDays: 365,
    didDocumentUrl: "/.well-known/did.json",
    statusListUrl: "vitalcv.health/status/v1/list.jsonld",
    backupKeyFingerprint: "8c91 · 0d44",
    backupKeyArmed: true,
    quorumRequired: 5,
    quorumAvailable: 3,
  };

  const chain: ChainNode[] = [
    { hash: "7a2c…b8d3", isHead: true },
    { hash: "9d11…3e4a" },
    { hash: "4b00…f1c2" },
    { hash: "2a17…0e8b" },
  ];

  const kv: Array<{ k: string; v: string; sub?: string }> = [
    { k: "subject", v: "did:vc:holder", sub: "8c91…0d44" },
    { k: "issuer", v: "did:web:vitalcv.health", sub: "key 4f2a · in service 190 d" },
    { k: "algorithm", v: "ed25519", sub: "EdDSA · 256-bit" },
    { k: "status", v: "active · bit 0", sub: "StatusList2021 · idx 481" },
    { k: "checked_at", v: w.checkedAtIso, sub: "RFC 3161 · tsa.digicert" },
    { k: "prev hash", v: "9d11…3e4a", sub: "rcpt #48,213" },
    { k: "this hash", v: "7a2c…b8d3", sub: "chain head" },
    { k: "run_id", v: "7a2c…b8d3", sub: "committed · tamper-evident" },
  ];

  const control: SurfaceControl = {
    form: `VC-RECEIPT-v1 · ${id}`,
    title: "Signed receipt",
    classification: "PUBLIC · SIGNED · NOTARIZED",
    effective: w.checkedAtIso,
    revision: "rev 11 · 2026-05-11",
    controlledBy: "did:web:vitalcv.health",
    state: "signed",
  };

  return { control, lineage, signer, chain, kv };
}
// =============================================================================

export default async function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const { control, lineage, signer, chain, kv } = await getReceipt(params.id);

  return (
    <>
      <SurfaceHeader control={control} lineage={lineage} />

      <SectionHeader n="01" title="Signed artifact" ey="inverted register · reserved for the cryptographic plane" />
      <section
        style={{
          background: "var(--ink-950)",
          color: "#fff",
          border: "1px solid var(--ink-950)",
          padding: 20,
          fontFamily: '"Geist Mono", monospace',
        }}
        aria-label="Signed receipt artifact"
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 12,
            borderBottom: "1px solid rgba(255,255,255,.1)",
            marginBottom: 16,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-400)",
          }}
        >
          <span>
            <strong style={{ color: "#fff", fontWeight: 500 }}>Receipt · {params.id} · signed</strong>
          </span>
          <span>ed25519 · {signer.did}</span>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            border: "1px solid rgba(255,255,255,.1)",
          }}
        >
          {kv.map((row, i) => {
            const lastTwo = i >= kv.length - 2;
            return (
              <div
                key={row.k}
                style={{
                  padding: "10px 14px",
                  borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,.08)" : "0",
                  borderBottom: lastTwo ? "0" : "1px solid rgba(255,255,255,.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--ink-400)",
                    marginBottom: 3,
                  }}
                >
                  {row.k}
                </div>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>
                  {row.v}
                  {row.sub && (
                    <span
                      style={{
                        display: "block",
                        fontFamily: '"Geist", sans-serif',
                        fontSize: 11,
                        color: "var(--ink-400)",
                        fontWeight: 400,
                        marginTop: 2,
                        letterSpacing: 0,
                        textTransform: "none",
                      }}
                    >
                      {row.sub}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-400)",
          }}
        >
          <span>
            signed_by · <span style={{ color: "#fff", fontWeight: 500 }}>{signer.did}</span>
          </span>
          <a
            href={`/verify/${params.id}`}
            style={{
              color: "#fff",
              fontWeight: 500,
              textDecoration: "none",
              borderBottom: "1px solid #fff",
              paddingBottom: 1,
            }}
          >
            Verify offline →
          </a>
        </footer>
      </section>

      <SectionHeader n="02" title="Issuer continuity" ey="published facts about the signer" />
      <SignaturePanel signer={signer} />

      <SectionHeader n="03" title="Replay lineage" ey="this receipt as a chain node" />
      <ChainStrip nodes={chain} meta="chain head" tone="inverted" />

      <LineageFooter lineage={lineage} />

      <SurfaceControlFooter
        control={control}
        lineage={lineage}
        verifyUrl={`verify.vitalcv.health/r/${params.id}`}
        pageOf={{ n: 1, of: 1 }}
      />
    </>
  );
}
