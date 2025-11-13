import React, { useMemo, useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Paper,
  Grid,
  TextField,
} from '@mui/material';
import { 
  LocalAtm as LocalAtmIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  SwapHoriz as SwapHorizIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
} from 'recharts';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

// Define COLORS for the charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#a4de6c', '#d0ed57'];

// Helper functions
const formatDateTime = (dateString) => {
  try {
    const date = new Date(dateString);
    return format(date, "EEE MMM d, yyyy: hh:mm a");
  } catch {
    return dateString;
  }
};

const formatAmount = (amount) => {
  return Number(amount).toLocaleString('en-US');
};

// StatisticsTab Component
const StatisticsTab = ({ initialStats }) => {
  const accessToken = useSelector((state) => state.user.accessToken);

  // Global Date Range State
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [stats, setStats] = useState({
    incomingMoney: 0,
    outgoingMoney: 0,
    transactionTypes: {},
    statusDistribution: {},
    dailyVolume: {},
    postedByDistribution: {}, // Added for user-specific stats
    userStats: {}, // Object to hold stats for each user
    delayMetrics: {}, // New state to hold delay metrics per user
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/branch_transactions', {
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': accessToken,
          },
        });
        const data = await response.json();
        
        if (data.error === false && data.data) {
          const branch = data.data.branch;
          let incomingMoney = 0;
          let outgoingMoney = 0;

          const transactionTypes = {};
          const statusDistribution = {};
          const dailyVolume = {};
          const postedByDistribution = {};
          const userStats = {};
          const delayMetrics = {}; // Initialize delay metrics

          // Apply Date Range Filter
          const filteredTransactions = data.data.transactions.filter(transaction => {
            if (!dateRange.start && !dateRange.end) return true;
            const transactionDate = new Date(transaction.request_date);
            if (dateRange.start && transactionDate < new Date(dateRange.start)) return false;
            if (dateRange.end && transactionDate > new Date(dateRange.end)) return false;
            return true;
          });

          filteredTransactions.forEach(transaction => {
            console.log('Processing transaction:', {
              type: transaction.transactionType,
              amount: transaction.amount_in_figures,
              beneficiaryBranch: transaction.beneficiary_branch,
              branch: branch
            });
            const amount = parseFloat(transaction.amount_in_figures) || 0;
            const type = transaction.transactionType?.toLowerCase();
            const accountNumber = transaction.account_number;
            const firstThreeDigits = accountNumber?.substring(0, 3) || '';
            const beneficiaryBranch = transaction.beneficiary_branch || '';
            const postedBy = transaction.posted_by || 'Unknown';

            // Error Handling: Ensure dates are present
            if (!transaction.assigned_date || !transaction.posted_date) {
              console.warn(`Transaction ID ${transaction.id} is missing assigned_date or posted_date.`);
              return; // Skip this transaction
            }

            const assignedDate = new Date(transaction.assigned_date);
            const postedDate = new Date(transaction.posted_date);

            // Calculate delay in minutes
            const delayInMs = postedDate - assignedDate;
            const delayInMinutes = delayInMs / (1000 * 60);

            // Ensure delay is a valid number
            if (isNaN(delayInMinutes) || delayInMinutes < 0) {
              console.warn(`Invalid delay for Transaction ID ${transaction.id}.`);
              return; // Skip this transaction
            }

            if (!isNaN(amount)) {
              // Update type breakdown
              transactionTypes[type] = (transactionTypes[type] || 0) + 1;

              // Update status breakdown
              const status = transaction.status || 'unknown';
              statusDistribution[status] = (statusDistribution[status] || 0) + 1;

              // Update daily volume
              const date = format(new Date(transaction.request_date), 'yyyy-MM-dd');
              dailyVolume[date] = (dailyVolume[date] || 0) + amount;

              // Update Incoming Money Logic
              if (type === 'deposit' || type === 'incoming') {
                incomingMoney += amount;
              }
              // Update Outgoing Money Logic
              else if (type === 'withdraw' || type === 'outgoing' || type === 'other-bank-transfer') {
                outgoingMoney += amount;
              }
              // Handle Transfer transactions
              else if (type === 'transfer') {
                if (beneficiaryBranch === branch) {
                  incomingMoney += amount;
                } else {
                  outgoingMoney += amount;
                }
              }

              // Update posted_by distribution
              postedByDistribution[postedBy] = (postedByDistribution[postedBy] || 0) + 1;

              // Initialize userStats for the user if not present
              if (!userStats[postedBy]) {
                userStats[postedBy] = {
                  incomingMoney: 0,
                  outgoingMoney: 0,
                  transactionTypes: {},
                  statusDistribution: {},
                };
              }

              // Update user's incoming/outgoing amounts
              if (type === 'deposit' || type === 'incoming' || 
                 (type === 'transfer' && beneficiaryBranch === branch)) {
                userStats[postedBy].incomingMoney += amount;
              } else if (type === 'withdraw' || type === 'outgoing' || 
                        type === 'other-bank-transfer' ||
                        (type === 'transfer' && beneficiaryBranch !== branch)) {
                userStats[postedBy].outgoingMoney += amount;
              }

              // Update user transaction types
              userStats[postedBy].transactionTypes[type] = (userStats[postedBy].transactionTypes[type] || 0) + 1;

              // Update user status distribution
              userStats[postedBy].statusDistribution[status] = (userStats[postedBy].statusDistribution[status] || 0) + 1;

              // Update delayMetrics
              if (!delayMetrics[postedBy]) {
                delayMetrics[postedBy] = {
                  maxDelay: delayInMinutes,
                  minDelay: delayInMinutes,
                  totalDelay: delayInMinutes,
                  transactionCount: 1,
                };
              } else {
                delayMetrics[postedBy].maxDelay = Math.max(delayMetrics[postedBy].maxDelay, delayInMinutes);
                delayMetrics[postedBy].minDelay = Math.min(delayMetrics[postedBy].minDelay, delayInMinutes);
                delayMetrics[postedBy].totalDelay += delayInMinutes;
                delayMetrics[postedBy].transactionCount += 1;
              }
            }
          });

          // Calculate average delay per user
          Object.keys(delayMetrics).forEach(user => {
            const userMetric = delayMetrics[user];
            userMetric.avgDelay = userMetric.totalDelay / userMetric.transactionCount;
            delete userMetric.totalDelay;
            delete userMetric.transactionCount;
          });

          setStats({
            incomingMoney,
            outgoingMoney,
            transactionTypes,
            statusDistribution,
            dailyVolume,
            postedByDistribution,
            userStats,
            delayMetrics, // Update state with delay metrics
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [accessToken, dateRange]);

  console.log("Current Stats State:", stats); // Log current state

  // Prepare data for Transaction Type Pie Chart
  const pieChartData = Object.entries(stats.transactionTypes || {}).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value
  }));

  // Prepare data for Transaction Status Bar Chart
  const statusChartData = Object.entries(stats.statusDistribution || {}).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count: count
  }));

  // Prepare data for Daily Transaction Volume Area Chart (sorted by date)
  const dailyVolumeData = useMemo(() => {
    return Object.entries(stats.dailyVolume || {})
      .map(([date, value]) => ({ date, amount: value }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [stats.dailyVolume]);

  // Prepare data for Transactions by User Pie Chart
  const postedByChartData = Object.entries(stats.postedByDistribution || {}).map(([user, count]) => ({
    name: user,
    value: count
  }));

  // Prepare data for Each User's Incoming & Outgoing Money
  const allUsers = Object.keys(stats.userStats || {});
  const usersIncomingOutgoingData = allUsers.map(user => ({
    user,
    incomingMoney: stats.userStats[user].incomingMoney,
    outgoingMoney: stats.userStats[user].outgoingMoney
  }));

  // Prepare data for Delay Metrics Summary Cards
  const delayMetricsData = Object.entries(stats.delayMetrics || {}).map(([user, metrics]) => ({
    user,
    maxDelay: metrics.maxDelay.toFixed(2),
    minDelay: metrics.minDelay.toFixed(2),
    avgDelay: metrics.avgDelay.toFixed(2),
  }));

  // Prepare data for Average Delays Bar Chart
  const averageDelaysData = delayMetricsData.map(item => ({
    user: item.user,
    avgDelay: parseFloat(item.avgDelay),
  }));

  // Format currency for charts
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB'
    }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Global Date Range Filter */}
      <Paper className="p-4 mb-4">
        <Typography variant="h6" gutterBottom>
          Filter by Request Date
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="From"
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({
              ...prev,
              start: e.target.value
            }))}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({
              ...prev,
              end: e.target.value
            }))}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          {(dateRange.start || dateRange.end) && (
            <Button
              variant="outlined"
              onClick={() => setDateRange({ start: '', end: '' })}
              sx={{ height: '40px' }}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} md={6}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Paper className="p-4 bg-green-50">
              <Typography variant="h6" gutterBottom>
                Incoming Money
              </Typography>
              <Typography variant="h4" className="text-green-600">
                {formatCurrency(stats.incomingMoney)}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUpIcon color="primary" />
                <Typography variant="body2" ml={1}>
                  From Deposits & Transfers
                </Typography>
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={6}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Paper className="p-4 bg-red-50">
              <Typography variant="h6" gutterBottom>
                Outgoing Money
              </Typography>
              <Typography variant="h4" className="text-red-600">
                {formatCurrency(stats.outgoingMoney)}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingDownIcon color="error" />
                <Typography variant="body2" ml={1}>
                  From Withdrawals, Transfers & Other Bank Transfers
                </Typography>
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {/* Transaction Type Distribution */}
        <Grid item xs={12} md={6}>
          <Paper className="p-4">
            <Typography variant="h6" gutterBottom>
              Transaction Type Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}`, `${name}`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Transaction Status Distribution */}
        <Grid item xs={12} md={6}>
          <Paper className="p-4">
            <Typography variant="h6" gutterBottom>
              Transaction Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={statusChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Transactions by User Pie Chart */}
        <Grid item xs={12} md={6}>
          <Paper className="p-4">
            <Typography variant="h6" gutterBottom>
              Transactions by User
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={postedByChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {postedByChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-user-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}`, `${name}`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Each User's Incoming & Outgoing Money */}
        {allUsers.length > 0 && (
          <Grid item xs={12}>
            <Paper className="p-4">
              <Typography variant="h6" gutterBottom>
                Incoming & Outgoing Money by User
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={usersIncomingOutgoingData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 55 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="user" angle={-45} textAnchor="end" interval={0} />
                  <YAxis />
                  <Tooltip formatter={(value) => `${formatCurrency(value)}`} />
                  <Legend />
                  <Bar dataKey="incomingMoney" fill="#82ca9d" name="Incoming Money" />
                  <Bar dataKey="outgoingMoney" fill="#8884d8" name="Outgoing Money" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Transaction Posting Delays by User */}
        {delayMetricsData.length > 0 && (
          <Grid item xs={12}>
            <Paper className="p-4">
              <Typography variant="h6" gutterBottom>
                Transaction Posting Delays by User (Minutes)
              </Typography>
              <Grid container spacing={2}>
                {delayMetricsData.map(({ user, maxDelay, minDelay, avgDelay }) => (
                  <Grid item xs={12} sm={6} md={4} key={user}>
                    <Paper variant="outlined" className="p-2">
                      <Typography variant="subtitle1" gutterBottom>
                        {user}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Max Delay:</strong> {maxDelay} mins
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Min Delay:</strong> {minDelay} mins
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Avg Delay:</strong> {avgDelay} mins
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Average Delay Bar Chart */}
        {averageDelaysData.length > 0 && (
          <Grid item xs={12}>
            <Paper className="p-4">
              <Typography variant="h6" gutterBottom>
                Average Transaction Posting Delay by User (Minutes)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={averageDelaysData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="user" angle={-45} textAnchor="end" interval={0} />
                  <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `${value} mins`} />
                  <Legend />
                  <Bar dataKey="avgDelay" fill="#8884d8" name="Avg Delay (mins)" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </motion.div>
  );
};

export default StatisticsTab;
