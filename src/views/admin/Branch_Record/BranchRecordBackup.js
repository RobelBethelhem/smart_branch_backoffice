import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { 
  Box, 
  Tabs, 
  Tab, 
  Typography, 
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  styled,
  Chip,
  Paper,
  Grid,
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
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import DetailPanel from './DetailPanel';
import { format } from 'date-fns';
import { utils, writeFile } from 'xlsx';
import { 
  TextField,
  InputAdornment,
} from '@mui/material';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
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
  AreaChart, 
  Area
} from 'recharts';
import { API_BASE_URL } from 'src/config/api';

// Styled components for the dialog
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    padding: theme.spacing(2),
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.primary.main,
  color: 'white',
  borderRadius: '12px 12px 0 0',
}));

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

const getRequestTypeInfo = (type) => {
  switch (type?.toLowerCase()) {
    case 'deposit':
      return { color: '#3498db', icon: <LocalAtmIcon sx={{ fontSize: 20 }} />, label: 'Deposit' };
    case 'withdraw':
      return { color: '#e74c3c', icon: <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />, label: 'Withdraw' };
    case 'transfer':
      return { color: '#2ecc71', icon: <SwapHorizIcon sx={{ fontSize: 20 }} />, label: 'Transfer' };
    case 'other-bank-transfer':
      return { color: '#f39c12', icon: <AccountBalanceIcon sx={{ fontSize: 20 }} />, label: 'Other Bank Transfer' };
    default:
      return { color: '#95a5a6', icon: null, label: type };
  }
};

const getStatusInfo = (status) => {
  switch (status?.toLowerCase()) {
    case 'requested':
      return { color: '#f39c12', icon: <HourglassEmptyIcon sx={{ fontSize: 20 }} />, label: 'Requested' };
    case 'assigned_by_csr':
      return { color: '#3498db', icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Assigned by CSR' };
    case 'assigned':
      return { color: '#2ecc71', icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Assigned' };
    case 'posted':
      return { color: '#e74c3c', icon: <ErrorIcon sx={{ fontSize: 20 }} />, label: 'Posted' };
    case 'authorized':
      return { color: '#9b59b6', icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Authorized' };
    case 'audited':
      return { color: '#34495e', icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Audited' };
    case 'delayed':
      return { color: '#e67e22', icon: <HourglassEmptyIcon sx={{ fontSize: 20 }} />, label: 'Delayed' };
    default:
      return { color: '#95a5a6', icon: null, label: status };
  }
};

// Define COLORS for the charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#a4de6c', '#d0ed57'];

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
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/branch_transactions`, {
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

          // Apply Date Range Filter
          const filteredTransactions = data.data.transactions.filter(transaction => {
            if (!dateRange.start && !dateRange.end) return true;
            const transactionDate = new Date(transaction.request_date);
            if (dateRange.start && transactionDate < new Date(dateRange.start)) return false;
            if (dateRange.end && transactionDate > new Date(dateRange.end)) return false;
            return true;
          });

          filteredTransactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount_in_figures);
            const type = transaction.request_type?.toLowerCase();
            const accountNumber = transaction.account_number;
            const firstThreeDigits = accountNumber?.substring(0, 3) || '';
            const beneficiaryBranch = transaction.beneficiary_branch || '';
            const postedBy = transaction.posted_by || 'Unknown';

            if (!isNaN(amount)) {
              // Update type breakdown
              transactionTypes[type] = (transactionTypes[type] || 0) + 1;

              // Update status breakdown
              const status = transaction.status || 'unknown';
              statusDistribution[status] = (statusDistribution[status] || 0) + 1;

              // Update daily volume
              const date = format(new Date(transaction.request_date), 'yyyy-MM-dd');
              dailyVolume[date] = (dailyVolume[date] || 0) + amount;

              // Incoming Money Logic
              if (
                // Deposits where branch matches first 3 digits of account number
                (type === 'deposit' && branch === firstThreeDigits) ||
                // Transfers where first 3 digits don't match branch and beneficiary branch matches branch
                (type === 'transfer' && 
                 firstThreeDigits !== branch && 
                 beneficiaryBranch === branch)
              ) {
                incomingMoney += amount;
              }
              // Outgoing Money Logic
              else if (
                // Withdraws where branch matches first 3 digits of account number
                (type === 'withdraw' && branch === firstThreeDigits) ||
                // Transfers where first 3 digits match branch but beneficiary branch is different
                (type === 'transfer' && 
                 firstThreeDigits === branch && 
                 beneficiaryBranch !== branch) ||
                // All other-bank-transfers
                type === 'other-bank-transfer'
              ) {
                outgoingMoney += amount;
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

              // Update userStats
              if (
                // Deposits where branch matches first 3 digits of account number
                (type === 'deposit' && branch === firstThreeDigits) ||
                // Transfers where first 3 digits don't match branch and beneficiary branch matches branch
                (type === 'transfer' && 
                 firstThreeDigits !== branch && 
                 beneficiaryBranch === branch)
              ) {
                userStats[postedBy].incomingMoney += amount;
              }
              else if (
                // Withdraws where branch matches first 3 digits of account number
                (type === 'withdraw' && branch === firstThreeDigits) ||
                // Transfers where first 3 digits match branch but beneficiary branch is different
                (type === 'transfer' && 
                 firstThreeDigits === branch && 
                 beneficiaryBranch !== branch) ||
                // All other-bank-transfers
                type === 'other-bank-transfer'
              ) {
                userStats[postedBy].outgoingMoney += amount;
              }

              // Update user transaction types
              userStats[postedBy].transactionTypes[type] = (userStats[postedBy].transactionTypes[type] || 0) + 1;

              // Update user status distribution
              userStats[postedBy].statusDistribution[status] = (userStats[postedBy].statusDistribution[status] || 0) + 1;
            }
          });

          setStats({
            incomingMoney,
            outgoingMoney,
            transactionTypes,
            statusDistribution,
            dailyVolume,
            postedByDistribution,
            userStats,
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
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="incomingMoney" fill="#82ca9d" name="Incoming Money" />
                  <Bar dataKey="outgoingMoney" fill="#8884d8" name="Outgoing Money" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Daily Transaction Volume */}
        <Grid item xs={12}>
          <Paper className="p-4">
            <Typography variant="h6" gutterBottom>
              Daily Transaction Volume
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={dailyVolumeData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MM/dd')} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label) => `Date: ${label}`} />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#8884d8" 
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </motion.div>
  );
};

const Example = () => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [entranceDirection, setEntranceDirection] = useState(1);
  const [rowSelection, setRowSelection] = useState({});
  const accessToken = useSelector((state) => state.user.accessToken);
  const [activeTab, setActiveTab] = useState(0);

  const { data: fetchData = [], isError, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/branch_transactions`, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await response.json();
      return json.data.transactions;
    },
  });

  const handleOpenDetail = useCallback((data) => {
    const randomDirection = Math.floor(Math.random() * 2) + 1;
    setEntranceDirection(randomDirection);
    setSelectedDetail(data);
  }, []);

  const handleConfirmationOpen = () => setIsConfirmationOpen(true);
  const handleConfirmationClose = () => setIsConfirmationOpen(false);

  const handlePostSelectedTransactions = async () => {
    handleConfirmationClose();

    const selectedTransactions = Object.keys(rowSelection).map(index => {
      const row = fetchData[parseInt(index)];
      return {
        id: row._id,
        transactionType: row.transactionType
      };
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/transaction_audited`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({ transactions: selectedTransactions }),
      });

      if (response.ok) {
        toast.success('Transactions audited successfully!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        
        setRowSelection({});
        queryClient.invalidateQueries(['transactions']);
      } else {
        throw new Error('Failed to audit transactions');
      }
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    }
  };

  const [requestDateRange, setRequestDateRange] = useState({ start: '', end: '' });
  const [postedDateRange, setPostedDateRange] = useState({ start: '', end: '' });
  const [amountFilter, setAmountFilter] = useState({ min: '', max: '' });

  const handleExport = (table, type = 'xlsx') => {
    const filteredRows = table.getFilteredRowModel().rows;
    
    const exportData = filteredRows.map(row => ({
      'Transaction Type': row.original.transactionType,
      'Account Number': row.original.account_number,
      'Account Holder': row.original.acc_holder_name,
      'Amount': formatAmount(row.original.amount_in_figures),
      'Request Date': formatDateTime(row.original.request_date),
      'Posted Date': formatDateTime(row.original.posted_date),
      'Status': row.original.status,
      'Posted By': row.original.posted_by, // Added Posted By to export
    }));

    if (type === 'xlsx') {
      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Transactions');
      writeFile(wb, `Transactions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } else if (type === 'csv') {
      const ws = utils.json_to_sheet(exportData);
      const csv = utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'transactionType',
      header: 'Transaction Type',
      Cell: ({ cell, row }) => {
        const typeInfo = getRequestTypeInfo(cell.getValue());
        return (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: typeInfo.color,
              padding: '8px 16px',
              borderRadius: '20px',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => handleOpenDetail(row.original)}
          >
            {typeInfo.icon}
            {typeInfo.label}
          </motion.div>
        );
      },
      GroupedCell: ({ cell, row }) => {
        const typeInfo = getRequestTypeInfo(cell.getValue());
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {typeInfo.icon}
            <span style={{ color: typeInfo.color, fontWeight: 'bold' }}>
              {typeInfo.label}
            </span>
          </Box>
        );
      },
    },
    { 
      accessorKey: 'account_number', 
      header: 'Account Number',
      enableGrouping: false,
    },
    { 
      accessorKey: 'acc_holder_name', 
      header: 'Account Holder Name',
      enableGrouping: false,
    },
    {
      accessorKey: 'amount_in_figures',
      header: 'Amount',
      Cell: ({ cell, row }) => {
        const amount = cell.getValue();
        const type = row.original.transactionType?.toLowerCase();
        const accountNumber = row.original.account_number;
        const branchCode = accountNumber?.substring(0, 3);
        const currentBranchCode = "001"; // Replace with actual branch code

        let color = '#000';
        let icon = null;

        switch(type) {
          case 'deposit':
            color = '#2196f3'; // Blue
            icon = <TrendingUpIcon sx={{ fontSize: 16 }} />;
            break;
          case 'withdraw':
            color = '#f44336'; // Red
            icon = <TrendingDownIcon sx={{ fontSize: 16 }} />;
            break;
          case 'other-bank-transfer':
            color = '#d32f2f'; // Dark red
            icon = <TrendingDownIcon sx={{ fontSize: 16 }} />;
            break;
          case 'transfer':
            if (branchCode === currentBranchCode) {
              color = '#4caf50'; // Green
            } else {
              color = '#ff9800'; // Orange
            }
            icon = <SwapHorizIcon sx={{ fontSize: 16 }} />;
            break;
          default:
            color = '#95a5a6'; // Gray for unknown types
            icon = null;
        }

        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: color,
              fontWeight: 'bold',
            }}
          >
            {icon}
            {formatAmount(amount)}
          </Box>
        );
      },
      Filter: ({ column }) => (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1, 
            p: '0.5rem', 
            minWidth: '200px' 
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            Filter Amount Range
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="Min"
              type="number"
              value={column.getFilterValue()?.min || ''}
              onChange={(e) => {
                const value = e.target.value;
                column.setFilterValue(prev => ({
                  ...prev,
                  min: value ? Number(value) : undefined
                }));
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: '100px' }}
              inputProps={{
                min: 0,
                step: 'any'
              }}
              helperText="≥"
            />
            <TextField
              label="Max"
              type="number"
              value={column.getFilterValue()?.max || ''}
              onChange={(e) => {
                const value = e.target.value;
                column.setFilterValue(prev => ({
                  ...prev,
                  max: value ? Number(value) : undefined
                }));
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: '100px' }}
              inputProps={{
                min: 0,
                step: 'any'
              }}
              helperText="≤"
            />
          </Box>
          {(column.getFilterValue()?.min || column.getFilterValue()?.max) && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => column.setFilterValue(undefined)}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              Clear Filter
            </Button>
          )}
        </Box>
      ),
      filterFn: (row, columnId, filterValue) => {
        const amount = Number(row.getValue(columnId));
        const min = filterValue?.min;
        const max = filterValue?.max;

        if (min !== undefined && max !== undefined) {
          return amount >= min && amount <= max;
        }
        if (min !== undefined) {
          return amount >= min;
        }
        if (max !== undefined) {
          return amount <= max;
        }
        return true;
      },
      enableGrouping: false,
      AggregatedCell: ({ row }) => {
        const subRows = row.getLeafRows();
        const total = subRows.reduce(
          (sum, row) => sum + Number(row.original.amount_in_figures || 0),
          0
        );
        
        return (
          <Box 
            sx={{ 
              fontWeight: 'bold',
              color: '#1976d2',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <span>Total:</span>
            <span>{formatAmount(total)}</span>
          </Box>
        );
      },
    },
    {
      accessorKey: 'request_date',
      header: 'Request Date',
      Cell: ({ cell }) => formatDateTime(cell.getValue()),
      Filter: ({ column }) => (
        <Box sx={{ display: 'flex', gap: 1, p: '0.5rem', alignItems: 'center' }}>
          <TextField
            label="From"
            type="date"
            value={column.getFilterValue()?.start ? format(new Date(column.getFilterValue().start), 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const value = e.target.value;
              column.setFilterValue(prev => ({
                ...prev,
                start: value ? e.target.value : undefined
              }));
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            value={column.getFilterValue()?.end ? format(new Date(column.getFilterValue().end), 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const value = e.target.value;
              column.setFilterValue(prev => ({
                ...prev,
                end: value ? e.target.value : undefined
              }));
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      ),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue?.start && !filterValue?.end) return true;
        const rowDate = new Date(row.getValue(columnId));
        if (filterValue.start && rowDate < new Date(filterValue.start)) return false;
        if (filterValue.end && rowDate > new Date(filterValue.end)) return false;
        return true;
      },
      GroupedCell: ({ cell }) => {
        return format(new Date(cell.getValue()), 'MMM dd, yyyy');
      },
    },
    {
      accessorKey: 'posted_date',
      header: 'Posted Date',
      Cell: ({ cell }) => formatDateTime(cell.getValue()),
      Filter: ({ column }) => (
        <Box sx={{ display: 'flex', gap: 1, p: '0.5rem', alignItems: 'center' }}>
          <TextField
            label="From"
            type="date"
            value={column.getFilterValue()?.start ? format(new Date(column.getFilterValue().start), 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const value = e.target.value;
              column.setFilterValue(prev => ({
                ...prev,
                start: value ? e.target.value : undefined
              }));
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            value={column.getFilterValue()?.end ? format(new Date(column.getFilterValue().end), 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const value = e.target.value;
              column.setFilterValue(prev => ({
                ...prev,
                end: value ? e.target.value : undefined
              }));
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      ),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue?.start && !filterValue?.end) return true;
        const rowDate = new Date(row.getValue(columnId));
        if (filterValue.start && rowDate < new Date(filterValue.start)) return false;
        if (filterValue.end && rowDate > new Date(filterValue.end)) return false;
        return true;
      },
      GroupedCell: ({ cell }) => {
        return cell.getValue() 
          ? format(new Date(cell.getValue()), 'MMM dd, yyyy')
          : 'Not Posted';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      Cell: ({ cell }) => {
        const statusInfo = getStatusInfo(cell.getValue());
        return (
          <div
            style={{
              backgroundColor: statusInfo.color,
              borderRadius: '20px',
              padding: '6px 12px',
              width: 'fit-content',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </div>
        );
      },
      GroupedCell: ({ cell }) => {
        const statusInfo = getStatusInfo(cell.getValue());
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {statusInfo.icon}
            <span style={{ color: statusInfo.color, fontWeight: 'bold' }}>
              {statusInfo.label}
            </span>
          </Box>
        );
      },
    },
    {
      accessorKey: 'posted_by',
      header: 'Posted By',
      Cell: ({ cell }) => {
        const user = cell.getValue();
        return (
          <Typography variant="body2" sx={{ fontWeight: '500' }}>
            {user}
          </Typography>
        );
      },
      GroupedCell: ({ cell }) => {
        const user = cell.getValue();
        return (
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            {user}
          </Typography>
        );
      },
      Filter: ({ column }) => {
        const uniqueUsers = useMemo(() => {
          const usersSet = new Set();
          fetchData.forEach(row => {
            if (row.posted_by) usersSet.add(row.posted_by);
          });
          return Array.from(usersSet);
        }, [fetchData]);

        return (
          <TextField
            select
            SelectProps={{ native: true }}
            label="Posted By"
            value={column.getFilterValue() || ''}
            onChange={(e) => {
              const value = e.target.value;
              column.setFilterValue(value || undefined);
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
            fullWidth
          >
            <option value="">All</option>
            {uniqueUsers.map((user) => (
              <option key={user} value={user}>{user}</option>
            ))}
          </TextField>
        );
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        return row.getValue(columnId) === filterValue;
      },
    },
  ], [handleOpenDetail, fetchData]);

  const tableInstance = useMaterialReactTable({
    columns,
    data: fetchData,
    enableRowSelection: (row) => row.original.status === 'authorized',
    enableFiltering: true,
    initialState: { showColumnFilters: true },
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        if (row.original.status === 'authorized') {
          setRowSelection((prev) => ({
            ...prev,
            [row.index]: !prev[row.index],
          }));
        }
      },
      selected: rowSelection[row.index],
      style: {
        cursor: row.original.status === 'authorized' ? 'pointer' : 'not-allowed',
        backgroundColor: rowSelection[row.index] ? '#e0f7fa' : 'inherit',
      },
    }),
    state: { 
      isLoading, 
      showAlertBanner: isError,
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    positionToolbarAlertBanner: 'bottom',
    renderTopToolbarCustomActions: ({ table }) => (
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          color="primary"
          onClick={() => handleExport(table, 'xlsx')}
          startIcon={<DownloadIcon />}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 'bold',
          }}
        >
          Export XLSX
        </Button>
        <Button
          color="primary"
          onClick={() => handleExport(table, 'csv')}
          startIcon={<DownloadIcon />}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 'bold',
          }}
        >
          Export CSV
        </Button>
      </Box>
    ),
    enableGrouping: true,
    enableColumnDragging: false,
    initialState: { 
      showColumnFilters: true,
      grouping: ['transactionType'],
      pagination: { pageSize: 20 },
      density: 'compact',
    },
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
      },
    },
    renderToolbarInternalActions: ({ table }) => (
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {table.getState().grouping.map((columnId) => {
            const column = table.getColumn(columnId);
            return (
              <Chip
                key={columnId}
                label={`${column.columnDef.header}: ${column.getFilterValue() || 'All'}`}
                onDelete={() => column.toggleGrouping()}
                sx={{ 
                  backgroundColor: '#f5f5f5',
                  '& .MuiChip-deleteIcon': {
                    color: '#666',
                    '&:hover': {
                      color: '#333',
                    },
                  },
                }}
              />
            );
          })}
        </Box>
        <Button
          color="primary"
          onClick={() => handleExport(table, 'xlsx')}
          startIcon={<DownloadIcon />}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 'bold',
          }}
        >
          Export XLSX
        </Button>
        <Button
          color="primary"
          onClick={() => handleExport(table, 'csv')}
          startIcon={<DownloadIcon />}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 'bold',
          }}
        >
          Export CSV
        </Button>
      </Box>
    ),
    renderDetailPanel: ({ row }) => {
      if (row.getIsGrouped()) {
        const subRows = row.getLeafRows();
        const total = subRows.reduce(
          (sum, row) => sum + Number(row.original.amount_in_figures || 0),
          0
        );
        const count = subRows.length;
        
        return (
          <Box 
            sx={{ 
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              margin: '8px'
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666' }}>
              Group Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, mt: 1 }}>
              <Typography>
                Total Transactions: {count}
              </Typography>
              <Typography sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                Total Amount: {formatAmount(total)}
              </Typography>
            </Box>
          </Box>
        );
      }
      return null;
    },
    renderBottomToolbarCustomActions: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const grandTotal = rows.reduce(
        (sum, row) => {
          if (!row.getIsGrouped()) {
            return sum + Number(row.original.amount_in_figures || 0);
          }
          return sum;
        },
        0
      );
      
      return (
        <Box 
          sx={{ 
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontWeight: 'bold'
          }}
        >
          <Typography variant="subtitle1">
            Grand Total:
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: '#1976d2',
              fontWeight: 'bold'
            }}
          >
            {formatAmount(grandTotal)}
          </Typography>
        </Box>
      );
    },
  });

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ '& .MuiTab-root': { fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', minWidth: 120 } }}
        >
          <Tab label="Transactions" />
          <Tab label="Statistics" icon={<AnalyticsIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <AnimatePresence mode="wait">
        {activeTab === 0 ? (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MaterialReactTable table={tableInstance} />
          </motion.div>
        ) : (
          <StatisticsTab key="stats" />
        )}
      </AnimatePresence>

      <DetailPanel
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        data={selectedDetail || {}}
        entranceDirection={entranceDirection}
      />

      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="colored" 
      />
    </>
  );
};

const queryClient = new QueryClient();

const ExampleWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <Example />
  </QueryClientProvider>
);

export default ExampleWithProviders;
