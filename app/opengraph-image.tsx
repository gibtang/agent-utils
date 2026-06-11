import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'AgentUtils — API Utilities for AI Agents'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
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
              fontSize: '72px',
              fontWeight: 700,
              color: '#fafafa',
            }}
          >
            Agent
            <span style={{ color: '#71717a' }}>Utils</span>
          </div>
        </div>
        <div
          style={{
            fontSize: '28px',
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          Dead letter queues, human-in-the-loop gates, and redactable memory
          — all behind a single API key.
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
