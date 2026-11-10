import React, { useMemo, useState, useCallback } from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import {
  Box, Tabs, Tab, Typography, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Grid, Chip, Alert, CircularProgress, Card, CardContent, Divider
} from '@mui/material';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { motion } from 'framer-motion';
import { API_BASE_URL } from 'src/config/api';

// Ethiopian Birr Denominations
const DENOMINATIONS = [
  { key: 'd200', label: '200 Birr', value: 200, type: 'note' },
  { key: 'd100', label: '100 Birr', value: 100, type: 'note' },
  { key: 'd50', label: '50 Birr', value: 50, type: 'note' },
  { key: 'd10', label: '10 Birr', value: 10, type: 'note' },
  { key: 'd5', label: '5 Birr', value: 5, type: 'note' },
  { key: 'd1', label: '1 Birr', value: 1, type: 'note' },
  { key: 'dc50', label: '50 Cent', value: 0.50, type: 'coin' },
  { key: 'dc25', label: '25 Cent', value: 0.25, type: 'coin' },
  { key: 'dc10', label: '10 Cent', value: 0.10, type: 'coin' },
  { key: 'dc5', label: '5 Cent', value: 0.05, type: 'coin' },
  { key: 'dc1', label: '1 Cent', value: 0.01, type: 'coin' },
];

const getRequestTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'deposit': return '#3498db';
    case 'withdraw': return '#e74c3c';
    case 'transfer': return '#2ecc71';
    default: return '#95a5a6';
  }
};

const PendingCheckerApproval = () => {
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accessToken = useSelector((state) => state.user.accessToken);
  const userName = useSelector((state) => state.user.name);
  const queryClientHook = useQueryClient();

  // Fetch pending checker transactions
  const { data: fetchData = [], isError, isLoading, refetch } = useQuery({
    queryKey: ['pending-checker-transactions'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/pending-checker-transactions`, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await response.json();
      return json.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleApprove = useCallback((transaction) => {
    setSelectedTransaction(transaction);
    setTransactionRef('');
    setIsApproveDialogOpen(true);
  }, []);

  const handleReject = useCallback((transaction) => {
    setSelectedTransaction(transaction);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  }, []);

  const handleViewDetails = useCallback((transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailDialogOpen(true);
  }, []);

  const handleApproveSubmit = async () => {
    if (!selectedTransaction) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/approve-pending-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          transaction_id: selectedTransaction._id,
          transaction_type: selectedTransaction.transaction_type,
          action: 'approve',
          checker_name: userName,
          trn_ref_no: transactionRef,
        }),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        toast.success('Transaction approved successfully!', {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
        queryClientHook.invalidateQueries(['pending-checker-transactions']);
        setIsApproveDialogOpen(false);
      } else {
        throw new Error(result.message || 'Failed to approve transaction');
      }
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedTransaction) return;

    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason', {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/approve-pending-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          transaction_id: selectedTransaction._id,
          transaction_type: selectedTransaction.transaction_type,
          action: 'reject',
          checker_name: userName,
          checker_remarks: rejectReason,
        }),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        toast.success('Transaction rejected', {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
        queryClientHook.invalidateQueries(['pending-checker-transactions']);
        setIsRejectDialogOpen(false);
      } else {
        throw new Error(result.message || 'Failed to reject transaction');
      }
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'transaction_type',
      header: 'Type',
      size: 100,
      Cell: ({ cell }) => (
        <Chip
          label={cell.getValue()}
          size="small"
          sx={{
            bgcolor: getRequestTypeColor(cell.getValue()),
            color: 'white',
            fontWeight: 'bold'
          }}
        />
      ),
    },
    { accessorKey: 'account_number', header: 'Account Number', size: 150 },
    { accessorKey: 'acc_holder_name', header: 'Account Holder', size: 150 },
    {
      accessorKey: 'amount_in_figures',
      header: 'Amount',
      size: 120,
      Cell: ({ cell }) => (
        <Typography fontWeight="bold" color="primary">
          {parseFloat(cell.getValue()).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
        </Typography>
      ),
    },
    {
      accessorKey: 'checker_threshold',
      header: 'Threshold',
      size: 120,
      Cell: ({ cell }) => (
        <Typography variant="body2">
          {parseFloat(cell.getValue() || 0).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
        </Typography>
      ),
    },
    { accessorKey: 'posted_by', header: 'Posted By', size: 120 },
    {
      accessorKey: 'posted_date',
      header: 'Posted Date',
      size: 150,
      Cell: ({ cell }) => new Date(cell.getValue()).toLocaleString(),
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      size: 200,
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => handleViewDetails(row.original)}
          >
            View
          </Button>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => handleApprove(row.original)}
          >
            Approve
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => handleReject(row.original)}
          >
            Reject
          </Button>
        </Box>
      ),
    },
  ], [handleApprove, handleReject, handleViewDetails]);

  const tableInstance = useMaterialReactTable({
    columns,
    data: fetchData,
    enableRowSelection: false,
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          Pending Checker Approval
        </Typography>
        <Chip
          label={`${fetchData.length} pending`}
          color="warning"
          size="small"
        />
      </Box>
    ),
  });

  // Render denomination details
  const renderDenomination = (denomination) => {
    if (!denomination) return <Typography color="text.secondary">No denomination data</Typography>;

    return (
      <Grid container spacing={1}>
        {DENOMINATIONS.map(denom => {
          const count = denomination[denom.key] || 0;
          if (count === 0) return null;
          return (
            <Grid item xs={4} sm={3} md={2} key={denom.key}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
                <Typography variant="caption" color="text.secondary">{denom.label}</Typography>
                <Typography variant="body1" fontWeight="bold">{count}</Typography>
                <Typography variant="caption" color="primary">
                  = {(count * denom.value).toLocaleString()}
                </Typography>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <>
      <Box sx={{ p: 2 }}>
        <MaterialReactTable table={tableInstance} />
      </Box>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onClose={() => setIsApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          Approve Transaction
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedTransaction && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Transaction Details</Typography>
              <Typography><strong>Type:</strong> {selectedTransaction.transaction_type}</Typography>
              <Typography><strong>Account:</strong> {selectedTransaction.account_number}</Typography>
              <Typography><strong>Amount:</strong> {parseFloat(selectedTransaction.amount_in_figures).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}</Typography>
              <Typography><strong>Posted By:</strong> {selectedTransaction.posted_by}</Typography>
            </Box>
          )}
          <TextField
            margin="dense"
            label="Transaction Reference Number"
            type="text"
            fullWidth
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            helperText="Optional - Will be auto-generated if not provided"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsApproveDialogOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleApproveSubmit}
            variant="contained"
            color="success"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {isSubmitting ? 'Approving...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onClose={() => setIsRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          Reject Transaction
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedTransaction && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Transaction Details</Typography>
              <Typography><strong>Type:</strong> {selectedTransaction.transaction_type}</Typography>
              <Typography><strong>Account:</strong> {selectedTransaction.account_number}</Typography>
              <Typography><strong>Amount:</strong> {parseFloat(selectedTransaction.amount_in_figures).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}</Typography>
            </Box>
          )}
          <TextField
            margin="dense"
            label="Rejection Reason"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            error={!rejectReason.trim()}
            helperText="Please provide a reason for rejection"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRejectDialogOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleRejectSubmit}
            variant="contained"
            color="error"
            disabled={isSubmitting || !rejectReason.trim()}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : <CancelIcon />}
          >
            {isSubmitting ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={isDetailDialogOpen} onClose={() => setIsDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Transaction Details
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedTransaction && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Transaction Type</Typography>
                  <Chip
                    label={selectedTransaction.transaction_type}
                    size="small"
                    sx={{
                      bgcolor: getRequestTypeColor(selectedTransaction.transaction_type),
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip label="Pending Checker" color="warning" size="small" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Account Number</Typography>
                  <Typography variant="body1">{selectedTransaction.account_number}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Account Holder</Typography>
                  <Typography variant="body1">{selectedTransaction.acc_holder_name}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                  <Typography variant="h6" color="primary" fontWeight="bold">
                    {parseFloat(selectedTransaction.amount_in_figures).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Maker-Checker Threshold</Typography>
                  <Typography variant="body1">
                    {parseFloat(selectedTransaction.checker_threshold || 0).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Posted By</Typography>
                  <Typography variant="body1">{selectedTransaction.posted_by}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Posted Date</Typography>
                  <Typography variant="body1">{new Date(selectedTransaction.posted_date).toLocaleString()}</Typography>
                </Grid>
                {selectedTransaction.xref && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">XREF</Typography>
                    <Typography variant="body1" fontFamily="monospace">{selectedTransaction.xref}</Typography>
                  </Grid>
                )}
                {selectedTransaction.customer_category && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Customer Category</Typography>
                    <Typography variant="body1">{selectedTransaction.customer_category}</Typography>
                  </Grid>
                )}
              </Grid>

              {selectedTransaction.denomination && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>Denomination Breakdown</Typography>
                  {renderDenomination(selectedTransaction.denomination)}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">Denomination Total</Typography>
                    <Typography variant="h6" color="success.main">
                      {parseFloat(selectedTransaction.denomination_total || 0).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                    </Typography>
                  </Box>
                </>
              )}

              {selectedTransaction.transaction_type === 'Withdraw' && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>Withdrawal Limit Info</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" color="text.secondary">Daily Limit</Typography>
                      <Typography variant="body1">
                        {parseFloat(selectedTransaction.daily_limit || 0).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" color="text.secondary">Previously Withdrawn Today</Typography>
                      <Typography variant="body1">
                        {parseFloat(selectedTransaction.daily_withdrawn_before || 0).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" color="text.secondary">Limit Check</Typography>
                      <Chip
                        label={selectedTransaction.limit_check_passed ? 'Passed' : 'Failed'}
                        color={selectedTransaction.limit_check_passed ? 'success' : 'error'}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => {
              setIsDetailDialogOpen(false);
              handleApprove(selectedTransaction);
            }}
          >
            Approve
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => {
              setIsDetailDialogOpen(false);
              handleReject(selectedTransaction);
            }}
          >
            Reject
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

// The list is still refreshed when the user comes back to the window or the page, but not more
// than once every few seconds: switching between this app and FlexCube used to re-run the whole
// query on every switch, for every open tab in the bank. One retry instead of three on failure.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

const PendingCheckerApprovalWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <PendingCheckerApproval />
  </QueryClientProvider>
);

export default PendingCheckerApprovalWithProviders;
