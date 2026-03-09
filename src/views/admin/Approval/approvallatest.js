import React, { useMemo, useState, useCallback } from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { Box, Tabs, Tab, Typography, Button } from '@mui/material';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import SendIcon from '@mui/icons-material/Send'; 
import { motion } from 'framer-motion';
import DetailPanel from './DetailPanel'; // Adjust the path if necessary
import { API_BASE_URL } from 'src/config/api';

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
  const accessToken = useSelector((state) => state.user.accessToken);

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

  const handlePostSelectedTransactions = async () => {
    const selectedTransactions = Object.keys(rowSelection).map(index => {
      const row = fetchData[parseInt(index)];
      return {
        id: row._id,
        transactionType: row.transactionType
      };
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/transaction_posted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({ transactions: selectedTransactions }),
      });

      if (response.ok) {
        toast.success('Transactions posted successfully!', {
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
        throw new Error('Failed to post transactions');
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
            ...prev,
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
            Post Selected Transactions ({Object.keys(rowSelection).length})
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
