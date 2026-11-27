import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CSpinner } from '@coreui/react';
import { FlaskConical, RefreshCw, Settings } from 'lucide-react';
import { arrivalLine, assignedByText, c360Fetch, initialsOf } from './api';
import './Customer360.css';

// Today's customers whose request has a teller, newest first. Opening one shows Customer 360.
const Arrivals = () => {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.user.accessToken);
  const role = useSelector((state) => state.user.role);
  const [arrivals, setArrivals] = useState([]);
  const [eligible, setEligible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await c360Fetch(accessToken, '/arrivals');
      setEligible(data.eligible);
      setArrivals(data.arrivals);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  // Admin only: a made-up arrival, to see the notification and the page without a customer.
  const simulate = async () => {
    setBusy(true);
    setError('');
    try {
      await c360Fetch(accessToken, '/simulate', { method: 'POST', body: {} });
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="c360">
      <h1 className="c360-page-title">Customer 360</h1>
      <p className="c360-page-sub">
        Customers of today whose request has a teller, newest first. Open one to see the customer.
      </p>

      <div className="c360-toolbar">
        <button type="button" className="c360-btn" onClick={load}><RefreshCw size={15} aria-hidden="true" /> Refresh</button>
        <span className="c360-grow" />
        {role === 'Admin' && (
          <>
            <button type="button" className="c360-btn" onClick={simulate} disabled={busy}
              title="Creates a made-up arrival in your branch, marked as simulated">
              <FlaskConical size={15} aria-hidden="true" /> Simulate an arrival
            </button>
            <button type="button" className="c360-btn" onClick={() => navigate('/admin/customer360_access')}>
              <Settings size={15} aria-hidden="true" /> Who can see this
            </button>
          </>
        )}
      </div>

      {error && <div className="c360-error" role="alert">{error}</div>}
      {loading && <div className="c360-card"><CSpinner size="sm" /> Loading…</div>}

      {!loading && !eligible && (
        <div className="c360-card">
          <div className="c360-empty">
            Customer 360 is not switched on for your role in this branch. The branch Admin decides who sees it.
          </div>
        </div>
      )}

      {!loading && eligible && arrivals.length === 0 && !error && (
        <div className="c360-card"><div className="c360-empty">No customer has been assigned to a teller yet today.</div></div>
      )}

      <div className="c360-list">
        {arrivals.map((arrival) => (
          <button type="button" key={arrival.id} className={`c360-row${arrival.seen ? '' : ' is-new'}`}
            onClick={() => navigate(`/customer360/${arrival.id}`)}>
            <span className="c360-row-avatar" aria-hidden="true">{initialsOf(arrival.customer_name)}</span>
            <span className="c360-row-text">
              <span className="c360-row-name">{arrival.customer_name}</span>
              <span className="c360-row-sub" style={{ display: 'block' }}>{arrivalLine(arrival)} · {assignedByText(arrival)}</span>
            </span>
            {arrival.simulated && <span className="c360-pill is-sim">Simulated</span>}
            {!arrival.seen && <span className="c360-pill">New</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Arrivals;
