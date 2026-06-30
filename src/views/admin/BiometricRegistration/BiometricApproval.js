import React, { useMemo, useState } from 'react'
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useSelector } from 'react-redux'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import { motion } from 'framer-motion'
import { API_BASE_URL } from 'src/config/api'

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return { bg: '#fff3e0', color: '#e65100' }
    case 'approved':
      return { bg: '#e8f5e9', color: '#2e7d32' }
    case 'rejected':
      return { bg: '#ffebee', color: '#c62828' }
    default:
      return { bg: '#e3f2fd', color: '#1976d2' }
  }
}

const fingerPositions = {
  right_thumb: 'Right Thumb',
  right_index: 'Right Index',
  right_middle: 'Right Middle',
  right_ring: 'Right Ring',
  right_little: 'Right Little',
  left_thumb: 'Left Thumb',
  left_index: 'Left Index',
  left_middle: 'Left Middle',
  left_ring: 'Left Ring',
  left_little: 'Left Little',
}

const BiometricApproval = () => {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [selectedBiometric, setSelectedBiometric] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const accessToken = useSelector((state) => state.user.accessToken)

  // Fetch all biometrics for admin's branch
  const {
    data: fetchData = [],
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['branchBiometrics'],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/zsmart_branch_requests/biometric/branch_registrations`,
        {
          headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
        }
      )
      const json = await response.json()
      if (json.error) {
        throw new Error(json.message)
      }
      return json.data || []
    },
  })

  const handleApprove = async (biometric) => {
    setIsProcessing(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/zsmart_branch_requests/biometric/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': accessToken,
          },
          body: JSON.stringify({
            biometric_id: biometric._id,
          }),
        }
      )

      const result = await response.json()

      if (response.ok && !result.error) {
        toast.success('Biometric approved successfully!', {
          position: 'top-right',
          autoClose: 3000,
        })
        refetch()
      } else {
        throw new Error(result.message || 'Failed to approve biometric')
      }
    } catch (error) {
      toast.error(error.message, {
        position: 'top-right',
        autoClose: 3000,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenRejectDialog = (biometric) => {
    setSelectedBiometric(biometric)
    setRejectionReason('')
    setIsRejectDialogOpen(true)
  }

  const handleCloseRejectDialog = () => {
    setIsRejectDialogOpen(false)
    setSelectedBiometric(null)
    setRejectionReason('')
  }

  const handleReject = async () => {
    if (!selectedBiometric) return

    setIsProcessing(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/zsmart_branch_requests/biometric/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': accessToken,
          },
          body: JSON.stringify({
            biometric_id: selectedBiometric._id,
            rejection_reason: rejectionReason,
          }),
        }
      )

      const result = await response.json()

      if (response.ok && !result.error) {
        toast.success('Biometric rejected', {
          position: 'top-right',
          autoClose: 3000,
        })
        handleCloseRejectDialog()
        refetch()
      } else {
        throw new Error(result.message || 'Failed to reject biometric')
      }
    } catch (error) {
      toast.error(error.message, {
        position: 'top-right',
        autoClose: 3000,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'cif',
        header: 'CIF',
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight="bold">
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: 'customer_name',
        header: 'Customer Name',
      },
      {
        accessorKey: 'finger_position',
        header: 'Finger',
        Cell: ({ cell }) => fingerPositions[cell.getValue()] || cell.getValue(),
      },
      {
        accessorKey: 'registered_by',
        header: 'Registered By',
      },
      {
        accessorKey: 'registration_date',
        header: 'Registration Date',
        Cell: ({ cell }) => {
          const date = new Date(cell.getValue())
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        Cell: ({ cell }) => {
          const colors = getStatusColor(cell.getValue())
          return (
            <Chip
              label={cell.getValue()?.toUpperCase()}
              size="small"
              sx={{
                backgroundColor: colors.bg,
                color: colors.color,
                fontWeight: 'bold',
              }}
            />
          )
        },
      },
      {
        accessorKey: 'approved_by',
        header: 'Processed By',
        Cell: ({ cell, row }) => {
          if (row.original.status !== 'pending' && cell.getValue()) {
            return cell.getValue()
          }
          return '-'
        },
      },
      {
        accessorKey: 'rejection_reason',
        header: 'Rejection Reason',
        Cell: ({ cell, row }) => {
          if (row.original.status === 'rejected' && cell.getValue()) {
            return (
              <Typography variant="body2" color="error">
                {cell.getValue()}
              </Typography>
            )
          }
          return '-'
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        Cell: ({ row }) => {
          if (row.original.status !== 'pending') {
            return <Typography variant="body2" color="text.secondary">-</Typography>
          }
          return (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Approve">
                <IconButton
                  color="success"
                  onClick={() => handleApprove(row.original)}
                  disabled={isProcessing}
                  size="small"
                >
                  <CheckCircleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject">
                <IconButton
                  color="error"
                  onClick={() => handleOpenRejectDialog(row.original)}
                  disabled={isProcessing}
                  size="small"
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )
        },
      },
    ],
    [isProcessing]
  )

  const tableInstance = useMaterialReactTable({
    columns,
    data: fetchData,
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    initialState: {
      sorting: [{ id: 'registration_date', desc: true }],
    },
  })

  // Count pending approvals (memoized so the full-array scan only runs when the
  // data changes, not on every render such as each isProcessing toggle).
  const pendingCount = useMemo(
    () => fetchData.filter((b) => b.status === 'pending').length,
    [fetchData]
  )

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <FingerprintIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight="bold">
            Biometric Approval
          </Typography>
          {pendingCount > 0 && (
            <Chip
              label={`${pendingCount} Pending`}
              color="warning"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          Review and approve/reject biometric registrations from your branch
        </Typography>
      </Box>

      <Box>
        <MaterialReactTable table={tableInstance} />
      </Box>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onClose={handleCloseRejectDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CancelIcon color="error" />
            <Typography variant="h6">Reject Biometric Registration</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedBiometric && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>CIF:</strong> {selectedBiometric.cif}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Customer:</strong> {selectedBiometric.customer_name || 'N/A'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Registered By:</strong> {selectedBiometric.registered_by}
              </Typography>

              <TextField
                label="Rejection Reason (Optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                fullWidth
                multiline
                rows={3}
                sx={{ mt: 2 }}
                placeholder="Enter reason for rejection..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRejectDialog} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Reject'}
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
  )
}

const queryClient = new QueryClient()

const BiometricApprovalWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <BiometricApproval />
  </QueryClientProvider>
)

export default BiometricApprovalWithProviders
