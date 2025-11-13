import React, { useMemo, useState, useCallback } from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { Box, Tabs, Tab, Typography, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import SendIcon from '@mui/icons-material/Send'; 
import { motion } from 'framer-motion';
import DetailPanel from './DetailPanel'; // Adjust the path if necessary

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

  const { data: fetchData = [], isError, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/get_assigned_to_me', {
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

  const handlePostSelectedTransactions = async () => {
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setTransactionRef('');
  };

  const handleDialogSubmit = async () => {
    const selectedTransactionIndex = Object.keys(rowSelection)[0];
    const selectedTransaction = fetchData[parseInt(selectedTransactionIndex)];

    try {
      const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/transaction_posted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          transaction_id: selectedTransaction._id,
          trn_ref_no: transactionRef,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Transaction posted successfully!', {
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
        progress: undefined,
        theme: "colored",
      });
    } finally {
      handleDialogClose();
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
