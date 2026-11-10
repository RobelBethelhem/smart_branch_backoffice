import React, { useState, useMemo, useEffect } from 'react';
import { MaterialReactTable } from 'material-react-table';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Autocomplete, Chip,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { QueryClient, QueryClientProvider, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import { API_BASE_URL } from 'src/config/api';
import StatisticsTab from './stat';
import BranchStat from './BranchStat';
import { typeLabel, statusLabel } from './recordFormat';

// ===========================================================================
// Branches Record — a supervisory, cross-branch view for the Branch_Management
// role. Pick a branch code (searchable) + an optional date range, and see that
// branch's Transactions, Statistics and Branch Stats. The Admin's single-branch
// "Branch Record" view is untouched; these reuse the same server-side endpoints
// (branch_transactions + branch_transactions_stats) with a ?branch= filter.
// ===========================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      retry: 1,
    },
  },
});

const formatDateTime = (v) => {
  try {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : format(d, 'EEE MMM d, yyyy: hh:mm a');
  } catch {
    return v || '—';
  }
};
const formatAmount = (a) => {
  const n = Number(a);
  return isNaN(n) ? '0' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BranchesRecordInner = () => {
  const accessToken = useSelector((s) => s.user.accessToken);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState(0);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  // Jump back to the first page when the branch or date range changes.
  useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [selectedBranch, dateRange]);

  // Branch list (auto from the database).
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/branches`, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message || 'Failed to load branches');
      return json.data || [];
    },
    enabled: !!accessToken,
  });

  // Transactions table (server-paginated, filtered by branch + date).
  const { data: tableData = {}, isError, isLoading, isRefetching } = useQuery({
    queryKey: ['branches-record-transactions', selectedBranch, dateRange, pagination],
    queryFn: async () => {
      const url = new URL(`${API_BASE_URL}/api/zsmart_branch_requests/branch_transactions`, window.location.origin);
      url.searchParams.set('branch', selectedBranch);
      url.searchParams.set('start', `${pagination.pageIndex * pagination.pageSize}`);
      url.searchParams.set('size', `${pagination.pageSize}`);
      if (dateRange.start) url.searchParams.set('from', dateRange.start);
      if (dateRange.end) url.searchParams.set('to', dateRange.end);
      const res = await fetch(url.href, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.message || 'Failed to load transactions');
      return json;
    },
    enabled: !!accessToken && !!selectedBranch,
  });

  const transactions = useMemo(() => tableData?.data?.transactions || [], [tableData]);
  const totalRowCount = tableData?.meta?.totalRowCount ?? 0;

  const columns = useMemo(() => [
    { accessorKey: 'transactionType', header: 'Type', Cell: ({ cell }) => typeLabel(cell.getValue()) },
    { accessorKey: 'account_number', header: 'Account Number' },
    { accessorKey: 'acc_holder_name', header: 'Account Holder' },
    { accessorKey: 'amount_in_figures', header: 'Amount', Cell: ({ cell }) => formatAmount(cell.getValue()) },
    { accessorKey: 'status', header: 'Status', Cell: ({ cell }) => <Chip size="small" label={cell.getValue() ? statusLabel(cell.getValue()) : '—'} /> },
    { accessorKey: 'posted_by', header: 'Posted By' },
    { accessorKey: 'request_date', header: 'Request Date', Cell: ({ cell }) => formatDateTime(cell.getValue()) },
  ], []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Branches Record</Typography>

      {/* Branch + date selectors */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={branches}
          value={selectedBranch}
          onChange={(e, v) => setSelectedBranch(v)}
          getOptionLabel={(o) => String(o)}
          isOptionEqualToValue={(o, v) => String(o) === String(v)}
          renderInput={(params) => <TextField {...params} label="Branch" placeholder="Search branch code" />}
        />
        <TextField
          label="From" type="date" size="small" InputLabelProps={{ shrink: true }}
          value={dateRange.start} onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
        />
        <TextField
          label="To" type="date" size="small" InputLabelProps={{ shrink: true }}
          value={dateRange.end} onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
        />
        {selectedBranch && (
          <Typography variant="body2" sx={{ ml: 'auto', color: 'text.secondary' }}>
            Branch <strong>{selectedBranch}</strong>
            {(dateRange.start || dateRange.end) ? ` · ${dateRange.start || '…'} → ${dateRange.end || '…'}` : ''}
          </Typography>
        )}
      </Paper>

      {!selectedBranch ? (
        <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', borderRadius: 3 }}>
          <Typography>Select a branch above to view its transactions, statistics and branch stats.</Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ '& .MuiTab-root': { fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', minWidth: 120 } }}
            >
              <Tab label="Transactions" />
              <Tab label="Statistics" icon={<AnalyticsIcon />} iconPosition="start" />
              <Tab label="Branch Stats" icon={<AssessmentIcon />} iconPosition="start" />
            </Tabs>
          </Box>

          {activeTab === 0 && (
            <MaterialReactTable
              columns={columns}
              data={transactions}
              getRowId={(row) => row._id}
              manualPagination
              rowCount={totalRowCount}
              onPaginationChange={setPagination}
              state={{ isLoading, showProgressBars: isRefetching, showAlertBanner: isError, pagination }}
              muiToolbarAlertBannerProps={isError ? { color: 'error', children: 'Error loading transactions' } : undefined}
              enableStickyHeader
              initialState={{ density: 'compact' }}
              muiTableContainerProps={{ sx: { maxHeight: '65vh' } }}
              muiPaginationProps={{ rowsPerPageOptions: [25, 50, 100, 250] }}
            />
          )}
          {activeTab === 1 && (
            <StatisticsTab accessToken={accessToken} branch={selectedBranch} dateRange={dateRange} hideDateFilter />
          )}
          {activeTab === 2 && (
            <BranchStat accessToken={accessToken} branch={selectedBranch} dateRange={dateRange} hideDateFilter />
          )}
        </>
      )}
    </Box>
  );
};

const BranchesRecord = () => (
  <QueryClientProvider client={queryClient}>
    <BranchesRecordInner />
  </QueryClientProvider>
);

export default BranchesRecord;
