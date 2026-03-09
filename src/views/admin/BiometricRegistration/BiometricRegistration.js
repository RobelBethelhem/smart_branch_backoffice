import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
} from '@mui/material'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useSelector } from 'react-redux'
import AddIcon from '@mui/icons-material/Add'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import UsbIcon from '@mui/icons-material/Usb'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { motion } from 'framer-motion'
import { API_BASE_URL, FINGERPRINT_WS_URL } from 'src/config/api'

const FINGERPRINT_SERVICE_URL = FINGERPRINT_WS_URL

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

const fingerPositions = [
  { value: 'right_thumb', label: 'Right Thumb' },
  { value: 'right_index', label: 'Right Index' },
  { value: 'right_middle', label: 'Right Middle' },
  { value: 'right_ring', label: 'Right Ring' },
  { value: 'right_little', label: 'Right Little' },
  { value: 'left_thumb', label: 'Left Thumb' },
  { value: 'left_index', label: 'Left Index' },
  { value: 'left_middle', label: 'Left Middle' },
  { value: 'left_ring', label: 'Left Ring' },
  { value: 'left_little', label: 'Left Little' },
]

const BiometricRegistration = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [cif, setCif] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [isFetchingCustomer, setIsFetchingCustomer] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [fingerPosition, setFingerPosition] = useState('right_index')
  const [fingerprintTemplate, setFingerprintTemplate] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureStatus, setCaptureStatus] = useState('')
  const [scannerConnected, setScannerConnected] = useState(false)
  const [serviceConnected, setServiceConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const accessToken = useSelector((state) => state.user.accessToken)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  // Fetch biometric registrations
  const {
    data: fetchData = [],
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['biometricRegistrations'],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/zsmart_branch_requests/biometric/my_registrations`,
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

  // Connect to fingerprint service WebSocket
  const connectToService = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setIsConnecting(true)
    setCaptureStatus('Connecting to fingerprint service...')

    try {
      wsRef.current = new WebSocket(FINGERPRINT_SERVICE_URL)

      wsRef.current.onopen = () => {
        console.log('Connected to fingerprint service')
        setServiceConnected(true)
        setIsConnecting(false)
        setCaptureStatus('Connected to fingerprint service')
        // Request scanner status
        wsRef.current.send(JSON.stringify({ action: 'check' }))
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Fingerprint service message:', data)

          switch (data.type) {
            case 'status':
              setScannerConnected(data.connected)
              setCaptureStatus(data.message)
              break

            case 'capturing':
              setIsCapturing(true)
              setCaptureStatus(data.message)
              break

            case 'captured':
              setIsCapturing(false)
              if (data.success) {
                setFingerprintTemplate(data.template)
                setCaptureStatus('Fingerprint captured successfully!')
                toast.success('Fingerprint captured!', {
                  position: 'top-right',
                  autoClose: 2000,
                })
              } else {
                setCaptureStatus('Capture failed: ' + data.message)
                toast.error('Capture failed: ' + data.message)
              }
              break

            case 'error':
              setIsCapturing(false)
              setCaptureStatus('Error: ' + data.message)
              toast.error(data.message)
              break

            default:
              console.log('Unknown message type:', data.type)
          }
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      wsRef.current.onclose = () => {
        console.log('Disconnected from fingerprint service')
        setServiceConnected(false)
        setScannerConnected(false)
        setIsConnecting(false)
        setCaptureStatus('Disconnected from fingerprint service')

        // Try to reconnect after 5 seconds
        if (isDialogOpen) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...')
            connectToService()
          }, 5000)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setServiceConnected(false)
        setIsConnecting(false)
        setCaptureStatus('Failed to connect to fingerprint service. Make sure the service is running.')
      }

    } catch (error) {
      console.error('Connection error:', error)
      setIsConnecting(false)
      setCaptureStatus('Failed to connect: ' + error.message)
    }
  }, [isDialogOpen])

  // Disconnect from service
  const disconnectFromService = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setServiceConnected(false)
    setScannerConnected(false)
  }, [])

  // Connect when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      connectToService()
    } else {
      disconnectFromService()
    }

    return () => {
      disconnectFromService()
    }
  }, [isDialogOpen, connectToService, disconnectFromService])

  // Auto-fetch customer when CIF is 7 digits
  useEffect(() => {
    const fetchCustomer = async () => {
      if (cif.length === 7) {
        setIsFetchingCustomer(true)
        setCustomerError('')
        setCustomerName('')
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/zsmart_branch_requests/biometric/customer/${cif}`,
            {
              headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
            }
          )
          const result = await response.json()
          if (response.ok && !result.error) {
            setCustomerName(result.data.customer_name || '')
            if (!result.data.customer_name) {
              setCustomerError('Customer not found in Flexcube')
            }
          } else {
            setCustomerError(result.message || 'Failed to fetch customer')
          }
        } catch (error) {
          setCustomerError('Error fetching customer: ' + error.message)
        } finally {
          setIsFetchingCustomer(false)
        }
      } else {
        setCustomerName('')
        setCustomerError('')
      }
    }

    fetchCustomer()
  }, [cif, accessToken])

  const captureFingerprint = () => {
    if (!serviceConnected) {
      toast.error('Fingerprint service not connected')
      return
    }

    if (!scannerConnected) {
      toast.error('Scanner not detected. Please connect ZK9500.')
      return
    }

    if (isCapturing) {
      toast.warning('Capture already in progress')
      return
    }

    setIsCapturing(true)
    setCaptureStatus('Place your finger on the scanner...')

    // Send capture request to service
    wsRef.current.send(JSON.stringify({ action: 'capture' }))
  }

  const checkScanner = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'check' }))
    } else {
      connectToService()
    }
  }

  const handleOpenDialog = () => {
    setIsDialogOpen(true)
    setCif('')
    setCustomerName('')
    setCustomerError('')
    setFingerPosition('right_index')
    setFingerprintTemplate('')
    setCaptureStatus('')
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setCif('')
    setCustomerName('')
    setCustomerError('')
    setFingerprintTemplate('')
    setCaptureStatus('')
  }

  const handleSubmit = async () => {
    // Validate CIF
    if (!cif || !/^\d{7}$/.test(cif)) {
      toast.error('CIF must be exactly 7 digits')
      return
    }

    if (!fingerprintTemplate) {
      toast.error('Please capture fingerprint first')
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/zsmart_branch_requests/biometric/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': accessToken,
          },
          body: JSON.stringify({
            cif,
            fingerprint_template: fingerprintTemplate,
            finger_position: fingerPosition,
            customer_name: customerName,
          }),
        }
      )

      const result = await response.json()

      if (response.ok && !result.error) {
        toast.success(result.message || 'Biometric registered successfully!', {
          position: 'top-right',
          autoClose: 3000,
        })
        handleCloseDialog()
        refetch()
      } else {
        throw new Error(result.message || 'Failed to register biometric')
      }
    } catch (error) {
      toast.error(error.message, {
        position: 'top-right',
        autoClose: 3000,
      })
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
        Cell: ({ cell }) => {
          const pos = fingerPositions.find((p) => p.value === cell.getValue())
          return pos?.label || cell.getValue()
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
        accessorKey: 'registration_date',
        header: 'Registration Date',
        Cell: ({ cell }) => {
          const date = new Date(cell.getValue())
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
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
    ],
    []
  )

  const tableInstance = useMaterialReactTable({
    columns,
    data: fetchData,
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    renderTopToolbarCustomActions: () => (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          color="primary"
          variant="contained"
          onClick={handleOpenDialog}
          startIcon={<AddIcon />}
          sx={{
            fontWeight: 'bold',
            borderRadius: '8px',
            textTransform: 'none',
            px: 3,
            py: 1,
          }}
        >
          Add Biometric
        </Button>
      </motion.div>
    ),
  })

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Biometric Registration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Register customer fingerprints for biometric authentication (ZK9500 Scanner)
        </Typography>
      </Box>

      <Box>
        <MaterialReactTable table={tableInstance} />
      </Box>

      {/* Add Biometric Dialog */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FingerprintIcon color="primary" />
            <Typography variant="h6">Register New Biometric</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Connection Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: serviceConnected ? 'success.50' : 'error.50' }}>
              {serviceConnected ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : isConnecting ? (
                <CircularProgress size={16} />
              ) : (
                <ErrorIcon color="error" fontSize="small" />
              )}
              <Typography variant="body2" color={serviceConnected ? 'success.main' : 'error.main'}>
                {isConnecting ? 'Connecting to service...' : serviceConnected ? 'Service Connected' : 'Service Disconnected'}
              </Typography>
              {!serviceConnected && !isConnecting && (
                <Button size="small" onClick={connectToService}>
                  Retry
                </Button>
              )}
            </Box>

            {/* Scanner Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: scannerConnected ? 'success.50' : 'warning.50' }}>
              <UsbIcon color={scannerConnected ? 'success' : 'warning'} fontSize="small" />
              <Typography variant="body2" color={scannerConnected ? 'success.main' : 'warning.main'}>
                {scannerConnected ? 'ZK9500 Scanner Ready' : 'Scanner Not Detected'}
              </Typography>
              <Button size="small" onClick={checkScanner}>
                Check
              </Button>
            </Box>

            <TextField
              label="CIF (7 digits)"
              value={cif}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 7)
                setCif(val)
              }}
              fullWidth
              required
              inputProps={{ maxLength: 7 }}
              helperText="Enter the 7-digit Customer Information File number"
            />

            {/* Customer Name - Auto-fetched from Flexcube */}
            {cif.length === 7 && (
              <Box sx={{ position: 'relative' }}>
                <TextField
                  label="Customer Name"
                  value={customerName}
                  fullWidth
                  disabled
                  InputProps={{
                    endAdornment: isFetchingCustomer ? (
                      <CircularProgress size={20} />
                    ) : customerName ? (
                      <CheckCircleIcon color="success" />
                    ) : null,
                  }}
                  error={!!customerError}
                  helperText={customerError || (customerName ? 'Customer found in Flexcube' : '')}
                />
              </Box>
            )}

            <FormControl fullWidth>
              <InputLabel>Finger Position</InputLabel>
              <Select
                value={fingerPosition}
                label="Finger Position"
                onChange={(e) => setFingerPosition(e.target.value)}
              >
                {fingerPositions.map((pos) => (
                  <MenuItem key={pos.value} value={pos.value}>
                    {pos.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Fingerprint Capture Area */}
            <Box
              sx={{
                mt: 2,
                p: 3,
                border: '2px dashed',
                borderColor: fingerprintTemplate ? 'success.main' : 'grey.400',
                borderRadius: 2,
                textAlign: 'center',
                bgcolor: fingerprintTemplate ? 'success.50' : 'grey.50',
                transition: 'all 0.3s ease',
              }}
            >
              <FingerprintIcon
                sx={{
                  fontSize: 80,
                  color: fingerprintTemplate ? 'success.main' : isCapturing ? 'primary.main' : 'grey.400',
                  animation: isCapturing ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 },
                  },
                }}
              />

              {isCapturing && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress color="primary" />
                </Box>
              )}

              <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}>
                {captureStatus || 'Click Capture to scan fingerprint'}
              </Typography>

              {fingerprintTemplate && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Fingerprint captured successfully
                </Alert>
              )}

              <Button
                variant="contained"
                onClick={captureFingerprint}
                disabled={isCapturing || !cif || !serviceConnected}
                startIcon={isCapturing ? <CircularProgress size={20} color="inherit" /> : <FingerprintIcon />}
                sx={{ mt: 2, px: 4 }}
                color={fingerprintTemplate ? 'success' : 'primary'}
              >
                {isCapturing ? 'Capturing...' : fingerprintTemplate ? 'Recapture' : 'Capture Fingerprint'}
              </Button>
            </Box>

            <Alert severity="info" sx={{ mt: 1 }}>
              Status will be set to <strong>Pending</strong> and requires Admin approval from your branch.
            </Alert>

            {!serviceConnected && (
              <Alert severity="warning">
                <Typography variant="body2" fontWeight="bold">Fingerprint Service Not Running</Typography>
                <Typography variant="body2">
                  To capture fingerprints, start the fingerprint service:
                </Typography>
                <code style={{ display: 'block', marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                  cd D:\smart_branch_backend\services\fingerprint<br />
                  npm install<br />
                  npm start
                </code>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={!cif || !fingerprintTemplate || !customerName || isFetchingCustomer}
          >
            Submit for Approval
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

const BiometricRegistrationWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <BiometricRegistration />
  </QueryClientProvider>
)

export default BiometricRegistrationWithProviders
