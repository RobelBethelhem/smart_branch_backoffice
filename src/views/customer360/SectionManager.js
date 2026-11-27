import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, MenuItem, Radio, RadioGroup, Stack, Switch, Tab, Tabs, TextField, Tooltip,
} from '@mui/material';
import { Eye, History, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Customer360View from './Customer360View';
import { c360Fetch } from './api';
import { useC360Theme } from './muiTheme';
import './Customer360.css';

// Where the Super Admin decides what the Customer 360 page is made of. A section shows its
// demo rows until it is switched to "Live"; then it shows the rows of its query. The server
// checks every query (one SELECT, read only, customer passed as a parameter) before saving
// and before running it.

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 13, lineHeight: 1.5 };
const OPTION_FIELDS = {
  stats: [],
  line: [['prefix', 'Shown before the amount, e.g. ETB'], ['badge', 'Small label at the top right, e.g. +33% · 12M']],
  bars: [['prefix', 'Shown before the amount, e.g. ETB'], ['label_in', 'Name of the first bar'], ['label_out', 'Name of the second bar']],
  donut: [['center_label', 'Word under the figure in the middle, e.g. digital']],
};

const slug = (title) =>
  String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([^a-z])/, 's_$1').slice(0, 40);

const emptyDraft = (order) => ({
  id: null, key: '', title: '', type: 'stats', placement: 'main', width: 6, order, enabled: true, mode: 'demo',
  query: '', demoText: '[]', options: {}, keyTouched: false,
});

const SectionManager = () => {
  const theme = useC360Theme();
  const accessToken = useSelector((state) => state.user.accessToken);
  const [catalog, setCatalog] = useState(null);
  const [message, setMessage] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ cif: '', account: '', running: false, result: null });
  const [demoPreview, setDemoPreview] = useState({ rows: [], problems: [], error: '' });
  const [previewPage, setPreviewPage] = useState(null);
  const [activity, setActivity] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    try {
      setCatalog(await c360Fetch(accessToken, '/sections'));
    } catch (failure) {
      setMessage({ severity: 'error', text: failure.message });
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const widget = draft && catalog ? catalog.widgets[draft.type] : null;

  // Demo rows are typed as JSON. They are shown the way the page will show them, which the
  // server works out (lower-case columns, numbers, masking).
  useEffect(() => {
    if (!draft) return undefined;
    let rows;
    try {
      rows = JSON.parse(draft.demoText || '[]');
      if (!Array.isArray(rows)) throw new Error('The demo rows must be a list: [ { … }, { … } ]');
    } catch (failure) {
      setDemoPreview((current) => ({ ...current, error: failure.message }));
      return undefined;
    }
    const timer = setTimeout(() => {
      c360Fetch(accessToken, '/sections/prepare', { method: 'POST', body: { type: draft.type, rows } })
        .then((data) => setDemoPreview({ rows: data.rows, problems: data.problems, error: '' }))
        .catch((failure) => setDemoPreview({ rows: [], problems: [], error: failure.message }));
    }, 350);
    return () => clearTimeout(timer);
  }, [accessToken, draft && draft.demoText, draft && draft.type]);     // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = (section) => {
    setTab(0);
    setTest({ cif: '', account: '', running: false, result: null });
    setDemoPreview({ rows: [], problems: [], error: '' });
    if (section) {
      setDraft({
        id: section.id, key: section.key, title: section.title, type: section.type, placement: section.placement,
        width: section.width, order: section.order, enabled: section.enabled, mode: section.mode,
        query: section.query || '', demoText: JSON.stringify(section.demo_rows || [], null, 2),
        options: section.options || {}, keyTouched: true,
      });
    } else {
      const last = Math.max(0, ...(catalog?.sections || []).map((s) => Number(s.order) || 0));
      const fresh = emptyDraft(last + 10);
      setDraft({ ...fresh, query: catalog.sample_queries.stats, demoText: JSON.stringify(catalog.sample_rows.stats, null, 2) });
    }
  };

  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const changeType = (type) => {
    // A new section follows the kind chosen: its sample query and sample rows are loaded.
    if (!draft.id) {
      patch({ type, query: catalog.sample_queries[type], demoText: JSON.stringify(catalog.sample_rows[type], null, 2), options: {} });
    } else {
      patch({ type });
    }
    setTest((current) => ({ ...current, result: null }));
  };

  const save = async () => {
    let demoRows;
    try {
      demoRows = JSON.parse(draft.demoText || '[]');
    } catch (failure) {
      setTab(1);
      setMessage({ severity: 'error', text: `The demo rows are not valid JSON: ${failure.message}` });
      return;
    }
    const body = {
      title: draft.title, type: draft.type, placement: draft.placement, width: Number(draft.width), order: Number(draft.order),
      enabled: draft.enabled, mode: draft.mode, query: draft.query, demo_rows: demoRows, options: draft.options,
    };
    setSaving(true);
    setMessage(null);
    try {
      if (draft.id) await c360Fetch(accessToken, `/sections/${draft.id}`, { method: 'PUT', body });
      else await c360Fetch(accessToken, '/sections', { method: 'POST', body: { ...body, key: draft.key } });
      setDraft(null);
      setMessage({ severity: 'success', text: `"${draft.title}" saved.` });
      await load();
    } catch (failure) {
      setMessage({ severity: 'error', text: failure.message });
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (section, changes) => {
    setMessage(null);
    try {
      await c360Fetch(accessToken, `/sections/${section.id}`, { method: 'PUT', body: changes });
      await load();
    } catch (failure) {
      setMessage({ severity: 'error', text: failure.message });
    }
  };

  const remove = async (section) => {
    setRemoving(null);
    try {
      await c360Fetch(accessToken, `/sections/${section.id}`, { method: 'DELETE' });
      setMessage({ severity: 'success', text: `"${section.title}" removed.` });
      await load();
    } catch (failure) {
      setMessage({ severity: 'error', text: failure.message });
    }
  };

  const restore = async () => {
    try {
      await c360Fetch(accessToken, '/sections/restore_defaults', { method: 'POST' });
      setMessage({ severity: 'success', text: 'Built-in sections that were removed are back.' });
      await load();
    } catch (failure) {
      setMessage({ severity: 'error', text: failure.message });
    }
  };

  const runTest = async (run) => {
    setTest((current) => ({ ...current, running: true, result: null }));
    try {
      const result = await c360Fetch(accessToken, '/sections/test', {
        method: 'POST',
        body: { key: draft.key, type: draft.type, query: draft.query, cif: test.cif, account_number: test.account, run },
      });
      setTest((current) => ({ ...current, running: false, result }));
    } catch (failure) {
      setTest((current) => ({ ...current, running: false, result: { ok: false, error: failure.message } }));
    }
  };

  const openPreview = async (input) => {
    setPreviewPage({ ...input, loading: true, data: null, error: '' });
    try {
      const query = new URLSearchParams({ cif: input.cif, account_number: input.account, name: input.name }).toString();
      const data = await c360Fetch(accessToken, `/preview?${query}`);
      setPreviewPage({ ...input, loading: false, data, error: '' });
    } catch (failure) {
      setPreviewPage({ ...input, loading: false, data: null, error: failure.message });
    }
  };

  const openActivity = async () => {
    setActivity({ loading: true, entries: [] });
    try {
      setActivity({ loading: false, entries: await c360Fetch(accessToken, '/audit?limit=100') });
    } catch (failure) {
      setActivity({ loading: false, entries: [], error: failure.message });
    }
  };

  // What the editor's preview shows: the rows of the last successful test when there is one
  // and the query tab is open, otherwise the demo rows.
  const previewSection = useMemo(() => {
    if (!draft) return null;
    const tested = tab === 0 && test.result && test.result.ok && !test.result.checked_only;
    return {
      key: draft.key || 'draft', title: draft.title || 'Untitled section', type: draft.type, placement: 'main', width: 12,
      mode: tested ? 'live' : 'demo', options: draft.options || {}, rows: tested ? test.result.rows : demoPreview.rows,
    };
  }, [draft, tab, test.result, demoPreview.rows]);

  if (!catalog) {
    return (
      <ThemeProvider theme={theme}>
        <div className="c360">
          {message ? <Alert severity={message.severity}>{message.text}</Alert> : <CircularProgress size={22} />}
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="c360">
        <h1 className="c360-page-title">Customer 360 sections</h1>
        <p className="c360-page-sub">
          Each section shows its demo rows until it is switched to Live. A live section runs its query against FlexCube
          for the customer on screen. Queries can only read: the server refuses anything else.
        </p>

        <div className="c360-toolbar">
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => openEditor(null)}>Add a section</Button>
          <Button variant="outlined" startIcon={<Eye size={16} />} onClick={() => setPreviewPage({ cif: '', account: '', name: '', loading: false, data: null, error: '' })}>
            Preview the page
          </Button>
          <span className="c360-grow" />
          <Button variant="text" startIcon={<History size={16} />} onClick={openActivity}>Activity log</Button>
          <Button variant="text" startIcon={<RotateCcw size={16} />} onClick={restore}>Restore built-in sections</Button>
        </div>

        {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

        <div className="c360-card">
          <div className="c360-table-wrap">
            <table className="c360-table">
              <thead>
                <tr>
                  <th>Position</th><th>Section</th><th>Kind</th><th>Where</th><th>Data</th><th>Shown</th><th>Last change</th><th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {catalog.sections.map((section) => (
                  <tr key={section.id}>
                    <td>{section.order}</td>
                    <td><b>{section.title}</b><div style={{ opacity: 0.6, fontSize: 12 }}>{section.key}</div></td>
                    <td>{catalog.widgets[section.type]?.label || section.type}</td>
                    <td>{section.placement === 'side' ? 'Left column' : `Main area · ${section.width} of 12`}</td>
                    <td>
                      <Chip size="small" color={section.mode === 'live' ? 'success' : 'warning'} variant={section.mode === 'live' ? 'filled' : 'outlined'}
                        label={section.mode === 'live' ? 'Live query' : 'Demo data'} />
                    </td>
                    <td>
                      <Switch size="small" checked={section.enabled} onChange={(event) => quickUpdate(section, { enabled: event.target.checked })}
                        inputProps={{ 'aria-label': `Show ${section.title}` }} />
                    </td>
                    <td style={{ fontSize: 12, opacity: 0.75 }}>
                      {section.updated_by || '—'}<br />{section.updated_at ? new Date(section.updated_at).toLocaleString('en-GB') : ''}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(section)} aria-label={`Edit ${section.title}`}><Pencil size={16} /></IconButton></Tooltip>
                      <Tooltip title="Remove"><IconButton size="small" onClick={() => setRemoving(section)} aria-label={`Remove ${section.title}`}><Trash2 size={16} /></IconButton></Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- editor ---------------------------------------------------------------- */}
        <Dialog open={!!draft} onClose={() => !saving && setDraft(null)} maxWidth="xl" fullWidth>
          {draft && (
            <>
              <DialogTitle>{draft.id ? `Edit "${draft.title}"` : 'Add a section'}</DialogTitle>
              <DialogContent dividers>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) minmax(0, 1fr)' }, gap: 3 }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField label="Title" size="small" fullWidth value={draft.title}
                        onChange={(event) => patch({ title: event.target.value, ...(draft.keyTouched ? {} : { key: slug(event.target.value) }) })} />
                      <TextField label="Short name" size="small" fullWidth value={draft.key} disabled={!!draft.id}
                        helperText="Small letters, digits and _. Cannot be changed later."
                        onChange={(event) => patch({ key: event.target.value.toLowerCase(), keyTouched: true })} />
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField select label="Kind of section" size="small" fullWidth value={draft.type} onChange={(event) => changeType(event.target.value)}>
                        {Object.entries(catalog.widgets).map(([type, info]) => <MenuItem key={type} value={type}>{info.label}</MenuItem>)}
                      </TextField>
                      <TextField select label="Where" size="small" fullWidth value={draft.placement} onChange={(event) => patch({ placement: event.target.value })}>
                        <MenuItem value="main">Main area</MenuItem>
                        <MenuItem value="side">Left column</MenuItem>
                      </TextField>
                      <TextField select label="Width" size="small" fullWidth value={draft.width} disabled={draft.placement === 'side'}
                        onChange={(event) => patch({ width: Number(event.target.value) })}>
                        {[3, 4, 5, 6, 7, 8, 9, 12].map((w) => <MenuItem key={w} value={w}>{w} of 12</MenuItem>)}
                      </TextField>
                      <TextField label="Position" size="small" type="number" fullWidth value={draft.order}
                        onChange={(event) => patch({ order: event.target.value })} helperText="Lower comes first" />
                    </Stack>

                    {(OPTION_FIELDS[draft.type] || []).length > 0 && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        {OPTION_FIELDS[draft.type].map(([name, hint]) => (
                          <TextField key={name} label={name} size="small" fullWidth helperText={hint} value={draft.options?.[name] || ''}
                            onChange={(event) => patch({ options: { ...draft.options, [name]: event.target.value } })} />
                        ))}
                      </Stack>
                    )}

                    <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                      <b>{widget.label}.</b> {widget.description}{' '}
                      {widget.columns.length > 0 && (
                        <>Columns: {widget.columns.map((column) => (
                          <Tooltip key={column.name} title={column.note || (column.required ? 'Required' : 'Optional')}>
                            <code style={{ marginRight: 8, fontWeight: column.required ? 700 : 400 }}>{column.name}{column.required ? '' : '?'}</code>
                          </Tooltip>
                        ))}</>
                      )}
                    </Alert>

                    <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                      <RadioGroup row value={draft.mode} onChange={(event) => patch({ mode: event.target.value })}>
                        <FormControlLabel value="demo" control={<Radio size="small" />} label="Show the demo rows" />
                        <FormControlLabel value="live" control={<Radio size="small" />} label="Live: run the query" />
                      </RadioGroup>
                      <FormControlLabel control={<Switch size="small" checked={draft.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />} label="Shown on the page" />
                    </Stack>

                    <Tabs value={tab} onChange={(event, value) => setTab(value)} sx={{ minHeight: 36 }}>
                      <Tab label="Query" sx={{ minHeight: 36 }} />
                      <Tab label="Demo rows" sx={{ minHeight: 36 }} />
                    </Tabs>

                    {tab === 0 && (
                      <Stack spacing={1.5}>
                        <TextField multiline minRows={9} maxRows={22} fullWidth value={draft.query} spellCheck={false}
                          onChange={(event) => patch({ query: event.target.value })} InputProps={{ sx: MONO }}
                          inputProps={{ 'aria-label': 'Query', maxLength: catalog.limits.query_length }}
                          helperText={`One SELECT. Parameters filled in by the server: ${catalog.parameters.map((p) => `:${p}`).join(', ')}. At most ${catalog.limits.rows} rows are used.`} />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                          <Button size="small" variant="outlined" onClick={() => patch({ query: catalog.sample_queries[draft.type] })}>Load the sample query</Button>
                          <Button size="small" variant="outlined" onClick={() => runTest(false)} disabled={test.running}>Check</Button>
                          <span style={{ flex: '1 1 auto' }} />
                          <TextField size="small" label="Customer number" value={test.cif} sx={{ width: 160 }}
                            onChange={(event) => setTest((current) => ({ ...current, cif: event.target.value.trim() }))} />
                          <TextField size="small" label="Account number" value={test.account} sx={{ width: 190 }}
                            onChange={(event) => setTest((current) => ({ ...current, account: event.target.value.trim() }))} />
                          <Button size="small" variant="contained" startIcon={<Play size={14} />} disabled={test.running || (!test.cif && !test.account)}
                            onClick={() => runTest(true)}>
                            {test.running ? 'Running…' : 'Run'}
                          </Button>
                        </Stack>
                        {test.result && !test.result.ok && <Alert severity="error">{test.result.error}</Alert>}
                        {test.result && test.result.ok && test.result.checked_only && (
                          <Alert severity="success">The query passes the check. It has not been run.</Alert>
                        )}
                        {test.result && test.result.ok && !test.result.checked_only && (
                          <Alert severity={test.result.problems.length ? 'warning' : 'success'}>
                            {test.result.row_count} row(s) in {test.result.ms} ms. Columns: {test.result.columns.join(', ') || 'none'}.
                            {test.result.problems.length > 0 && <> {test.result.problems.join(' ')}</>}
                            {' '}The preview shows this result.
                          </Alert>
                        )}
                      </Stack>
                    )}

                    {tab === 1 && (
                      <Stack spacing={1.5}>
                        <TextField multiline minRows={9} maxRows={22} fullWidth value={draft.demoText} spellCheck={false}
                          onChange={(event) => patch({ demoText: event.target.value })} InputProps={{ sx: MONO }} inputProps={{ 'aria-label': 'Demo rows' }}
                          helperText="A list of rows in JSON, with the same column names the query returns." error={!!demoPreview.error} />
                        <Stack direction="row" spacing={1.5}>
                          <Button size="small" variant="outlined" onClick={() => patch({ demoText: JSON.stringify(catalog.sample_rows[draft.type], null, 2) })}>
                            Load the sample rows
                          </Button>
                        </Stack>
                        {demoPreview.error && <Alert severity="error">{demoPreview.error}</Alert>}
                        {!demoPreview.error && demoPreview.problems.length > 0 && <Alert severity="warning">{demoPreview.problems.join(' ')}</Alert>}
                      </Stack>
                    )}
                  </Stack>

                  <Box>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.65, marginBottom: 8 }}>
                      Preview
                    </div>
                    <Customer360View bare sections={[previewSection]} />
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 1.5 }}>
                <Button onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || !draft.title.trim() || !draft.key.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        <Dialog open={!!removing} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
          {removing && (
            <>
              <DialogTitle>Remove this section?</DialogTitle>
              <DialogContent>
                &quot;{removing.title}&quot; disappears from the Customer 360 page for everyone. Its query and demo rows are deleted.
                {removing.built_in ? ' It is a built-in section: "Restore built-in sections" brings it back as it first was.' : ''}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRemoving(null)}>Keep it</Button>
                <Button color="error" variant="contained" onClick={() => remove(removing)}>Remove</Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* ---- whole-page preview ------------------------------------------------------ */}
        <Dialog open={!!previewPage} onClose={() => setPreviewPage(null)} maxWidth="xl" fullWidth>
          {previewPage && (
            <>
              <DialogTitle>Preview the Customer 360 page</DialogTitle>
              <DialogContent dividers>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
                  <TextField size="small" label="Customer number" value={previewPage.cif}
                    onChange={(event) => setPreviewPage((current) => ({ ...current, cif: event.target.value.trim() }))} />
                  <TextField size="small" label="Account number" value={previewPage.account}
                    onChange={(event) => setPreviewPage((current) => ({ ...current, account: event.target.value.trim() }))} />
                  <TextField size="small" label="Name to show" value={previewPage.name}
                    onChange={(event) => setPreviewPage((current) => ({ ...current, name: event.target.value }))} />
                  <Button variant="contained" onClick={() => openPreview(previewPage)} disabled={previewPage.loading}>
                    {previewPage.loading ? 'Loading…' : 'Show'}
                  </Button>
                  <span style={{ fontSize: 12.5, opacity: 0.7 }}>
                    Demo sections need no customer. Live sections run for the customer given here, and this is recorded.
                  </span>
                </Stack>
                {previewPage.error && <Alert severity="error">{previewPage.error}</Alert>}
                {previewPage.data && (
                  <Customer360View arrival={previewPage.data.arrival} sections={previewPage.data.sections} hasDemo={previewPage.data.has_demo} />
                )}
              </DialogContent>
              <DialogActions><Button onClick={() => setPreviewPage(null)}>Close</Button></DialogActions>
            </>
          )}
        </Dialog>

        {/* ---- activity log ------------------------------------------------------------ */}
        <Dialog open={!!activity} onClose={() => setActivity(null)} maxWidth="lg" fullWidth>
          {activity && (
            <>
              <DialogTitle>Customer 360 activity (latest 100)</DialogTitle>
              <DialogContent dividers>
                {activity.loading && <CircularProgress size={22} />}
                {activity.error && <Alert severity="error">{activity.error}</Alert>}
                {!activity.loading && !activity.error && activity.entries.length === 0 && <div className="c360-empty">Nothing recorded yet.</div>}
                {activity.entries.length > 0 && (
                  <div className="c360 c360-table-wrap" style={{ padding: 0, background: 'transparent' }}>
                    <table className="c360-table">
                      <thead><tr><th>When</th><th>Who</th><th>Role</th><th>Branch</th><th>What</th><th>Customer</th><th>Section</th></tr></thead>
                      <tbody>
                        {activity.entries.map((entry) => (
                          <tr key={entry._id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{new Date(entry.at).toLocaleString('en-GB')}</td>
                            <td>{entry.user || '—'}</td><td>{entry.role}</td><td>{entry.branch || '—'}</td>
                            <td>{entry.action}</td><td>{entry.cif || '—'}</td><td>{entry.section_key || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DialogContent>
              <DialogActions><Button onClick={() => setActivity(null)}>Close</Button></DialogActions>
            </>
          )}
        </Dialog>
      </div>
    </ThemeProvider>
  );
};

export default SectionManager;
