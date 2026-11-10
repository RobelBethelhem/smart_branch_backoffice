import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from 'src/config/api';
import FitText from './FitText';
import TellerTable from './TellerTable';
import {
  formatMoney, formatCount, formatCompact, formatDuration, typeLabel, statusLabel,
} from './recordFormat';

const COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];

// Summary card. The figure is fitted to the card's width (FitText), so a large amount gets
// smaller instead of running out of the card.
const StatCard = ({ title, value, subtitle, icon, gradient, delay = 0 }) => (
  <Grid item xs={12} sm={6} lg={3}>
    <motion.div
      style={{ height: '100%' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    >
      <Paper sx={{
        p: { xs: 2, sm: 3 }, borderRadius: 3, position: 'relative', overflow: 'hidden',
        background: gradient, color: 'white', minHeight: 132, height: '100%',
      }}>
        {/* The icon sits beside the title, in the layout, so it can never cover the figure. */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>{title}</Typography>
          <Box sx={{ opacity: 0.4, lineHeight: 0, flexShrink: 0 }}>{icon}</Box>
        </Box>
        <FitText max={34} min={14} sx={{ mb: 0.5 }}>{value}</FitText>
        {subtitle && (
          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block', overflowWrap: 'anywhere' }}>
            {subtitle}
          </Typography>
        )}
      </Paper>
    </motion.div>
  </Grid>
);

// How the requests of the period ended up: count, and what they were worth.
const OutcomeTile = ({ title, count, amount, color, hint }) => (
  <Grid item xs={6} md={3}>
    <Paper
      title={hint}
      sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${color}`, height: '100%', minWidth: 0 }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{title}</Typography>
      <FitText max={24} min={13} sx={{ color }}>{formatCount(count)}</FitText>
      <FitText max={14} min={11} sx={{ fontWeight: 500, color: 'text.secondary' }}>{formatMoney(amount)}</FitText>
    </Paper>
  </Grid>
);

// Chart wrapper. No fixed height: the card grows with its chart and legend, so nothing spills
// out below it. Cards in the same row are stretched to the same height.
const ChartCard = ({ title, children }) => (
  <Paper sx={{
    p: { xs: 2, sm: 3 }, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    height: '100%', minWidth: 0, overflow: 'hidden',
  }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50', mb: 2, overflowWrap: 'anywhere' }}>
      {title}
    </Typography>
    {children}
  </Paper>
);

const NoData = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250, color: 'text.secondary' }}>
    No data available
  </Box>
);

// Long user names under a bar chart are shortened (the tooltip shows the full name), so the
// slanted labels are not cut off at the edge of the chart.
const shortName = (name) => {
  const text = String(name ?? '');
  return text.length > 16 ? `${text.slice(0, 15)}…` : text;
};

// Slice labels show the share only; the names are in the legend, where they cannot be cut off.
const sharePercent = ({ percent }) => (percent >= 0.04 ? `${(percent * 100).toFixed(0)}%` : '');

const EMPTY_STATS = {
  incomingMoney: 0, outgoingMoney: 0, netFlow: 0, totalTransactions: 0,
  completedCount: 0, pendingCount: 0, notServedCount: 0, rejectedCount: 0,
  totalAmount: 0, pendingAmount: 0, notServedAmount: 0, rejectedAmount: 0,
  awaitingAuthorization: { count: 0, olderThanToday: 0 },
  awaitingAudit: { count: 0, olderThanToday: 0 },
  transactionTypes: {}, statusDistribution: {}, postedByDistribution: {},
  userStats: {}, delayMetrics: {}, tellerStats: [],
};

const plural = (count, word) => `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`;

// Optional props:
//   branch           - restrict stats to one branch code (?branch=)
//   dateRange        - controlled { start, end } from the parent
//   hideDateFilter   - hide this tab's own date picker (the parent shows one)
//   requireBranch    - wait for a branch before loading (the "Branches Record" view);
//                      defaults to hideDateFilter, which is how that view has always used it
const StatisticsTab = ({
  accessToken, branch, dateRange: controlledDateRange, hideDateFilter = false, requireBranch = hideDateFilter,
}) => {
  const [internalDateRange, setInternalDateRange] = useState({ start: '', end: '' });
  const dateRange = controlledDateRange || internalDateRange;
  const setDateRange = setInternalDateRange;

  // The figures are worked out on the server over the (date/branch-filtered) requests and
  // returned as one small object; the browser never downloads the requests themselves.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['branch-stats-statistics', dateRange, branch],
    queryFn: async () => {
      const url = new URL(`${API_BASE_URL}/api/zsmart_branch_requests/branch_transactions_stats`, window.location.origin);
      if (dateRange.start) url.searchParams.set('from', dateRange.start);
      if (dateRange.end) url.searchParams.set('to', dateRange.end);
      if (branch) url.searchParams.set('branch', branch);
      const res = await fetch(url.href, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message || 'Failed to load statistics');
      return json.data;
    },
    enabled: !!accessToken && (requireBranch ? !!branch : true),
  });
  const stats = useMemo(() => ({ ...EMPTY_STATS, ...(data || {}) }), [data]);

  const pieChartData = useMemo(() =>
    Object.entries(stats.transactionTypes || {}).map(([key, value]) => ({ name: typeLabel(key), value })),
    [stats.transactionTypes]);

  const statusChartData = useMemo(() =>
    Object.entries(stats.statusDistribution || {}).map(([status, count]) => ({ status: statusLabel(status), count })),
    [stats.statusDistribution]);

  const postedByChartData = useMemo(() =>
    Object.entries(stats.postedByDistribution || {})
      .filter(([user]) => user !== 'Unassigned')
      .map(([user, count]) => ({ name: user, value: count })),
    [stats.postedByDistribution]);

  const usersInOutData = useMemo(() =>
    Object.entries(stats.userStats || {})
      .filter(([user]) => user !== 'Unassigned')
      .map(([user, userData]) => ({ user, incoming: userData.incomingMoney, outgoing: userData.outgoingMoney })),
    [stats.userStats]);

  const delayChartData = useMemo(() =>
    Object.entries(stats.delayMetrics || {}).map(([user, m]) => ({
      user, avg: +m.avg.toFixed(1), max: +m.max.toFixed(1), min: +m.min.toFixed(1),
    })), [stats.delayMetrics]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} lg={3} key={i}>
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const overdueAuthorization = stats.awaitingAuthorization?.olderThanToday || 0;
  const overdueAudit = stats.awaitingAudit?.olderThanToday || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      {/* Date Filter (hidden when the parent shows one) */}
      {!hideDateFilter && (
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1 }}>Date Range:</Typography>
        <TextField
          label="From" type="date" value={dateRange.start}
          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          size="small" InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To" type="date" value={dateRange.end}
          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          size="small" InputLabelProps={{ shrink: true }}
        />
        {(dateRange.start || dateRange.end) && (
          <Button variant="outlined" size="small" onClick={() => setDateRange({ start: '', end: '' })}>Clear</Button>
        )}
        <Typography variant="body2" sx={{ ml: 'auto', color: 'text.secondary' }}>
          {formatCount(stats.totalTransactions)} requests
        </Typography>
      </Paper>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>The statistics could not be loaded. Please try again.</Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 2 }}>
        <StatCard title="Total Requests" value={formatCount(stats.totalTransactions)} subtitle={`${formatCount(stats.completedCount)} completed · ${formatCount(stats.pendingCount)} pending · ${formatCount(stats.notServedCount)} not served · ${formatCount(stats.rejectedCount)} rejected`} icon={<ReceiptIcon sx={{ fontSize: 28 }} />} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" delay={0} />
        <StatCard title="Incoming Money" value={formatMoney(stats.incomingMoney)} subtitle="Completed deposits & incoming transfers" icon={<TrendingUpIcon sx={{ fontSize: 28 }} />} gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" delay={0.1} />
        <StatCard title="Outgoing Money" value={formatMoney(stats.outgoingMoney)} subtitle="Completed withdrawals, e-cheques & outgoing transfers" icon={<TrendingDownIcon sx={{ fontSize: 28 }} />} gradient="linear-gradient(135deg, #eb3349 0%, #f45c43 100%)" delay={0.2} />
        <StatCard title="Net Flow" value={formatMoney(stats.netFlow)} subtitle={stats.netFlow >= 0 ? 'More came in than went out' : 'More went out than came in'} icon={stats.netFlow >= 0 ? <TrendingUpIcon sx={{ fontSize: 28 }} /> : <TrendingDownIcon sx={{ fontSize: 28 }} />} gradient={stats.netFlow >= 0 ? 'linear-gradient(135deg, #0052D4 0%, #65C7F7 100%)' : 'linear-gradient(135deg, #CB356B 0%, #BD3F32 100%)'} delay={0.3} />
      </Grid>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Money figures count completed requests only (posted, authorized or audited). Requests that are waiting,
        were not served or were rejected moved no money and are listed separately below.
      </Typography>

      {/* What happened to the requests */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <OutcomeTile title="Completed" count={stats.completedCount} amount={stats.totalAmount} color="#1e8449" hint="Posted to FlexCube: posted, authorized or audited" />
        <OutcomeTile title="Pending" count={stats.pendingCount} amount={stats.pendingAmount} color="#2471a3" hint="Made today and waiting for a teller or a checker" />
        <OutcomeTile title="Not served (expired)" count={stats.notServedCount} amount={stats.notServedAmount} color="#b9770e" hint="Not completed on the day of the request. The request has expired." />
        <OutcomeTile title="Rejected" count={stats.rejectedCount} amount={stats.rejectedAmount} color="#922b21" hint="Rejected by a limit check or by the checker" />
      </Grid>

      {/* Things that need someone's attention */}
      {(stats.notServedCount > 0 || overdueAuthorization > 0 || overdueAudit > 0) && (
        <Alert severity="warning" sx={{ mb: 3, '& .MuiAlert-message': { minWidth: 0, overflowWrap: 'anywhere' } }}>
          {stats.notServedCount > 0 && (
            <div>
              {plural(stats.notServedCount, 'request')} ({formatMoney(stats.notServedAmount)}) {stats.notServedCount === 1 ? 'was' : 'were'} not
              completed on the day {stats.notServedCount === 1 ? 'it was' : 'they were'} made and {stats.notServedCount === 1 ? 'has' : 'have'} expired. The customer has to make a new request.
            </div>
          )}
          {overdueAuthorization > 0 && (
            <div>
              {plural(overdueAuthorization, 'posted transaction')} from an earlier day {overdueAuthorization === 1 ? 'is' : 'are'} still
              not authorized.
            </div>
          )}
          {overdueAudit > 0 && (
            <div>
              {plural(overdueAudit, 'authorized transaction')} from an earlier day {overdueAudit === 1 ? 'is' : 'are'} still not audited.
            </div>
          )}
        </Alert>
      )}

      {/* Per-teller detail */}
      <TellerTable tellers={stats.tellerStats || []} />

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Request Type Distribution">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieChartData} cx="50%" cy="50%" outerRadius={85} innerRadius={48} dataKey="value" labelLine={false} label={sharePercent}>
                    {pieChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${formatCount(value)} requests`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Request Status Distribution">
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusChartData} margin={{ top: 10, right: 20, left: 0, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="status" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickFormatter={formatCompact} />
                  <Tooltip formatter={(value) => formatCount(value)} />
                  <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Posted Transactions by User">
            {postedByChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={postedByChartData} cx="50%" cy="50%" outerRadius={85} innerRadius={48} dataKey="value" labelLine={false} label={sharePercent}>
                    {postedByChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${formatCount(value)} transactions`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Incoming & Outgoing by User">
            {usersInOutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={usersInOutData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="user" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} tickFormatter={shortName} height={70} />
                  <YAxis tickFormatter={formatCompact} />
                  <Tooltip formatter={(value) => formatMoney(value)} />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="incoming" fill="#2ecc71" name="Incoming" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outgoing" fill="#e74c3c" name="Outgoing" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Delay Metrics */}
      {delayChartData.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
            <TimerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Time from Assignment to Posting
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {delayChartData.map(({ user, max, min, avg }, i) => (
              <Grid item xs={12} sm={6} md={4} key={user}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.1 }}>
                  <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: `4px solid ${COLORS[i % COLORS.length]}`, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, overflowWrap: 'anywhere' }}>{user}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, textAlign: 'center' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">Min</Typography>
                        <FitText max={20} min={11} sx={{ color: 'success.main', fontWeight: 600 }}>{formatDuration(min)}</FitText>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">Avg</Typography>
                        <FitText max={20} min={11} sx={{ color: 'primary.main', fontWeight: 600 }}>{formatDuration(avg)}</FitText>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">Max</Typography>
                        <FitText max={20} min={11} sx={{ color: 'error.main', fontWeight: 600 }}>{formatDuration(max)}</FitText>
                      </Box>
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <ChartCard title="Time from Assignment to Posting by User (Minutes)">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={delayChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="user" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} tickFormatter={shortName} height={70} />
                    <YAxis tickFormatter={formatCompact} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => formatDuration(value)} />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="min" fill="#2ecc71" name="Shortest" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avg" fill="#3498db" name="Average" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="max" fill="#e74c3c" name="Longest" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          </Grid>
        </>
      )}
    </motion.div>
  );
};

export default StatisticsTab;
