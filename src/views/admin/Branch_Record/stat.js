import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  Skeleton,
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

const COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];

// Construct the formatter once at module load. It was previously allocated on
// every call, and recharts invokes formatters repeatedly during hover/redraw,
// so building a new Intl.NumberFormat each time was needless churn.
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });
const formatCurrency = (amount) => CURRENCY_FORMAT.format(amount);

// Reusable stat card component
const StatCard = ({ title, value, subtitle, icon, gradient, delay = 0 }) => (
  <Grid item xs={12} sm={6} md={3}>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    >
      <Paper sx={{
        p: 3, borderRadius: 3, position: 'relative', overflow: 'hidden',
        background: gradient, color: 'white', minHeight: 140,
      }}>
        <Box sx={{ position: 'absolute', top: 12, right: 12, opacity: 0.3, fontSize: 48 }}>
          {icon}
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontWeight: 500 }}>{title}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>{value}</Typography>
        {subtitle && <Typography variant="caption" sx={{ opacity: 0.8 }}>{subtitle}</Typography>}
      </Paper>
    </motion.div>
  </Grid>
);

// Chart wrapper component
const ChartCard = ({ title, children, height = 320 }) => (
  <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
      {title}
    </Typography>
    {children}
  </Paper>
);

const StatisticsTab = ({ transactions = [], branchCode = '', isLoading = false }) => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Filter transactions by date range (client-side — no extra API call!)
  const filteredTransactions = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return transactions;
    return transactions.filter(tx => {
      const txDate = new Date(tx.request_date);
      if (dateRange.start && txDate < new Date(dateRange.start)) return false;
      if (dateRange.end && txDate > new Date(dateRange.end + 'T23:59:59')) return false;
      return true;
    });
  }, [transactions, dateRange]);

  // Compute all stats in a single pass (O(n) instead of multiple loops)
  const stats = useMemo(() => {
    let incomingMoney = 0;
    let outgoingMoney = 0;
    const transactionTypes = {};
    const statusDistribution = {};
    const postedByDistribution = {};
    const userStats = {};
    const delayMetrics = {};

    filteredTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount_in_figures) || 0;
      const type = tx.transactionType?.toLowerCase();
      const status = tx.status || 'unknown';
      const postedBy = tx.posted_by || 'Unassigned';
      const beneficiaryBranch = tx.beneficiary_branch || '';

      // Type & status counts (include ALL transactions, not just posted ones)
      transactionTypes[type] = (transactionTypes[type] || 0) + 1;
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      postedByDistribution[postedBy] = (postedByDistribution[postedBy] || 0) + 1;

      // Incoming/Outgoing money
      if (type === 'deposit') {
        incomingMoney += amount;
      } else if (type === 'withdraw' || type === 'other-bank-transfer') {
        outgoingMoney += amount;
      } else if (type === 'transfer') {
        if (beneficiaryBranch === branchCode) {
          incomingMoney += amount;
        } else {
          outgoingMoney += amount;
        }
      }

      // Per-user stats
      if (!userStats[postedBy]) {
        userStats[postedBy] = { incomingMoney: 0, outgoingMoney: 0, count: 0 };
      }
      userStats[postedBy].count += 1;

      if (type === 'deposit' || (type === 'transfer' && beneficiaryBranch === branchCode)) {
        userStats[postedBy].incomingMoney += amount;
      } else if (type === 'withdraw' || type === 'other-bank-transfer' || (type === 'transfer' && beneficiaryBranch !== branchCode)) {
        userStats[postedBy].outgoingMoney += amount;
      }

      // Delay metrics (only for transactions that have both dates)
      if (tx.assigned_date && tx.posted_date) {
        const delayMs = new Date(tx.posted_date) - new Date(tx.assigned_date);
        const delayMin = delayMs / 60000;
        if (!isNaN(delayMin) && delayMin >= 0) {
          if (!delayMetrics[postedBy]) {
            delayMetrics[postedBy] = { max: delayMin, min: delayMin, total: delayMin, count: 1 };
          } else {
            delayMetrics[postedBy].max = Math.max(delayMetrics[postedBy].max, delayMin);
            delayMetrics[postedBy].min = Math.min(delayMetrics[postedBy].min, delayMin);
            delayMetrics[postedBy].total += delayMin;
            delayMetrics[postedBy].count += 1;
          }
        }
      }
    });

    // Calculate averages
    Object.values(delayMetrics).forEach(m => { m.avg = m.total / m.count; });

    return {
      incomingMoney, outgoingMoney, transactionTypes, statusDistribution,
      postedByDistribution, userStats, delayMetrics,
      totalTransactions: filteredTransactions.length,
      netFlow: incomingMoney - outgoingMoney,
    };
  }, [filteredTransactions, branchCode]);

  // Chart data
  const pieChartData = useMemo(() =>
    Object.entries(stats.transactionTypes).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '), value,
    })), [stats.transactionTypes]);

  const statusChartData = useMemo(() =>
    Object.entries(stats.statusDistribution).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '), count,
    })), [stats.statusDistribution]);

  const postedByChartData = useMemo(() =>
    Object.entries(stats.postedByDistribution)
      .filter(([user]) => user !== 'Unassigned')
      .map(([user, count]) => ({ name: user, value: count })),
    [stats.postedByDistribution]);

  const usersInOutData = useMemo(() =>
    Object.entries(stats.userStats)
      .filter(([user]) => user !== 'Unassigned')
      .map(([user, data]) => ({ user, incoming: data.incomingMoney, outgoing: data.outgoingMoney })),
    [stats.userStats]);

  const delayChartData = useMemo(() =>
    Object.entries(stats.delayMetrics).map(([user, m]) => ({
      user, avg: +m.avg.toFixed(1), max: +m.max.toFixed(1), min: +m.min.toFixed(1),
    })), [stats.delayMetrics]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          {[1,2,3,4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      {/* Date Filter */}
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
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </Typography>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <StatCard title="Total Transactions" value={stats.totalTransactions} subtitle="All transaction types" icon={<ReceiptIcon sx={{ fontSize: 48 }} />} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" delay={0} />
        <StatCard title="Incoming Money" value={formatCurrency(stats.incomingMoney)} subtitle="Deposits & incoming transfers" icon={<TrendingUpIcon sx={{ fontSize: 48 }} />} gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" delay={0.1} />
        <StatCard title="Outgoing Money" value={formatCurrency(stats.outgoingMoney)} subtitle="Withdrawals & outgoing transfers" icon={<TrendingDownIcon sx={{ fontSize: 48 }} />} gradient="linear-gradient(135deg, #eb3349 0%, #f45c43 100%)" delay={0.2} />
        <StatCard title="Net Flow" value={formatCurrency(stats.netFlow)} subtitle={stats.netFlow >= 0 ? 'Positive balance' : 'Negative balance'} icon={stats.netFlow >= 0 ? <TrendingUpIcon sx={{ fontSize: 48 }} /> : <TrendingDownIcon sx={{ fontSize: 48 }} />} gradient={stats.netFlow >= 0 ? 'linear-gradient(135deg, #0052D4 0%, #65C7F7 100%)' : 'linear-gradient(135deg, #CB356B 0%, #BD3F32 100%)'} delay={0.3} />
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Transaction Type Distribution">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieChartData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {pieChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} transactions`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250, color: 'text.secondary' }}>No data available</Box>}
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Transaction Status Distribution">
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250, color: 'text.secondary' }}>No data available</Box>}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Transactions by User">
            {postedByChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={postedByChartData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {postedByChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} transactions`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250, color: 'text.secondary' }}>No data available</Box>}
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Incoming & Outgoing by User">
            {usersInOutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={usersInOutData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="user" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="incoming" fill="#2ecc71" name="Incoming" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outgoing" fill="#e74c3c" name="Outgoing" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250, color: 'text.secondary' }}>No data available</Box>}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Delay Metrics */}
      {delayChartData.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
            <TimerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Transaction Posting Delays
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {delayChartData.map(({ user, max, min, avg }, i) => (
              <Grid item xs={12} sm={6} md={4} key={user}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{user}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Min</Typography>
                        <Typography variant="h6" color="success.main" sx={{ fontWeight: 600 }}>{min}m</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Avg</Typography>
                        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>{avg}m</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Max</Typography>
                        <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>{max}m</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <ChartCard title="Average Posting Delay by User (Minutes)" height={380}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={delayChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="user" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                    <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => `${value} mins`} />
                    <Legend />
                    <Bar dataKey="min" fill="#2ecc71" name="Min Delay" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avg" fill="#3498db" name="Avg Delay" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="max" fill="#e74c3c" name="Max Delay" radius={[4, 4, 0, 0]} />
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
