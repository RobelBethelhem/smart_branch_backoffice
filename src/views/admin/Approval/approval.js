import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import {
  Box, Tabs, Tab, Typography, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField,
  Grid, Card, CardContent, Divider, InputAdornment, Chip, Alert, CircularProgress
} from '@mui/material';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import SendIcon from '@mui/icons-material/Send';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { motion } from 'framer-motion';
import DetailPanel from './DetailPanel'; // Adjust the path if necessary
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

// Calculate total from denomination
const calculateDenominationTotal = (denomination) => {
  if (!denomination) return 0;
  return DENOMINATIONS.reduce((total, d) => {
    return total + (denomination[d.key] || 0) * d.value;
  }, 0);
};

// Initialize empty denomination
const getEmptyDenomination = () => {
  return DENOMINATIONS.reduce((acc, d) => {
    acc[d.key] = 0;
    return acc;
  }, {});
};

const getRequestTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'deposit': return '#3498db';
    case 'withdraw': return '#e74c3c';
    case 'transfer': return '#2ecc71';
    case 'other-bank-transfer': return '#f39c12';
    default: return '#95a5a6';
  }
};

const Example = () => {
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [entranceDirection, setEntranceDirection] = useState(1);
  const [rowSelection, setRowSelection] = useState({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const accessToken = useSelector((state) => state.user.accessToken);
  const storedUserName = useSelector((state) => state.user.name);
  // posted_by is mandatory when posting. Fall back to the name embedded in the
  // JWT (`user` claim) so sessions that logged in before the name was persisted
  // — and were never re-issued a token — still resolve a valid poster.
  const userName = useMemo(() => {
    if (storedUserName) return storedUserName;
    if (!accessToken) return undefined;
    try {
      return jwtDecode(accessToken)?.user;
    } catch {
      return undefined;
    }
  }, [storedUserName, accessToken]);
  const queryClientHook = useQueryClient();

  // Denomination state for Deposit/Withdraw
  const [denomination, setDenomination] = useState(getEmptyDenomination());
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Till balance state
  const [tillBalance, setTillBalance] = useState(null);
  const [isLoadingTill, setIsLoadingTill] = useState(false);
  const [tillError, setTillError] = useState(null);

  const { data: fetchData = [], isError, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/get_assigned_to_me`, {
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

  // Fetch till denominations
  const fetchTillBalance = async () => {
    setIsLoadingTill(true);
    setTillError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/get_till_denominations`, {
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
      });
      const result = await response.json();

      if (response.ok && !result.error) {
        setTillBalance(result.data);
      } else {
        setTillError(result.message || 'Failed to fetch till balance');
      }
    } catch (error) {
      setTillError(error.message);
    } finally {
      setIsLoadingTill(false);
    }
  };

  // Calculate total till balance
  const calculateTillTotal = () => {
    if (!tillBalance?.denominations) return 0;
    return DENOMINATIONS.reduce((total, d) => {
      const count = tillBalance.denominations[d.key] || 0;
      return total + count * d.value;
    }, 0);
  };

  const handlePostSelectedTransactions = async () => {
    const selectedTransactionIndex = Object.keys(rowSelection)[0];
    const transaction = fetchData[parseInt(selectedTransactionIndex)];
    setSelectedTransaction(transaction);
    setDenomination(getEmptyDenomination());
    setTransactionRef('');
    setTillBalance(null);
    setTillError(null);
    setIsDialogOpen(true);

    // Fetch till balance when dialog opens
    fetchTillBalance();
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setTransactionRef('');
    setDenomination(getEmptyDenomination());
    setSelectedTransaction(null);
    setTillBalance(null);
    setTillError(null);
  };

  // Handle denomination input change with validation for withdraw and echeck
  const handleDenominationChange = (key, value) => {
    const numValue = parseInt(value) || 0;
    const isWithdraw = ['withdraw', 'echeck'].includes(selectedTransaction?.transactionType?.toLowerCase());

    // For withdraw, limit to available count
    let maxValue = numValue;
    if (isWithdraw && tillBalance?.denominations) {
      const available = tillBalance.denominations[key] || 0;
      maxValue = Math.min(numValue, available);
    }

    setDenomination(prev => ({
      ...prev,
      [key]: Math.max(0, maxValue)
    }));
  };

  // Check if withdraw/echeck exceeds available for any denomination
  const getWithdrawExceededDenoms = () => {
    if (!tillBalance?.denominations) return [];
    const isWithdraw = ['withdraw', 'echeck'].includes(selectedTransaction?.transactionType?.toLowerCase());
    if (!isWithdraw) return [];

    return DENOMINATIONS.filter(d => {
      const requested = denomination[d.key] || 0;
      const available = tillBalance.denominations[d.key] || 0;
      return requested > available;
    });
  };

  // Auto-populate denomination based on amount (uses till balance for withdraw)
  const handleAutoPopulate = async () => {
    if (!selectedTransaction) return;

    setIsAutoPopulating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/autopopulate_denomination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          amount: parseFloat(selectedTransaction.amount_in_figures)
        }),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        setDenomination(result.data.denomination);

        // Show warning if can't fulfill (for withdraw)
        if (result.data.warning) {
          toast.warning(result.data.warning, {
            position: "top-right",
            autoClose: 5000,
            theme: "colored",
          });
        } else {
          toast.success('Denomination auto-populated!', {
            position: "top-right",
            autoClose: 2000,
            theme: "colored",
          });
        }

        // Refresh till balance after auto-populate
        fetchTillBalance();
      } else {
        throw new Error(result.message || 'Failed to auto-populate denomination');
      }
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
    } finally {
      setIsAutoPopulating(false);
    }
  };

  // Check if transaction is Deposit, Withdraw, or E-Check (needs denomination)
  const needsDenomination = ['deposit', 'withdraw', 'echeck'].includes(selectedTransaction?.transactionType?.toLowerCase());

  // Calculate denomination total
  const denominationTotal = calculateDenominationTotal(denomination);
  const expectedAmount = selectedTransaction ? parseFloat(selectedTransaction.amount_in_figures) : 0;
  const denominationMatches = Math.abs(denominationTotal - expectedAmount) < 0.01;

  const handleDialogSubmit = async () => {
    if (!selectedTransaction) return;

    // A transaction can only be posted by an identified user — posted_by is
    // mandatory. Block the post if we cannot resolve a poster name.
    if (!userName) {
      toast.error('Cannot post: your user name is missing. Please log out and log in again.', {
        position: "top-right",
        autoClose: 4000,
        theme: "colored",
      });
      return;
    }

    // Validate denomination for Deposit/Withdraw
    if (needsDenomination && !denominationMatches) {
      toast.error(`Denomination total (${denominationTotal.toFixed(2)}) does not match amount (${expectedAmount.toFixed(2)})`, {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let endpoint = `${API_BASE_URL}/api/zsmart_branch_requests/transaction_posted`;
      let body = {
        transaction_id: selectedTransaction._id,
        posted_by: userName,
      };

      // Use denomination endpoint for Deposit/Withdraw/ECheck
      if (needsDenomination) {
        const transactionType = selectedTransaction.transactionType.toLowerCase();
        endpoint = `${API_BASE_URL}/api/zsmart_branch_requests/process-${transactionType}-with-denomination`;
        body = {
          [`${transactionType}_id`]: selectedTransaction._id,
          denomination: denomination,
          posted_by: userName,
        };
      }
      // Transfer: call process-transfer directly (no denomination needed, integrates with Flexcube)
      else if (selectedTransaction?.transactionType?.toLowerCase() === 'transfer') {
        endpoint = `${API_BASE_URL}/api/zsmart_branch_requests/process-transfer`;
        body = {
          transfer_id: selectedTransaction._id,
          posted_by: userName,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        // Check if transaction needs checker approval
        if (result.data?.needsChecker) {
          toast.info(result.message || 'Transaction sent for checker approval', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored",
          });
        } else {
          toast.success('Transaction posted successfully!', {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored",
          });
        }

        setRowSelection({});
        queryClientHook.invalidateQueries(['transactions']);
      } else {
        throw new Error(result.message || 'Failed to post transaction');
      }
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } finally {
      setIsSubmitting(false);
      handleDialogClose();
    }
  };

  /* ==== COMMENTED OUT - OLD IMPLEMENTATION ====
  // The previous implementation without denomination support
  // Keeping for reference and backwards compatibility

  const handlePostSelectedTransactionsOld = async () => {
    setIsDialogOpen(true);
  };

  const handleDialogSubmitOld = async () => {
    const selectedTransactionIndex = Object.keys(rowSelection)[0];
    const selectedTransaction = fetchData[parseInt(selectedTransactionIndex)];

    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/transaction_posted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          transaction_id: selectedTransaction._id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Transaction posted successfully!');
        setRowSelection({});
        queryClient.invalidateQueries(['transactions']);
      } else {
        throw new Error(result.message || 'Failed to post transaction');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      handleDialogClose();
    }
  };
  ==== END OF OLD IMPLEMENTATION ==== */

  const columns = useMemo(() => [
    {
      accessorKey: 'transactionType',
      header: 'Transaction Type',
      Cell: ({ cell, row }) => (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: getRequestTypeColor(cell.getValue()),
            padding: '6px 12px',
            borderRadius: '20px',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
          onClick={() => handleOpenDetail(row.original)}
        >
          {cell.getValue()}
        </motion.div>
      ),
    },
    { accessorKey: 'account_number', header: 'Account Number' },
    { accessorKey: 'acc_holder_name', header: 'Account Holder Name' },
    { accessorKey: 'amount_in_figures', header: 'Amount' },
    {
      accessorKey: 'status',
      header: 'Status',
      Cell: ({ cell }) => (
        <div
          style={{
            backgroundColor: cell.getValue() === 'assigned' ? '#e3f2fd' : '#e8f5e9',
            borderRadius: '20px',
            padding: '6px 12px',
            width: 'fit-content',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: cell.getValue() === 'assigned' ? '#1976d2' : '#2e7d32',
          }}
        >
          {cell.getValue()}
        </div>
      ),
    },
  ], [handleOpenDetail]);

  const tableInstance = useMaterialReactTable({
    columns,
    data: fetchData,
    enableRowSelection: (row) => row.original.status === 'assigned',
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        if (row.original.status === 'assigned') {
          setRowSelection((prev) => ({
            [row.index]: !prev[row.index],
          }));
        }
      },
      selected: rowSelection[row.index],
      style: {
        cursor: row.original.status === 'assigned' ? 'pointer' : 'not-allowed',
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
    renderTopToolbarCustomActions: ({ table }) => {
      const hasSelectedRows = Object.keys(rowSelection).length === 1;
      
      return (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            color="primary"
            variant="contained"
            onClick={handlePostSelectedTransactions}
            disabled={!hasSelectedRows}
            startIcon={<SendIcon />}
            sx={{
              backgroundColor: hasSelectedRows ? 'primary.main' : 'grey.300',
              color: hasSelectedRows ? 'white' : 'text.disabled',
              '&:hover': {
                backgroundColor: hasSelectedRows ? 'primary.dark' : 'grey.300',
              },
              transition: 'all 0.3s ease',
              fontWeight: 'bold',
              borderRadius: '8px',
              textTransform: 'none',
              px: 3,
              py: 1,
            }}
          >
            Post Selected Transaction
          </Button>
        </motion.div>
      );
    },
  });

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={0} sx={{ '& .MuiTab-root': { fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', minWidth: 120 } }}>
          <Tab label="Transactions" />
        </Tabs>
      </Box>

      <Box>
        <MaterialReactTable table={tableInstance} />
      </Box>

      <DetailPanel
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        data={selectedDetail || {}}
        entranceDirection={entranceDirection}
      />

      <Dialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        maxWidth={needsDenomination ? "md" : "sm"}
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Post {selectedTransaction?.transactionType || 'Transaction'}
          {selectedTransaction && (
            <>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                Account: {selectedTransaction.account_number} | Amount: {parseFloat(selectedTransaction.amount_in_figures).toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
              </Typography>
              {selectedTransaction.transactionType?.toLowerCase() === 'echeck' && (
                <Typography variant="subtitle2" sx={{ opacity: 0.9, mt: 0.5 }}>
                  Recipient: {selectedTransaction.recipient_full_name} ({selectedTransaction.recipient_phone_number})
                </Typography>
              )}
            </>
          )}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Show denomination fields for Deposit/Withdraw */}
          {needsDenomination && (
            <>
              {/* Till Balance Summary Card */}
              <Card sx={{ mb: 2, bgcolor: 'grey.50' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Your Till Balance</Typography>
                      {isLoadingTill ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="body2">Loading...</Typography>
                        </Box>
                      ) : tillError ? (
                        <Typography variant="body2" color="error">{tillError}</Typography>
                      ) : (
                        <Typography variant="h6" fontWeight="bold" color="primary.main">
                          {calculateTillTotal().toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary">Till ID</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {tillBalance?.tillId || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary">Branch</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {tillBalance?.branchCode || '-'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
                <Typography variant="h6">Cash Denomination</Typography>
                <Button
                  variant="outlined"
                  startIcon={isAutoPopulating ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                  onClick={handleAutoPopulate}
                  disabled={isAutoPopulating || isLoadingTill}
                  size="small"
                >
                  Auto-Populate
                </Button>
              </Box>

              {/* Notes Section */}
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Notes (Birr)
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {DENOMINATIONS.filter(d => d.type === 'note').map(denom => {
                  const available = tillBalance?.denominations?.[denom.key] || 0;
                  const isWithdraw = ['withdraw', 'echeck'].includes(selectedTransaction?.transactionType?.toLowerCase());
                  const exceedsAvailable = isWithdraw && (denomination[denom.key] || 0) > available;

                  return (
                    <Grid item xs={4} sm={2} key={denom.key}>
                      <TextField
                        label={denom.label}
                        type="number"
                        size="small"
                        fullWidth
                        value={denomination[denom.key] || ''}
                        onChange={(e) => handleDenominationChange(denom.key, e.target.value)}
                        error={exceedsAvailable}
                        InputProps={{
                          inputProps: { min: 0, max: isWithdraw ? available : undefined }
                        }}
                        sx={{
                          '& .MuiInputBase-input': { textAlign: 'center' }
                        }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                        = {((denomination[denom.key] || 0) * denom.value).toLocaleString()}
                      </Typography>
                      {tillBalance && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textAlign: 'center',
                            color: exceedsAvailable ? 'error.main' : 'success.main',
                            fontWeight: 'medium'
                          }}
                        >
                          Avail: {available}
                        </Typography>
                      )}
                    </Grid>
                  );
                })}
              </Grid>

              {/* Coins Section */}
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Coins (Cents)
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {DENOMINATIONS.filter(d => d.type === 'coin').map(denom => {
                  const available = tillBalance?.denominations?.[denom.key] || 0;
                  const isWithdraw = ['withdraw', 'echeck'].includes(selectedTransaction?.transactionType?.toLowerCase());
                  const exceedsAvailable = isWithdraw && (denomination[denom.key] || 0) > available;

                  return (
                    <Grid item xs={4} sm={2.4} key={denom.key}>
                      <TextField
                        label={denom.label}
                        type="number"
                        size="small"
                        fullWidth
                        value={denomination[denom.key] || ''}
                        onChange={(e) => handleDenominationChange(denom.key, e.target.value)}
                        error={exceedsAvailable}
                        InputProps={{
                          inputProps: { min: 0, max: isWithdraw ? available : undefined }
                        }}
                        sx={{
                          '& .MuiInputBase-input': { textAlign: 'center' }
                        }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                        = {((denomination[denom.key] || 0) * denom.value).toFixed(2)}
                      </Typography>
                      {tillBalance && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textAlign: 'center',
                            color: exceedsAvailable ? 'error.main' : 'success.main',
                            fontWeight: 'medium'
                          }}
                        >
                          Avail: {available}
                        </Typography>
                      )}
                    </Grid>
                  );
                })}
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Total Summary */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Denomination Total</Typography>
                  <Typography variant="h5" fontWeight="bold" color={denominationMatches ? 'success.main' : 'error.main'}>
                    {denominationTotal.toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">Expected Amount</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {expectedAmount.toLocaleString('en-ET', { style: 'currency', currency: 'ETB' })}
                  </Typography>
                </Box>
                <Box>
                  {denominationMatches ? (
                    <Chip icon={<CheckCircleIcon />} label="Match" color="success" />
                  ) : (
                    <Chip
                      icon={<WarningIcon />}
                      label={`Diff: ${Math.abs(denominationTotal - expectedAmount).toFixed(2)}`}
                      color="error"
                    />
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />
            </>
          )}

          {/* Transaction Reference Number - auto-generated server-side */}
          <Alert severity="info" sx={{ mt: 1 }}>
            Transaction reference number will be auto-generated by the system.
          </Alert>

          {/* Warning for invalid denomination */}
          {needsDenomination && !denominationMatches && denominationTotal > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Denomination total does not match the transaction amount. Please adjust the denomination counts.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDialogClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDialogSubmit}
            variant="contained"
            color="primary"
            disabled={isSubmitting || (needsDenomination && !denominationMatches)}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {isSubmitting ? 'Processing...' : 'Post Transaction'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==== COMMENTED OUT - OLD DIALOG ====
      <Dialog open={isDialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Enter Transaction Reference Number</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Transaction Reference Number"
            type="text"
            fullWidth
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleDialogSubmit} color="primary">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
      ==== END OF OLD DIALOG ==== */}

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
