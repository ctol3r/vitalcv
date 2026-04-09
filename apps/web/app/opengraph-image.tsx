import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'VitalCV — Check Clinician Readiness in Seconds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 50%, #0a0a0a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            V
          </div>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-1px',
            }}
          >
            VitalCV
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#e5e5e5',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          Check Clinician Readiness in Seconds
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '18px',
            color: '#a3a3a3',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
          }}
        >
          Source-backed credentialing truth — NPPES, OIG/LEIE, PECOS
        </div>

        {/* Source badges */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '40px',
          }}
        >
          {['NPPES', 'OIG/LEIE', 'PECOS'].map((source) => (
            <div
              key={source}
              style={{
                padding: '8px 20px',
                borderRadius: '9999px',
                border: '1px solid #374151',
                color: '#d1d5db',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {source}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '16px',
            color: '#6b7280',
            fontWeight: 500,
          }}
        >
          vitalcv.com
        </div>
      </div>
    ),
    { ...size },
  );
}
