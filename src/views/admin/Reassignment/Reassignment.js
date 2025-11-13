import React, { useMemo, useState, useCallback } from 'react';
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
  Autocomplete,
  TextField
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import DetailPanel from './DetailPanel';

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
  const [selectedUser, setSelectedUser] = useState(null);
  const accessToken = useSelector((state) => state.user.accessToken);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const { data = { transactions: [], availableUsers: [] }, isError, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/get_assigned_transaction_per_brnach', {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      });
      const json = await response.json();
      return {
        transactions: json.data.transactions,
        availableUsers: json.data.availableUsers
      };
    },
  });

  const handleOpenDetail = useCallback((data) => {
    const randomDirection = Math.floor(Math.random() * 2) + 1;
    setEntranceDirection(randomDirection);
    setSelectedDetail(data);
  }, []);

  const handleConfirmationOpen = () => {
    setIsConfirmationOpen(true);
  };

  const handleConfirmationClose = () => {
    setIsConfirmationOpen(false);
    setSelectedUser(null);
  };

  const handlePostSelectedTransactions = async () => {
    if (!selectedUser) {
      toast.error('Please select a user to reassign the transactions');
      return;
    }

    handleConfirmationClose();

    const selectedTransactions = Object.keys(rowSelection).map(index => {
      const row = data.transactions[parseInt(index)];
      return {
        id: row._id,
        transactionType: row.transactionType
      };
    });

    try {
      const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/transaction_reassigned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({ 
          transactions: selectedTransactions,
          assignedUser: selectedUser 
        }),
      });

      if (response.ok) {
        toast.success('Transactions reassigned successfully!', {
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
        setSelectedUser(null);
        queryClient.invalidateQueries(['transactions']);
      } else {
        throw new Error('Failed to reassign transactions');
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
            backgroundColor: cell.getValue() === 'posted' ? '#e3f2fd' : '#e8f5e9',
            borderRadius: '20px',
            padding: '6px 12px',
            width: 'fit-content',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: cell.getValue() === 'posted' ? '#1976d2' : '#2e7d32',
          }}
        >
          {cell.getValue()}
        </div>
      ),
    },
  ], [handleOpenDetail]);

  const tableInstance = useMaterialReactTable({
    columns,
    data: data.transactions,
    enableRowSelection: (row) => row.original.status === 'assigned',
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        if (row.original.status === 'posted') {
          setRowSelection((prev) => ({
            ...prev,
            [row.index]: !prev[row.index],
          }));
        }
      },
      selected: rowSelection[row.index],
      
    }),
    state: { 
      isLoading, 
      showAlertBanner: isError,
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    positionToolbarAlertBanner: 'bottom',
    renderTopToolbarCustomActions: ({ table }) => {
      const hasSelectedRows = Object.keys(rowSelection).length > 0;
      
      return (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            color="primary"
            variant="contained"
            onClick={handleConfirmationOpen}
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
            Reassign Selected Transactions ({Object.keys(rowSelection).length})
          </Button>

          <StyledDialog
            open={isConfirmationOpen}
            onClose={handleConfirmationClose}
            maxWidth="sm"
            fullWidth
          >
            <StyledDialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningAmberIcon />
                <Typography variant="h6">Confirm Reassignment</Typography>
              </Box>
              <IconButton
                aria-label="close"
                onClick={handleConfirmationClose}
                sx={{
                  color: 'white',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <CloseIcon />
              </IconButton>
            </StyledDialogTitle>
            <DialogContent sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body1">
                  Please select a user to reassign the selected transactions:
                </Typography>
                <Autocomplete
                  value={selectedUser}
                  onChange={(event, newValue) => setSelectedUser(newValue)}
                  options={data.availableUsers}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select User"
                      required
                    />
                  )}
                  sx={{ mt: 2 }}
                />
                <Box sx={{ 
                  bgcolor: 'primary.lighter', 
                  p: 2, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'primary.light'
                }}>
                  <Typography variant="subtitle2" color="primary.main">
                    Number of transactions to be reassigned: {Object.keys(rowSelection).length}
                  </Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button
                onClick={handleConfirmationClose}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 'bold',
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePostSelectedTransactions}
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!selectedUser}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 'bold',
                  boxShadow: 2,
                }}
              >
                Confirm Reassignment
              </Button>
            </DialogActions>
          </StyledDialog>
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
        <MaterialReactTable
         enableRowSelection={(row) =>  row.original.request_type.toLowerCase() !== 'other_bank_transfer'}
        table={tableInstance} />
      </Box>

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