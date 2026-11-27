import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { Alert, Button, Checkbox, CircularProgress, FormControlLabel, Stack } from '@mui/material';
import { c360Fetch } from './api';
import { useC360Theme } from './muiTheme';
import './Customer360.css';

const ROLE_NOTES = {
  Admin: 'Branch manager. Always sees every customer of the branch.',
  Authorizer: 'Sees every customer of the branch.',
  Auditor: 'Sees every customer of the branch.',
  Teller: 'Sees only the customers assigned to that teller.',
  Maker: 'Sees only the customers assigned to that maker.',
};

// The branch Admin decides which roles of the branch get the Customer 360 notification and page.
const AccessSettings = () => {
  const navigate = useNavigate();
  const theme = useC360Theme();
  const accessToken = useSelector((state) => state.user.accessToken);
  const [settings, setSettings] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    c360Fetch(accessToken, '/settings')
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setChosen(data.roles);
      })
      .catch((failure) => !cancelled && setMessage({ severity: 'error', text: failure.message }));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const toggle = (role) => setChosen((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const data = await c360Fetch(accessToken, '/settings', { method: 'PUT', body: { roles: chosen } });
      setChosen(data.roles);
      setSettings((current) => ({ ...current, roles: data.roles }));
      setMessage({ severity: 'success', text: 'Saved. It applies from the next notification on.' });
    } catch (failure) {
      setMessage({ severity: 'error', text: failure.message });
    } finally {
      setSaving(false);
    }
  };

  const changed = settings && [...chosen].sort().join() !== [...settings.roles].sort().join();

  return (
    <ThemeProvider theme={theme}>
      <div className="c360">
        <h1 className="c360-page-title">Who can see Customer 360</h1>
        <p className="c360-page-sub">
          When a customer&apos;s request gets a teller, the roles ticked here get the notification and can open the
          customer&apos;s page{settings ? `, in branch ${settings.branch}` : ''}.
        </p>

        <div className="c360-card" style={{ maxWidth: 640 }}>
          {!settings && !message && <CircularProgress size={22} />}
          {settings && (
            <Stack spacing={0.5}>
              {[...settings.always, ...settings.selectable].map((role) => {
                const always = settings.always.includes(role);
                return (
                  <FormControlLabel
                    key={role}
                    control={<Checkbox checked={always || chosen.includes(role)} disabled={always} onChange={() => toggle(role)} />}
                    label={
                      <span>
                        <b>{role}</b>
                        <span style={{ display: 'block', fontSize: 12.5, opacity: 0.75 }}>{ROLE_NOTES[role]}</span>
                      </span>
                    }
                    sx={{ alignItems: 'flex-start', '.MuiCheckbox-root': { pt: 0.5 } }}
                  />
                );
              })}
            </Stack>
          )}

          {message && <Alert severity={message.severity} sx={{ mt: 2 }}>{message.text}</Alert>}

          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button variant="contained" onClick={save} disabled={!changed || saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="outlined" onClick={() => navigate('/customer360')}>Back to arrivals</Button>
          </Stack>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default AccessSettings;
