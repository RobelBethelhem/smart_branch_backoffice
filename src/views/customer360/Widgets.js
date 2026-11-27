import React, { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertTriangle, ArrowLeftRight, CheckCircle, Clock, Eye, Gauge, Info, Layers,
  LineChart as LineIcon, List, PieChart as PieIcon, Star, Table as TableIcon, TrendingUp, User,
  XCircle, Zap,
} from 'lucide-react';
import { compactNumber, fullNumber, initialsOf } from './api';

// One component per kind of section. Each gets the section as the server sent it:
// { key, title, type, mode, rows, options, error }. Column names are lower case.

const TITLE_ICONS = {
  profile: User, details: List, text: Star, chips: Zap, stats: Activity, gauges: Gauge,
  line: LineIcon, bars: ArrowLeftRight, donut: PieIcon, table: TableIcon,
};

// Slices and series, in order. Chosen to stay apart from each other in both themes.
const SERIES = ['#1f9d57', '#d1495b', '#0f6a3b', '#c58a12', '#8d99a6', '#3b4652', '#2b6cb0', '#7b5ea7'];
const IN_COLOR = '#49b97c';
const OUT_COLOR = '#55606b';

const DemoBadge = ({ section }) =>
  section.mode !== 'live' ? <span className="c360-demo" title="Invented example data, not this customer's">Demo data</span> : null;

export const CardHead = ({ section, right = null }) => {
  const Icon = TITLE_ICONS[section.type] || Info;
  return (
    <div className="c360-card-head">
      <div className="c360-card-title">
        <Icon size={15} aria-hidden="true" />
        <span>{section.title}</span>
      </div>
      {right}
      <DemoBadge section={section} />
    </div>
  );
};

const Problem = ({ section }) => {
  if (section.error) return <div className="c360-error">{section.error}</div>;
  if (!section.rows || section.rows.length === 0) return <div className="c360-empty">Nothing to show for this customer.</div>;
  return null;
};

const firstNote = (rows) => {
  const row = (rows || []).find((r) => r.note && String(r.note).trim());
  return row ? String(row.note) : '';
};

const ChartTip = ({ active, payload, label, prefix }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="c360-tooltip">
      <b>{label}</b>
      {payload.map((entry) => (
        <div key={entry.dataKey}>
          {payload.length > 1 ? `${entry.name}: ` : ''}
          {prefix ? `${prefix} ` : ''}
          {fullNumber(entry.value)}
        </div>
      ))}
    </div>
  );
};

// ---- customer header ----------------------------------------------------------------------
export const ProfileWidget = ({ section, arrival }) => {
  const row = (section.rows && section.rows[0]) || {};
  const [photoFailed, setPhotoFailed] = useState(false);
  const name = (row.name && String(row.name).trim()) || arrival?.customer_name || 'Customer';
  const cif = (row.cif && String(row.cif).trim()) || arrival?.cif || '';
  const photo = row.photo && String(row.photo).trim();
  const photoSrc = photo ? (photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`) : '';
  const sub = [cif ? `CIF ${cif}` : null, row.since ? `since ${row.since}` : null].filter(Boolean).join(' · ');

  return (
    <div className="c360-card c360-profile">
      <DemoBadge section={section} />
      <div className="c360-profile-band" />
      <div className="c360-avatar">
        {photoSrc && !photoFailed ? (
          <img src={photoSrc} alt="" onError={() => setPhotoFailed(true)} />
        ) : (
          <span aria-hidden="true">{initialsOf(name)}</span>
        )}
      </div>
      <div className="c360-profile-body">
        <div className="c360-profile-name">{name}</div>
        {sub && <div className="c360-profile-sub">{sub}</div>}
        {section.error && <div className="c360-error">{section.error}</div>}
        {(row.segment || row.kyc_status) && (
          <div className="c360-tags">
            {row.segment && <span className="c360-tag is-amber">{row.segment}</span>}
            {row.kyc_status && <span className="c360-tag">{row.kyc_status}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// ---- list of details ----------------------------------------------------------------------
export const DetailsWidget = ({ section, onReveal, revealing }) => {
  const hasMasked = (section.rows || []).some((row) => row.masked);
  const reveal =
    hasMasked && onReveal ? (
      <button type="button" className="c360-reveal" onClick={onReveal} disabled={revealing}
        title="Shows the hidden values. Your name and the time are recorded.">
        <Eye size={13} aria-hidden="true" /> {revealing ? 'Revealing…' : 'Reveal · logged'}
      </button>
    ) : null;

  return (
    <div className="c360-card">
      <CardHead section={section} right={reveal} />
      <Problem section={section} />
      <dl className="c360-details">
        {(section.rows || []).map((row, index) => (
          <div className="c360-detail" key={`${row.label}-${index}`}>
            <dt>{row.label}</dt>
            <dd>{row.value === null || row.value === undefined || row.value === '' ? '—' : String(row.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

// ---- text ---------------------------------------------------------------------------------
export const TextWidget = ({ section }) => (
  <div className="c360-card">
    <CardHead section={section} />
    <Problem section={section} />
    <div className="c360-text">
      {(section.rows || []).filter((row) => row.text).map((row, index) => <p key={index}>{String(row.text)}</p>)}
    </div>
  </div>
);

// ---- highlights ---------------------------------------------------------------------------
const CHIP_ICONS = { good: CheckCircle, warn: Clock, bad: XCircle, info: Info };

export const ChipsWidget = ({ section }) => {
  const rows = (section.rows || []).filter((row) => row.text);
  if (section.error) {
    return <div className="c360-card"><CardHead section={section} /><Problem section={section} /></div>;
  }
  if (rows.length === 0) return null;      // no highlights is normal: show nothing rather than an empty box
  return (
    <div className="c360-card is-plain">
      <div className="c360-chips-wrap">
        <div className="c360-chips">
          {rows.map((row, index) => {
            const tone = ['good', 'warn', 'bad'].includes(String(row.tone || '').toLowerCase()) ? String(row.tone).toLowerCase() : 'info';
            const Icon = CHIP_ICONS[tone];
            return (
              <span className={`c360-chip is-${tone}`} key={index}>
                <Icon size={15} aria-hidden="true" /> {String(row.text)}
              </span>
            );
          })}
        </div>
        <DemoBadge section={section} />
      </div>
    </div>
  );
};

// ---- figures ------------------------------------------------------------------------------
const STAT_ICONS = [Layers, TrendingUp, Activity, Clock, List, PieIcon];

export const StatsWidget = ({ section }) => (
  <div className="c360-card is-plain">
    {(section.mode !== 'live' || section.error) && (
      <div className="c360-stats-head">
        <div className="c360-card-title"><Activity size={15} aria-hidden="true" /><span>{section.title}</span></div>
        <DemoBadge section={section} />
      </div>
    )}
    {section.error && <div className="c360-error">{section.error}</div>}
    <div className={`c360-stats is-${(section.rows || []).length}`}>
      {(section.rows || []).map((row, index) => {
        const Icon = STAT_ICONS[index % STAT_ICONS.length];
        const numeric = typeof row.value === 'number' || (row.value !== null && row.value !== '' && Number.isFinite(Number(row.value)) && row.prefix);
        const trend = row.trend ? String(row.trend) : '';
        return (
          <div className="c360-stat" key={`${row.label}-${index}`}>
            <div className="c360-stat-label"><Icon size={14} aria-hidden="true" /> {row.label}</div>
            <div className="c360-stat-value" title={numeric ? `${row.prefix || ''} ${fullNumber(row.value)}`.trim() : undefined}>
              {row.prefix && <span className="c360-stat-prefix">{row.prefix}</span>}
              {numeric ? compactNumber(row.value) : String(row.value ?? '—')}
            </div>
            <div className="c360-stat-sub">
              {trend && <span className={`c360-stat-trend${trend.trim().startsWith('-') ? ' is-down' : ''}`}>{trend}</span>}
              {trend && row.subtext ? ' · ' : ''}
              {row.subtext}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ---- scores -------------------------------------------------------------------------------
const Ring = ({ value, max, display }) => {
  const radius = 34;
  const length = 2 * Math.PI * radius;
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`${display}`}>
      <circle className="c360-gauge-track" cx="46" cy="46" r={radius} fill="none" strokeWidth="7" />
      <circle className="c360-gauge-value" cx="46" cy="46" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={length} strokeDashoffset={length * (1 - share)} transform="rotate(-90 46 46)" />
      <text className="c360-gauge-number" x="46" y="52" textAnchor="middle">{display}</text>
    </svg>
  );
};

export const GaugesWidget = ({ section }) => (
  <div className="c360-card">
    <CardHead section={section} />
    <Problem section={section} />
    <div className="c360-gauges">
      {(section.rows || []).map((row, index) => {
        const tone = ['warn', 'bad'].includes(String(row.tone || '').toLowerCase()) ? String(row.tone).toLowerCase() : 'good';
        const value = Number(row.value) || 0;
        return (
          <div className={`c360-gauge is-${tone}`} key={`${row.label}-${index}`}>
            <Ring value={value} max={Number(row.max) || 100} display={row.display ? String(row.display) : fullNumber(value)} />
            <div className="c360-gauge-label">{row.label}</div>
            {row.caption && <div className="c360-gauge-caption">{row.caption}</div>}
          </div>
        );
      })}
    </div>
  </div>
);

// ---- trend chart --------------------------------------------------------------------------
export const LineWidget = ({ section }) => {
  const rows = (section.rows || []).filter((row) => row.value !== null && row.value !== undefined);
  const prefix = section.options?.prefix || '';
  const last = rows[rows.length - 1];
  const average = rows.length ? rows.reduce((sum, row) => sum + row.value, 0) / rows.length : 0;
  const note = firstNote(section.rows);
  const gradient = `c360-area-${section.key}`;

  return (
    <div className="c360-card">
      <CardHead section={section} right={section.options?.badge ? <span className="c360-badge">{section.options.badge}</span> : null} />
      <Problem section={section} />
      {rows.length > 0 && (
        <>
          <div className="c360-headline">
            {prefix ? `${prefix} ` : ''}{fullNumber(last.value)}<small>{last.label}</small>
          </div>
          <div className="c360-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2fa866" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#2fa866" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={compactNumber} />
                <Tooltip content={<ChartTip prefix={prefix} />} />
                {rows.length > 2 && (
                  <ReferenceLine y={average} stroke="#2fa866" strokeDasharray="4 4" strokeOpacity={0.6}
                    label={{ value: `avg ${compactNumber(average)}`, position: 'insideTopRight', fontSize: 10, fill: '#2fa866' }} />
                )}
                <Area type="monotone" dataKey="value" name={section.title} stroke="#1f9d57" strokeWidth={2.5} fill={`url(#${gradient})`}
                  dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      {note && <div className="c360-note">{note}</div>}
    </div>
  );
};

// ---- in and out chart ---------------------------------------------------------------------
export const BarsWidget = ({ section }) => {
  const rows = section.rows || [];
  const prefix = section.options?.prefix || '';
  const labelIn = section.options?.label_in || 'In';
  const labelOut = section.options?.label_out || 'Out';
  const note = firstNote(rows);

  return (
    <div className="c360-card">
      <CardHead section={section} />
      <Problem section={section} />
      {rows.length > 0 && (
        <>
          <div className="c360-chart is-short">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} />
                <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={compactNumber} />
                <Tooltip content={<ChartTip prefix={prefix} />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                <Bar dataKey="value_in" name={labelIn} fill={IN_COLOR} radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="value_out" name={labelOut} fill={OUT_COLOR} radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="c360-legend">
            <span><i style={{ background: IN_COLOR }} />{labelIn}</span>
            <span><i style={{ background: OUT_COLOR }} />{labelOut}</span>
          </div>
        </>
      )}
      {note && <div className="c360-note">{note}</div>}
    </div>
  );
};

// ---- share chart --------------------------------------------------------------------------
export const DonutWidget = ({ section }) => {
  const rows = (section.rows || []).filter((row) => Number(row.value) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.value), 0);
  const highlighted = rows.filter((row) => row.highlight).reduce((sum, row) => sum + Number(row.value), 0);
  const share = (value) => (total > 0 ? Math.round((Number(value) / total) * 100) : 0);
  const note = firstNote(section.rows);

  return (
    <div className="c360-card">
      <CardHead section={section} />
      <Problem section={section} />
      {rows.length > 0 && (
        <div className="c360-donut">
          <div className="c360-donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2}
                  startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                  {rows.map((row, index) => <Cell key={row.label} fill={SERIES[index % SERIES.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {highlighted > 0 && (
              <div className="c360-donut-center">
                <b>{share(highlighted)}%</b>
                <span>{section.options?.center_label || ''}</span>
              </div>
            )}
          </div>
          <ul className="c360-donut-list">
            {rows.map((row, index) => (
              <li key={row.label}>
                <i style={{ background: SERIES[index % SERIES.length] }} />
                <span>{row.label}</span>
                <b>{share(row.value)}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <div className="c360-note">{note}</div>}
    </div>
  );
};

// ---- table --------------------------------------------------------------------------------
export const TableWidget = ({ section }) => {
  const rows = section.rows || [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <div className="c360-card">
      <CardHead section={section} />
      <Problem section={section} />
      {rows.length > 0 && (
        <div className="c360-table-wrap">
          <table className="c360-table">
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className={typeof row[column] === 'number' ? 'is-number' : undefined}>
                      {typeof row[column] === 'number' ? fullNumber(row[column]) : row[column] === null || row[column] === undefined ? '—' : String(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const WIDGET_COMPONENTS = {
  profile: ProfileWidget,
  details: DetailsWidget,
  text: TextWidget,
  chips: ChipsWidget,
  stats: StatsWidget,
  gauges: GaugesWidget,
  line: LineWidget,
  bars: BarsWidget,
  donut: DonutWidget,
  table: TableWidget,
};

export { AlertTriangle };
