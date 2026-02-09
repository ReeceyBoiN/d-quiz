import React from "react";

interface FastestTeamOverlaySimplifiedProps {
  teamName?: string;
  teamPhoto?: string;
  teamIcon?: string;
}

/**
 * Simplified external display version of fastest team overlay
 * Shows only team photo and team name - optimized for 16:9 projector displays
 * No interactive controls, no grid, no stats
 */
export function FastestTeamOverlaySimplified({
  teamName = "No Team",
  teamPhoto,
  teamIcon = "🎯"
}: FastestTeamOverlaySimplifiedProps) {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '40px', backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
      {/* Header text */}
      <div style={{ fontSize: '32px', fontWeight: '600', color: '#9ca3af', textAlign: 'center' }}>
        The fastest correct team was:
      </div>

      {/* Main content - Photo on left, Name on right (responsive layout) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '60px', width: '100%', maxWidth: '1400px', flexWrap: 'wrap' }}>
        {/* Team Photo Section */}
        {teamPhoto ? (
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={teamPhoto}
              alt={teamName}
              style={{
                maxWidth: '350px',
                maxHeight: '350px',
                width: 'auto',
                height: 'auto',
                borderRadius: '16px',
                border: '6px solid #f97316',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                objectFit: 'cover'
              }}
              onLoad={() => {
                console.log('[FastestTeamOverlaySimplified] ✅ Successfully loaded team photo:', teamPhoto);
              }}
              onError={(e) => {
                console.error('[FastestTeamOverlaySimplified] ❌ Failed to load team photo:', teamPhoto);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div style={{
            flex: '0 0 auto',
            width: '300px',
            height: '300px',
            backgroundColor: '#374151',
            borderRadius: '16px',
            border: '6px solid #f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '80px' }}>{teamIcon}</div>
          </div>
        )}

        {/* Team Name Section */}
        <div style={{
          flex: '1',
          minWidth: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 'bold',
            color: '#f97316',
            padding: '40px',
            border: '6px solid #f97316',
            borderRadius: '24px',
            backgroundColor: '#374151',
            animation: 'scaleInAnimation 0.6s ease-out',
            maxWidth: '100%',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.2'
          }}>
            {teamName}
          </div>
        </div>
      </div>
    </div>
  );
}
