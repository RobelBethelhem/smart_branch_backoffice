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
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import { QueryClient, QueryClientProvider, useQuery, keepPreviousData } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import DetailPanel from './DetailPanel';
import { format } from 'date-fns';
import { utils, writeFile } from 'xlsx';

import StatisticsTab from './stat';
import BranchStat from './BranchStat';
import { ReceiptPreviewDialog } from './TransactionReceipt';
import { API_BASE_URL } from 'src/config/api';

// Create QueryClient OUTSIDE component to prevent recreation on every render.
// Aggressive caching so navigating away and back is instant (no spinner, no
// refetch) even when the backend returns a large transaction set.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes – data considered fresh, no refetch
      gcTime: 30 * 60 * 1000, // keep cached data for 30 min after unmount
      refetchOnWindowFocus: false,
      refetchOnMount: false, // reuse cache on remount instead of refetching
      placeholderData: keepPreviousData, // show last data instantly while refetching
      retry: 1,
    },
  },
});

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
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return format(date, "EEE MMM d, yyyy: hh:mm a");
  } catch {
    return dateString || '—';
  }
};

const formatAmount = (amount) => {
  const num = Number(amount);
  return isNaN(num) ? '0' : num.toLocaleString('en-US');
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
      return { color: '#95a5a6', icon: null, label: type || 'Unknown' };
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
      return { color: '#95a5a6', icon: null, label: status || 'Unknown' };
  }
};

// Main BranchRecord Component
const BranchRecord = () => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [entranceDirection, setEntranceDirection] = useState(1);
  const [rowSelection, setRowSelection] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptTransactions, setReceiptTransactions] = useState([]);
  const accessToken = useSelector((state) => state.user.accessToken);

  // Single data fetch shared across all tabs
  const { data: fetchData = [], isError, isLoading, refetch } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/branch_transactions`, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await response.json();
      if (json.error) throw new Error(json.message || 'Failed to fetch transactions');
      return json.data;
    },
    enabled: !!accessToken,
  });

  const transactions = useMemo(() => fetchData?.transactions || [], [fetchData]);
  const branchCode = fetchData?.branch || '';

  const handleOpenDetail = useCallback((data) => {
    setEntranceDirection(Math.random() > 0.5 ? 1 : 2);
    setSelectedDetail(data);
  }, []);

  const handleConfirmationOpen = () => setIsConfirmationOpen(true);
  const handleConfirmationClose = () => setIsConfirmationOpen(false);

  const handlePostSelectedTransactions = async () => {
    handleConfirmationClose();

    const selectedTransactions = Object.keys(rowSelection).map(id => {
      const row = transactions.find(t => t._id === id);
      return { id: row._id, transactionType: row.transactionType };
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/transaction_audited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
        body: JSON.stringify({ transactions: selectedTransactions }),
      });

      if (response.ok) {
        toast.success('Transactions audited successfully!', { position: "top-right", autoClose: 3000, theme: "colored" });
        setRowSelection({});
        refetch();
      } else {
        throw new Error('Failed to audit transactions');
      }
    } catch (error) {
      toast.error(error.message, { position: "top-right", autoClose: 3000, theme: "colored" });
    }
  };

  const handleExport = useCallback((type = 'xlsx') => {
    const exportData = transactions.map(row => ({
      'Transaction Type': row.transactionType,
      'Account Number': row.account_number,
      'Account Holder': row.acc_holder_name,
      'Amount': formatAmount(row.amount_in_figures),
      'Request Date': formatDateTime(row.request_date),
      'Posted Date': formatDateTime(row.posted_date),
      'Status': row.status,
      'Posted By': row.posted_by,
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
  }, [transactions]);

  const handlePreviewClick = useCallback(() => {
    const selectedIds = Object.keys(rowSelection);
    // Preserve table order for the selected rows
    const selected = transactions.filter((tx) => selectedIds.includes(tx._id));
    if (selected.length > 0) {
      setReceiptTransactions(selected);
      setIsReceiptOpen(true);
    }
  }, [rowSelection, transactions]);

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
      GroupedCell: ({ cell }) => {
        const typeInfo = getRequestTypeInfo(cell.getValue());
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {typeInfo.icon}
            <span style={{ color: typeInfo.color, fontWeight: 'bold' }}>{typeInfo.label}</span>
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
        let color = '#000';
        let icon = null;

        switch(type) {
          case 'deposit':
            color = '#2196f3';
            icon = <TrendingUpIcon sx={{ fontSize: 16 }} />;
            break;
          case 'withdraw':
            color = '#f44336';
            icon = <TrendingDownIcon sx={{ fontSize: 16 }} />;
            break;
          case 'other-bank-transfer':
            color = '#d32f2f';
            icon = <TrendingDownIcon sx={{ fontSize: 16 }} />;
            break;
          case 'transfer':
            color = '#ff9800';
            icon = <SwapHorizIcon sx={{ fontSize: 16 }} />;
            break;
          default:
            color = '#95a5a6';
        }

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color, fontWeight: 'bold' }}>
            {icon}
            {formatAmount(amount)}
          </Box>
        );
      },
      Filter: ({ column }) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: '0.5rem', minWidth: '200px' }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Filter Amount Range</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="Min"
              type="number"
              value={column.getFilterValue()?.min || ''}
              onChange={(e) => column.setFilterValue(prev => ({ ...prev, min: e.target.value ? Number(e.target.value) : undefined }))}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: '100px' }}
              inputProps={{ min: 0, step: 'any' }}
              helperText="≥"
            />
            <TextField
              label="Max"
              type="number"
              value={column.getFilterValue()?.max || ''}
              onChange={(e) => column.setFilterValue(prev => ({ ...prev, max: e.target.value ? Number(e.target.value) : undefined }))}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: '100px' }}
              inputProps={{ min: 0, step: 'any' }}
              helperText="≤"
            />
          </Box>
          {(column.getFilterValue()?.min || column.getFilterValue()?.max) && (
            <Button size="small" variant="outlined" onClick={() => column.setFilterValue(undefined)} sx={{ alignSelf: 'flex-start', mt: 1 }}>
              Clear Filter
            </Button>
          )}
        </Box>
      ),
      filterFn: (row, columnId, filterValue) => {
        const amount = Number(row.getValue(columnId));
        if (filterValue?.min !== undefined && amount < filterValue.min) return false;
        if (filterValue?.max !== undefined && amount > filterValue.max) return false;
        return true;
      },
      enableGrouping: false,
      AggregatedCell: ({ row }) => {
        const total = row.getLeafRows().reduce((sum, r) => sum + Number(r.original.amount_in_figures || 0), 0);
        return (
          <Box sx={{ fontWeight: 'bold', color: '#1976d2', display: 'flex', alignItems: 'center', gap: 1 }}>
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
            label="From" type="date"
            value={column.getFilterValue()?.start || ''}
            onChange={(e) => column.setFilterValue(prev => ({ ...prev, start: e.target.value || undefined }))}
            size="small" InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To" type="date"
            value={column.getFilterValue()?.end || ''}
            onChange={(e) => column.setFilterValue(prev => ({ ...prev, end: e.target.value || undefined }))}
            size="small" InputLabelProps={{ shrink: true }}
          />
        </Box>
      ),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue?.start && !filterValue?.end) return true;
        const rowDate = new Date(row.getValue(columnId));
        if (filterValue.start && rowDate < new Date(filterValue.start)) return false;
        if (filterValue.end && rowDate > new Date(filterValue.end + 'T23:59:59')) return false;
        return true;
      },
      GroupedCell: ({ cell }) => format(new Date(cell.getValue()), 'MMM dd, yyyy'),
    },
    {
      accessorKey: 'posted_date',
      header: 'Posted Date',
      Cell: ({ cell }) => formatDateTime(cell.getValue()),
      Filter: ({ column }) => (
        <Box sx={{ display: 'flex', gap: 1, p: '0.5rem', alignItems: 'center' }}>
          <TextField
            label="From" type="date"
            value={column.getFilterValue()?.start || ''}
            onChange={(e) => column.setFilterValue(prev => ({ ...prev, start: e.target.value || undefined }))}
            size="small" InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To" type="date"
            value={column.getFilterValue()?.end || ''}
            onChange={(e) => column.setFilterValue(prev => ({ ...prev, end: e.target.value || undefined }))}
            size="small" InputLabelProps={{ shrink: true }}
          />
        </Box>
      ),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue?.start && !filterValue?.end) return true;
        const val = row.getValue(columnId);
        if (!val) return false;
        const rowDate = new Date(val);
        if (filterValue.start && rowDate < new Date(filterValue.start)) return false;
        if (filterValue.end && rowDate > new Date(filterValue.end + 'T23:59:59')) return false;
        return true;
      },
      GroupedCell: ({ cell }) => cell.getValue() ? format(new Date(cell.getValue()), 'MMM dd, yyyy') : 'Not Posted',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      Cell: ({ cell }) => {
        const statusInfo = getStatusInfo(cell.getValue());
        return (
          <div style={{
            backgroundColor: statusInfo.color, borderRadius: '20px', padding: '6px 12px',
            width: 'fit-content', textTransform: 'uppercase', fontSize: '0.75rem',
            fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
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
            <span style={{ color: statusInfo.color, fontWeight: 'bold' }}>{statusInfo.label}</span>
          </Box>
        );
      },
    },
    {
      accessorKey: 'posted_by',
      header: 'Posted By',
      Cell: ({ cell }) => <Typography variant="body2" sx={{ fontWeight: '500' }}>{cell.getValue() || '—'}</Typography>,
      GroupedCell: ({ cell }) => <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>{cell.getValue()}</Typography>,
      Filter: ({ column }) => {
        const uniqueUsers = useMemo(() => {
          const usersSet = new Set();
          transactions.forEach(row => { if (row.posted_by) usersSet.add(row.posted_by); });
          return Array.from(usersSet).sort();
        }, []);

        return (
          <TextField
            select SelectProps={{ native: true }}
            label="Posted By"
            value={column.getFilterValue() || ''}
            onChange={(e) => column.setFilterValue(e.target.value || undefined)}
            size="small" InputLabelProps={{ shrink: true }} fullWidth
          >
            <option value="">All</option>
            {uniqueUsers.map((user) => <option key={user} value={user}>{user}</option>)}
          </TextField>
        );
      },
      filterFn: (row, columnId, filterValue) => !filterValue || row.getValue(columnId) === filterValue,
    },
  ], [handleOpenDetail, transactions]);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Button
          color="primary"
          onClick={handlePreviewClick}
          startIcon={<PreviewIcon />}
          variant="contained"
          disabled={Object.keys(rowSelection).length === 0}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          {Object.keys(rowSelection).length > 1
            ? `Preview & Print (${Object.keys(rowSelection).length})`
            : 'Preview & Print'}
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            color="primary"
            onClick={() => handleExport('xlsx')}
            startIcon={<DownloadIcon />}
            variant="outlined"
            size="small"
            disabled={transactions.length === 0}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
          >
            Export XLSX
          </Button>
          <Button
            color="primary"
            onClick={() => handleExport('csv')}
            startIcon={<DownloadIcon />}
            variant="outlined"
            size="small"
            disabled={transactions.length === 0}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
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
          <Tab label="Branch Stats" icon={<AssessmentIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <AnimatePresence mode="wait">
        {activeTab === 0 && (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MaterialReactTable
              columns={columns}
              data={transactions}
              enableRowSelection
              getRowId={(row) => row._id}
              onRowSelectionChange={setRowSelection}
              state={{ rowSelection, isLoading }}
              enableGrouping
              // --- Performance: keep the grid fast even with large datasets ---
              enablePagination
              enableStickyHeader
              initialState={{
                density: 'compact',
                pagination: { pageIndex: 0, pageSize: 25 },
              }}
              muiPaginationProps={{ rowsPerPageOptions: [25, 50, 100, 250] }}
              muiTableContainerProps={{ sx: { maxHeight: '65vh' } }}
              muiTableBodyRowProps={({ row }) => ({
                onClick: () => {
                  const status = row.original.status;
                  if (status === 'authorized' || status === 'posted') {
                    // Toggle-accumulate so multiple rows can be selected for
                    // multi-receipt preview/print and bulk audit.
                    setRowSelection((prev) => ({ ...prev, [row.id]: !prev[row.id] }));
                  }
                },
                selected: rowSelection[row.id],
                style: {
                  cursor: (row.original.status === 'authorized' || row.original.status === 'posted') ? 'pointer' : 'not-allowed',
                  backgroundColor: rowSelection[row.id] ? '#e0f7fa' : 'inherit',
                },
              })}
              renderTopToolbarCustomActions={() => (
                Object.keys(rowSelection).length > 0 ? (
                  <Button
                    color="success"
                    onClick={handleConfirmationOpen}
                    variant="contained"
                    size="small"
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Audit Selected ({Object.keys(rowSelection).length})
                  </Button>
                ) : null
              )}
            />
          </motion.div>
        )}
        {activeTab === 1 && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StatisticsTab transactions={transactions} branchCode={branchCode} isLoading={isLoading} />
          </motion.div>
        )}
        {activeTab === 2 && (
          <motion.div key="branchStat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BranchStat transactions={transactions} branchCode={branchCode} isLoading={isLoading} />
          </motion.div>
        )}
      </AnimatePresence>

      <DetailPanel
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        data={selectedDetail || {}}
        entranceDirection={entranceDirection}
      />

      <ReceiptPreviewDialog
        open={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transactions={receiptTransactions}
        branchCode={branchCode}
      />

      <StyledDialog open={isConfirmationOpen} onClose={handleConfirmationClose}>
        <StyledDialogTitle>
          Confirm Audit
          <IconButton onClick={handleConfirmationClose} sx={{ color: 'white' }}>
            <ErrorIcon />
          </IconButton>
        </StyledDialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>Are you sure you want to audit {Object.keys(rowSelection).length} selected transaction(s)?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmationClose} color="secondary">Cancel</Button>
          <Button onClick={handlePostSelectedTransactions} color="primary" variant="contained">Confirm</Button>
        </DialogActions>
      </StyledDialog>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} theme="colored" />
    </>
  );
};

const ExampleWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <BranchRecord />
  </QueryClientProvider>
);

export default ExampleWithProviders;
