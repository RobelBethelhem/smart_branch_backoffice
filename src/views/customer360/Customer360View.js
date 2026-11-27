import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { WIDGET_COMPONENTS } from './Widgets';
import { arrivalLine, assignedByText } from './api';
import './Customer360.css';

// The Customer 360 page itself: the "has arrived" strip, the narrow column and the wide area.
// Used for a real arrival, for the Super Admin's preview and for the section editor's preview.
const Customer360View = ({ arrival, sections, hasDemo, actions = null, onReveal = null, revealing = false, bare = false }) => {
  // A highlights section with nothing to say takes no room at all (not even an empty row).
  const list = (sections || []).filter(
    (section) => !(section.type === 'chips' && !section.error && (section.rows || []).every((row) => !row.text)),
  );
  const side = list.filter((section) => section.placement === 'side');
  const main = list.filter((section) => section.placement !== 'side');

  const render = (section) => {
    const Component = WIDGET_COMPONENTS[section.type];
    if (!Component) return null;
    return <Component key={section.key} section={section} arrival={arrival} onReveal={onReveal} revealing={revealing} />;
  };

  return (
    <div className="c360">
      {!bare && arrival && (
        <div className="c360-banner">
          <span className="c360-banner-dot" aria-hidden="true" />
          <div className="c360-banner-text">
            <div className="c360-banner-title">
              {arrival.customer_name} has arrived
              {arrival.simulated && <span className="c360-pill is-sim" style={{ marginLeft: 10 }}>Simulated</span>}
            </div>
            <div className="c360-banner-sub">
              {[arrivalLine(arrival), arrival.id === 'preview' ? null : assignedByText(arrival)].filter(Boolean).join(' · ')}
            </div>
          </div>
          {actions && <div className="c360-banner-actions">{actions}</div>}
        </div>
      )}

      {hasDemo && !bare && (
        <div className="c360-notice" role="note">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            The sections marked <b>Demo data</b> show invented example figures, not this customer&apos;s. They become real
            when the Super Admin switches the section to a live query.
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <div className="c360-card"><div className="c360-empty">No sections are switched on for Customer 360.</div></div>
      ) : (
        <div className="c360-layout" style={side.length === 0 ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
          {side.length > 0 && <div className="c360-side">{side.map(render)}</div>}
          <div className="c360-main">
            {main.map((section) => (
              <div key={section.key} className={`c360-span-${Math.min(12, Math.max(3, section.width || 6))}`}>
                {render(section)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Customer360View;
