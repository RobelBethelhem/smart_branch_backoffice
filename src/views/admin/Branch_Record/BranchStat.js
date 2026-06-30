import React, { useMemo, useState } from 'react';
import './BranchStat.css';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import {
  TextField, Button, Box, Typography, Paper, Grid, Skeleton,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  AttachMoney as AttachMoneyIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, ChartLegend);

const CHART_COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

// Build the formatter once instead of per-call (formatters run repeatedly
// during chart hover/redraw).
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });
const formatCurrency = (amount) => CURRENCY_FORMAT.format(amount);

// Mini stat card
const MiniCard = ({ title, value, icon, color, delay = 0 }) => (
  <Grid item xs={6} sm={4} md={3} lg={2.4}>
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Paper sx={{
        p: 2.5, borderRadius: 2, textAlign: 'center',
        borderTop: `3px solid ${color}`,
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
        transition: 'all 0.3s ease',
      }}>
        <Box sx={{ color, mb: 1 }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{title}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{value}</Typography>
      </Paper>
    </motion.div>
  </Grid>
);

const BranchStat = ({ transactions = [], branchCode = '', isLoading = false }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter transactions client-side (no separate API call!)
  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactions;
    return transactions.filter(tx => {
      const txDate = new Date(tx.request_date);
      if (startDate && txDate < new Date(startDate)) return false;
      if (endDate && txDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Compute all statistics in one pass
  const stats = useMemo(() => {
    const result = {
      waitingTimes: [],
      totalAmount: 0,
      maxAmount: 0,
      minAmount: Infinity,
      incomingAmount: 0,
      outgoingAmount: 0,
      typeCounts: {},
      statusCounts: {},
      hourSlots: {},
      dayCounts: {},
    };

    if (filteredTransactions.length === 0) return result;

    filteredTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount_in_figures) || 0;
      // FIX: Use transactionType (not transaction_type)
      const type = tx.transactionType?.toLowerCase() || 'unknown';
      const status = tx.status || 'unknown';
      const beneficiaryBranch = tx.beneficiary_branch || '';

      // Waiting time (request_date → assigned_date)
      if (tx.request_date && tx.assigned_date) {
        const diffMs = new Date(tx.assigned_date) - new Date(tx.request_date);
        const diffMin = Math.round(diffMs / 60000);
        if (!isNaN(diffMin) && diffMin >= 0) {
          result.waitingTimes.push(diffMin);
        }
      }

      // Amount stats
      result.totalAmount += amount;
      if (amount > result.maxAmount) result.maxAmount = amount;
      if (amount < result.minAmount) result.minAmount = amount;

      // Incoming/Outgoing (FIX: use transactionType not transaction_type)
      if (type === 'deposit') {
        result.incomingAmount += amount;
      } else if (type === 'withdraw' || type === 'other-bank-transfer') {
        result.outgoingAmount += amount;
      } else if (type === 'transfer') {
        if (beneficiaryBranch === branchCode) {
          result.incomingAmount += amount;
        } else {
          result.outgoingAmount += amount;
        }
      }

      // Type counts
      result.typeCounts[type] = (result.typeCounts[type] || 0) + 1;

      // Status counts
      result.statusCounts[status] = (result.statusCounts[status] || 0) + 1;

      // Hour slots (2-hour windows)
      if (tx.request_date) {
        const hour = new Date(tx.request_date).getHours();
        const slotStart = Math.floor(hour / 2) * 2;
        const slotEnd = slotStart + 2;
        const label = `${slotStart.toString().padStart(2, '0')}:00 - ${slotEnd.toString().padStart(2, '0')}:00`;
        result.hourSlots[label] = (result.hourSlots[label] || 0) + 1;
      }

      // Day counts
      if (tx.request_date) {
        try {
          const day = format(new Date(tx.request_date), 'EEEE');
          result.dayCounts[day] = (result.dayCounts[day] || 0) + 1;
        } catch { /* skip invalid dates */ }
      }
    });

    // Handle edge cases
    if (result.minAmount === Infinity) result.minAmount = 0;

    return result;
  }, [filteredTransactions, branchCode]);

  // Derived waiting time stats (safe against empty arrays)
  const waitStats = useMemo(() => {
    const times = stats.waitingTimes;
    if (times.length === 0) return { min: 0, max: 0, avg: 0 };
    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
    };
  }, [stats.waitingTimes]);

  const avgAmount = filteredTransactions.length > 0 ? stats.totalAmount / filteredTransactions.length : 0;

  // Sort hour slots for proper chart display
  const sortedHourSlots = useMemo(() => {
    const entries = Object.entries(stats.hourSlots);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [stats.hourSlots]);

  // Sort days in correct weekday order
  const orderedDays = useMemo(() => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayOrder
      .filter(d => stats.dayCounts[d])
      .map(d => [d, stats.dayCounts[d]]);
  }, [stats.dayCounts]);

  // Chart data
  const busyHoursData = {
    labels: sortedHourSlots.map(([l]) => l),
    datasets: [{
      label: 'Requests',
      data: sortedHourSlots.map(([, v]) => v),
      backgroundColor: 'rgba(52, 152, 219, 0.7)',
      borderColor: '#3498db',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const busyDaysData = {
    labels: orderedDays.map(([d]) => d),
    datasets: [{
      label: 'Requests',
      data: orderedDays.map(([, c]) => c),
      backgroundColor: 'rgba(155, 89, 182, 0.7)',
      borderColor: '#9b59b6',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const typeLabels = Object.keys(stats.typeCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' '));
  const typeData = {
    labels: typeLabels,
    datasets: [{
      data: Object.values(stats.typeCounts),
      backgroundColor: CHART_COLORS.slice(0, typeLabels.length),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const statusLabels = Object.keys(stats.statusCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));
  const statusData = {
    labels: statusLabels,
    datasets: [{
      data: Object.values(stats.statusCounts),
      backgroundColor: CHART_COLORS.slice(0, statusLabels.length),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const chartOptions = (xLabel, yLabel) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { title: { display: true, text: xLabel }, grid: { display: false } },
      y: { title: { display: true, text: yLabel }, ticks: { precision: 0 }, beginAtZero: true },
    },
  });

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true } } },
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          {[1,2,3,4,5].map(i => (
            <Grid item xs={6} sm={4} md={2.4} key={i}>
              <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
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
        <TextField label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        {(startDate || endDate) && (
          <Button variant="outlined" size="small" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</Button>
        )}
        <Typography variant="body2" sx={{ ml: 'auto', color: 'text.secondary' }}>
          {filteredTransactions.length} transactions
        </Typography>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <MiniCard title="Min Wait" value={`${waitStats.min} min`} icon={<ScheduleIcon />} color="#2ecc71" delay={0} />
        <MiniCard title="Avg Wait" value={`${waitStats.avg} min`} icon={<AccessTimeIcon />} color="#3498db" delay={0.05} />
        <MiniCard title="Max Wait" value={`${waitStats.max} min`} icon={<ScheduleIcon />} color="#e74c3c" delay={0.1} />
        <MiniCard title="Transactions" value={filteredTransactions.length} icon={<ReceiptIcon />} color="#9b59b6" delay={0.15} />
        <MiniCard title="Total Amount" value={formatCurrency(stats.totalAmount)} icon={<AttachMoneyIcon />} color="#f39c12" delay={0.2} />
        <MiniCard title="Avg Amount" value={formatCurrency(avgAmount)} icon={<AttachMoneyIcon />} color="#1abc9c" delay={0.25} />
        <MiniCard title="Max Amount" value={formatCurrency(stats.maxAmount)} icon={<TrendingUpIcon />} color="#e67e22" delay={0.3} />
        <MiniCard title="Min Amount" value={formatCurrency(stats.minAmount)} icon={<TrendingDownIcon />} color="#34495e" delay={0.35} />
        <MiniCard title="Incoming" value={formatCurrency(stats.incomingAmount)} icon={<TrendingUpIcon />} color="#27ae60" delay={0.4} />
        <MiniCard title="Outgoing" value={formatCurrency(stats.outgoingAmount)} icon={<TrendingDownIcon />} color="#c0392b" delay={0.45} />
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>Busy Hours</Typography>
            <Box sx={{ height: 280 }}>
              {sortedHourSlots.length > 0 ? (
                <Bar data={busyHoursData} options={chartOptions('Time Range', 'Requests')} />
              ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>No data</Box>}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>Busy Days</Typography>
            <Box sx={{ height: 280 }}>
              {orderedDays.length > 0 ? (
                <Bar data={busyDaysData} options={chartOptions('Day of Week', 'Requests')} />
              ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>No data</Box>}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>Transaction Types</Typography>
            <Box sx={{ height: 280 }}>
              {typeLabels.length > 0 ? (
                <Pie data={typeData} options={pieOptions} />
              ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>No data</Box>}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>By Status</Typography>
            <Box sx={{ height: 280 }}>
              {statusLabels.length > 0 ? (
                <Doughnut data={statusData} options={pieOptions} />
              ) : <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>No data</Box>}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Status Summary Table */}
      {Object.keys(stats.statusCounts).length > 0 && (
        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>Status Summary</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', backgroundColor: '#3498db', color: 'white', borderRadius: '8px 0 0 0' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: '#3498db', color: 'white' }}>Count</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: '#3498db', color: 'white', borderRadius: '0 8px 0 0' }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.statusCounts).map(([status, count], i) => (
                  <tr key={status} style={{ backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid #eee' }}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #eee', fontWeight: 600 }}>
                      {count}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', borderBottom: '1px solid #eee', color: '#7f8c8d' }}>
                      {filteredTransactions.length > 0 ? ((count / filteredTransactions.length) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Paper>
      )}
    </motion.div>
  );
};

export default BranchStat;
