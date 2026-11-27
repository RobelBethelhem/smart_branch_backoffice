import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CSpinner } from '@coreui/react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Customer360View from './Customer360View';
import { c360Fetch } from './api';
import './Customer360.css';

// The page a notification opens: everything known about the customer of one arrival.
const Customer360Page = () => {
  const { arrivalId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.user.accessToken);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await c360Fetch(accessToken, `/arrivals/${arrivalId}`));
      // Tells the bell in the header that this arrival has been looked at, so its count drops now.
      dispatch({ type: 'set', customer360Seen: arrivalId });
    } catch (failure) {
      setError(failure.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, arrivalId, dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  // Asks the server for the hidden values. The server records who asked.
  const reveal = async () => {
    setRevealing(true);
    try {
      const result = await c360Fetch(accessToken, `/arrivals/${arrivalId}/reveal`, { method: 'POST' });
      const revealed = new Map(result.sections.map((section) => [section.key, section]));
      setData((current) => current && { ...current, sections: current.sections.map((section) => revealed.get(section.key) || section) });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setRevealing(false);
    }
  };

  const actions = (
    <>
      <button type="button" className="c360-btn" onClick={() => navigate('/customer360')}>
        <ArrowLeft size={15} aria-hidden="true" /> All arrivals
      </button>
      <button type="button" className="c360-btn" onClick={load} disabled={loading}>
        <RefreshCw size={15} aria-hidden="true" /> Refresh
      </button>
    </>
  );

  if (loading && !data) {
    return <div className="c360"><div className="c360-card"><CSpinner size="sm" /> Loading the customer…</div></div>;
  }
  if (error && !data) {
    return (
      <div className="c360">
        <div className="c360-card">
          <div className="c360-error" role="alert">{error}</div>
          <div style={{ marginTop: 12 }}>{actions}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <div className="c360"><div className="c360-error" role="alert">{error}</div></div>}
      <Customer360View arrival={data.arrival} sections={data.sections} hasDemo={data.has_demo} actions={actions}
        onReveal={reveal} revealing={revealing} />
    </>
  );
};

export default Customer360Page;
