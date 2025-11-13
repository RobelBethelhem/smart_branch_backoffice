import React, { useMemo, useState, useCallback } from 'react';
import { MaterialReactTable } from 'material-react-table';
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
  Tooltip,
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
import PreviewIcon from '@mui/icons-material/Preview';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import DetailPanel from './DetailPanel';
import { format } from 'date-fns';
import { utils, writeFile } from 'xlsx';
import { TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Import the existing StatisticsTab component
import StatisticsTab from './stat';

// Import the new BranchStat component
import BranchStat from './BranchStat';

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

// Add this function near the top with other utility functions
const calculateTransactionTotals = (transactions) => {
  return transactions.reduce((totals, transaction) => {
    const amount = parseFloat(transaction.amount_in_figures) || 0;
    const type = transaction.transactionType?.toLowerCase();
    const status = transaction.status?.toLowerCase();
    const beneficiaryBranch = transaction.beneficiary_branch;
    const branch = "103"; // Your branch code

    if (!isNaN(amount) && (type === 'Withdraw' || type === 'Deposit') && (status === 'assigned' || status === 'audited')) {
      // Withdrawals are always outgoing
      if (type === 'withdraw') {
        totals.outgoing += amount;
      }
      // For transfers, check if beneficiary branch matches current branch
      else if (type === 'transfer') {
        if (beneficiaryBranch === branch) {
          totals.incoming += amount;
        } else {
          totals.outgoing += amount;
        }
      }
    }

    return totals;
  }, { incoming: 0, outgoing: 0 });
};

function classifyTransactions(transactions) {
    return transactions.map(transaction => {
        let classification = 'unknown';

        if (transaction.request_type === 'Withdraw') {
            classification = 'outgoing';
        } else if (transaction.request_type === 'Deposit') {
            if (['assigned', 'authorized', 'audited'].includes(transaction.status)) {
                classification = 'ingoing';
            }
        }

        return {
            ...transaction,
            classification
        };
    });
}

// Main BranchRecord Component
const BranchRecord = () => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [entranceDirection, setEntranceDirection] = useState(1);
  const [rowSelection, setRowSelection] = useState({});
  const accessToken = useSelector((state) => state.user.accessToken);
  const [activeTab, setActiveTab] = useState(0); // 0: Transactions, 1: Statistics, 2: BranchStat

  const queryClient = new QueryClient();

  const { data: fetchData = [], isError, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/branch_transactions', {
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
      const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/transaction_audited', {
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

  const navigate = useNavigate();

  const handlePreviewClick = () => {
    const selectedRowId = Object.keys(rowSelection)[0];
    const selectedRow = fetchData.find(tx => tx._id === selectedRowId);
    if (selectedRow) {
      navigate('/admin/experiance', { 
        state: { 
          rowData: selectedRow 
        }
      });
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
        const branchCode = accountNumber?.substring(0, 3) || '';
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
  ], [handleOpenDetail, fetchData, navigate]);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button
          color="primary"
          onClick={handlePreviewClick}
          startIcon={<PreviewIcon />}
          variant="contained"
          disabled={Object.keys(rowSelection).length === 0}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 'bold',
          }}
        >
          Preview
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            color="primary"
            onClick={() => handleExport(tableInstance, 'xlsx')}
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
            onClick={() => handleExport(tableInstance, 'csv')}
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
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ '& .MuiTab-root': { fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', minWidth: 120 } }}
        >
          <Tab label="Transactions" />
          <Tab label="Statistics" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="BranchStat" />
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
            <MaterialReactTable
              columns={columns}
              data={fetchData}
              enableRowSelection
              getRowId={(row) => row._id}
              onRowSelectionChange={setRowSelection}
              state={{ rowSelection }}
              muiTableBodyRowProps={({ row }) => ({
                onClick: () => {
                  if (row.original.status === 'authorized') {
                    setRowSelection((prev) => ({
                      [row.id]: !prev[row.id],
                    }));
                  }
                },
                selected: rowSelection[row.id],
                style: {
                  cursor: row.original.status === 'authorized' ? 'pointer' : 'not-allowed',
                  backgroundColor: rowSelection[row.id] ? '#e0f7fa' : 'inherit',
                },
              })}
            />
          </motion.div>
        ) : activeTab === 1 ? (
          <motion.div
            key="stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StatisticsTab />
          </motion.div>
        ) : (
          <motion.div
            key="branchStat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <BranchStat />
          </motion.div>
        )}
      </AnimatePresence>

      <DetailPanel
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        data={selectedDetail || {}}
        entranceDirection={entranceDirection}
      />

      <Dialog
        open={isConfirmationOpen}
        onClose={handleConfirmationClose}
        aria-labelledby="confirmation-dialog-title"
      >
        <StyledDialogTitle id="confirmation-dialog-title">
          Confirm Audit
          <IconButton onClick={handleConfirmationClose}>
            <ErrorIcon />
          </IconButton>
        </StyledDialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to audit the selected transactions?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmationClose} color="secondary">
            Cancel
          </Button>
          <Button onClick={handlePostSelectedTransactions} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

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

const ExampleWithProviders = () => (
  <QueryClientProvider client={new QueryClient()}>
    <BranchRecord />
  </QueryClientProvider>
);

export default ExampleWithProviders;