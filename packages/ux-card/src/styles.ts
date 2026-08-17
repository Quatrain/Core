export const CARD_CSS = `
.q-square-card {
  --q-card-bg: rgba(255, 255, 255, 0.92);
  --q-card-border: rgba(226, 232, 240, 0.9);
  --q-card-text-primary: #0f172a;
  --q-card-text-secondary: #64748b;
  --q-card-text-muted: #94a3b8;
  --q-card-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.04);
  --q-card-accent: #3b82f6;
  
  position: relative;
  aspect-ratio: 1 / 1;
  width: 100%;
  min-width: 220px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.125rem;
  box-sizing: border-box;
  background: var(--q-card-bg);
  border: 1px solid var(--q-card-border);
  border-radius: 1.25rem;
  box-shadow: var(--q-card-shadow);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.q-square-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -4px rgba(0, 0, 0, 0.1), 0 4px 10px -2px rgba(0, 0, 0, 0.05);
}

/* Header Zone */
.q-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.q-card-title-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.q-card-title {
  font-size: 0.925rem;
  font-weight: 700;
  color: var(--q-card-text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-card-source {
  font-size: 0.725rem;
  font-weight: 500;
  color: var(--q-card-text-secondary);
  line-height: 1.2;
  margin-top: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-card-icon-badge {
  font-size: 1.45rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Body / Core Value Zone */
.q-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: auto 0;
  width: 100%;
}

.q-card-extremes {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.q-card-extreme-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.775rem;
  font-weight: 600;
}

.q-card-extreme-max {
  color: #dc2626;
}

.q-card-extreme-min {
  color: #2563eb;
}

.q-card-main-metric {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.25rem;
  text-align: right;
}

.q-card-value {
  font-size: 2.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--q-card-text-primary);
  line-height: 1;
}

.q-card-unit {
  font-size: 1rem;
  font-weight: 600;
  color: var(--q-card-text-secondary);
}

/* Stacked Layers Sub-Metrics */
.q-card-stacked-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.q-card-stacked-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.775rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 0.5rem;
}

/* Footer Zone */
.q-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(226, 232, 240, 0.6);
}

.q-card-time {
  font-size: 0.725rem;
  font-weight: 500;
  color: var(--q-card-text-muted);
}

.q-card-badge {
  font-size: 0.725rem;
  font-weight: 700;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  line-height: 1.2;
}

.q-card-badge-optimal {
  background: #dcfce7;
  color: #15803d;
}

.q-card-badge-warning {
  background: #fef3c7;
  color: #b45309;
}

.q-card-badge-alert {
  background: #fee2e2;
  color: #b91c1c;
}

.q-card-badge-info {
  background: #e0f2fe;
  color: #0369a1;
}

.q-card-badge-neutral {
  background: #f1f5f9;
  color: #475569;
}

/* ==========================================================================
   THEME MODES: TV Kiosk Mode (High-Contrast Large Dark Display)
   ========================================================================== */
.q-theme-tv .q-square-card,
.q-square-card.q-theme-tv {
  --q-card-bg: rgba(15, 23, 42, 0.95);
  --q-card-border: rgba(51, 65, 85, 0.8);
  --q-card-text-primary: #f8fafc;
  --q-card-text-secondary: #cbd5e1;
  --q-card-text-muted: #94a3b8;
  --q-card-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5);
  
  padding: 1.5rem;
  border-radius: 1.5rem;
  min-width: 280px;
}

.q-theme-tv .q-card-title {
  font-size: 1.15rem;
}

.q-theme-tv .q-card-value {
  font-size: 3.25rem;
}

.q-theme-tv .q-card-unit {
  font-size: 1.35rem;
}

.q-theme-tv .q-card-badge {
  font-size: 0.875rem;
  padding: 0.35rem 0.85rem;
}

/* ==========================================================================
   THEME MODES: PWA Mobile Mode (Compact & Tactile)
   ========================================================================== */
.q-theme-pwa .q-square-card,
.q-square-card.q-theme-pwa {
  padding: 1rem;
  border-radius: 1.125rem;
}

.q-theme-pwa .q-card-value {
  font-size: 2rem;
}
`
