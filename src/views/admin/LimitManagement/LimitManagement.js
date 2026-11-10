import React, { useMemo, useState, useCallback, useEffect } from 'react'
import {
  MRT_EditActionButtons,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useSelector } from 'react-redux'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  Tab,
  Tabs,
  TextField,
  Paper,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  Autocomplete,
  InputAdornment,
} from '@mui/material'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { API_BASE_URL } from 'src/config/api'

// Helper: parse JSON response safely, throw meaningful error if not JSON
async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type')
  if (!response.ok) {
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json()
      throw new Error(result.message || `Request failed with status ${response.status}`)
    }
    throw new Error(`Request failed with status ${response.status} (${response.statusText})`)
  }
  return response.json()
}

// Tab Panel Component
function TabPanel(props) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`limit-tabpanel-${index}`}
      aria-labelledby={`limit-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

// ============================================
// CUSTOMER CATEGORY LIMIT TAB
// ============================================
const CustomerCategoryLimitTab = () => {
  const accessToken = useSelector((state) => state.user.accessToken)
  const user = useSelector((state) => state.user)
  const queryClient = useQueryClient()
  const [validationErrors, setValidationErrors] = useState({})

  // Fetch customer categories from Flexcube
  const {
    data: customerCategories = [],
    isLoading: loadingCategories,
  } = useQuery({
    queryKey: ['customerCategories'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/flexcube/customer-categories`, {
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      return result.data.map((item) => item.CUSTOMER_CATEGORY)
    },
    // Flexcube customer categories are reference data; cache so tab switches
    // don't refetch them every time. Mutations invalidate explicitly.
    staleTime: 5 * 60 * 1000,
  })

  // Fetch customer category limits
  const {
    data: limits = [],
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['customerCategoryLimits'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/customer-category-limits`, {
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      return result.data
    },
    // Cache briefly so rapid tab toggling doesn't trigger a refetch each time;
    // create/update/delete mutations invalidate this key so edits show instantly.
    staleTime: 60 * 1000,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newLimit) => {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/customer-category-limits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          ...newLimit,
          created_by: user.name || user.email,
          created_by_id: user.id,
        }),
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => {
      // v5 form. The bare-array form of v4 matches every query in v5, so each save also re-ran
      // the FlexCube customer-categories query.
      queryClient.invalidateQueries({ queryKey: ['customerCategoryLimits'] })
      toast.success('Customer category limit created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create limit')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }) => {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/customer-category-limits/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          ...values,
          updated_by: user.name || user.email,
          updated_by_id: user.id,
        }),
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => {
      // v5 form. The bare-array form of v4 matches every query in v5, so each save also re-ran
      // the FlexCube customer-categories query.
      queryClient.invalidateQueries({ queryKey: ['customerCategoryLimits'] })
      toast.success('Customer category limit updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update limit')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/customer-category-limits/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => {
      // v5 form. The bare-array form of v4 matches every query in v5, so each save also re-ran
      // the FlexCube customer-categories query.
      queryClient.invalidateQueries({ queryKey: ['customerCategoryLimits'] })
      toast.success('Customer category limit deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete limit')
    },
  })

  // Validation
  const validateRequired = (value) => !!value && value.toString().trim().length > 0
  const validateNumber = (value) => !isNaN(value) && parseFloat(value) >= 0

  // Columns
  const columns = useMemo(
    () => [
      {
        accessorKey: 'customer_category',
        header: 'Customer Category',
        size: 200,
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.customer_category,
          helperText: validationErrors?.customer_category,
        },
        Edit: ({ cell, column, row, table }) => {
          const isCreating = !row.original._id
          return (
            <Autocomplete
              options={customerCategories}
              loading={loadingCategories}
              defaultValue={row.original.customer_category || ''}
              disabled={!isCreating}
              onChange={(event, newValue) => {
                row._valuesCache[column.id] = newValue
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer Category"
                  required
                  error={!!validationErrors?.customer_category}
                  helperText={validationErrors?.customer_category}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingCategories ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )
        },
      },
      {
        accessorKey: 'daily_limit',
        header: 'Daily Limit (ETB)',
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue()
          return value?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        },
        muiEditTextFieldProps: {
          type: 'number',
          required: true,
          error: !!validationErrors?.daily_limit,
          helperText: validationErrors?.daily_limit,
          InputProps: {
            startAdornment: <InputAdornment position="start">ETB</InputAdornment>,
          },
        },
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        size: 100,
        Cell: ({ cell }) => (
          <Box
            sx={{
              backgroundColor: cell.getValue() ? '#4caf50' : '#f44336',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            {cell.getValue() ? 'Active' : 'Inactive'}
          </Box>
        ),
        editVariant: 'select',
        editSelectOptions: [
          { value: true, label: 'Active' },
          { value: false, label: 'Inactive' },
        ],
      },
      {
        accessorKey: 'created_by',
        header: 'Created By',
        size: 120,
        enableEditing: false,
      },
      {
        accessorKey: 'created_at',
        header: 'Created At',
        size: 150,
        enableEditing: false,
        Cell: ({ cell }) => {
          const value = cell.getValue()
          return value ? new Date(value).toLocaleDateString() : '-'
        },
      },
    ],
    [validationErrors, customerCategories, loadingCategories],
  )

  // Handle create
  const handleCreateLimit = async ({ values, table }) => {
    const newValidationErrors = {}
    if (!validateRequired(values.customer_category)) {
      newValidationErrors.customer_category = 'Customer category is required'
    }
    if (!validateRequired(values.daily_limit) || !validateNumber(values.daily_limit)) {
      newValidationErrors.daily_limit = 'Valid daily limit is required'
    }

    if (Object.keys(newValidationErrors).length > 0) {
      setValidationErrors(newValidationErrors)
      return
    }

    setValidationErrors({})
    await createMutation.mutateAsync(values)
    table.setCreatingRow(null)
  }

  // Handle update
  const handleSaveLimit = async ({ values, table, row }) => {
    const newValidationErrors = {}
    if (!validateRequired(values.daily_limit) || !validateNumber(values.daily_limit)) {
      newValidationErrors.daily_limit = 'Valid daily limit is required'
    }

    if (Object.keys(newValidationErrors).length > 0) {
      setValidationErrors(newValidationErrors)
      return
    }

    setValidationErrors({})
    await updateMutation.mutateAsync({ id: row.original._id, ...values })
    table.setEditingRow(null)
  }

  // Handle delete
  const openDeleteConfirmModal = (row) => {
    if (window.confirm(`Are you sure you want to delete limit for "${row.original.customer_category}"?`)) {
      deleteMutation.mutate(row.original._id)
    }
  }

  const table = useMaterialReactTable({
    columns,
    data: limits,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => row._id,
    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: 'Error loading data',
        }
      : undefined,
    muiTableContainerProps: {
      sx: { minHeight: '400px' },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleCreateLimit,
    onEditingRowCancel: () => setValidationErrors({}),
    onEditingRowSave: handleSaveLimit,
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h5">Add Customer Category Limit</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {internalEditComponents}
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </>
    ),
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h5">Edit Customer Category Limit</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {internalEditComponents}
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </>
    ),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Edit">
          <IconButton onClick={() => table.setEditingRow(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => openDeleteConfirmModal(row)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Button
          variant="contained"
          onClick={() => table.setCreatingRow(true)}
          sx={{ backgroundColor: '#E60000', '&:hover': { backgroundColor: '#CC0000' } }}
        >
          Add Category Limit
        </Button>
        <Tooltip arrow title="Refresh Data">
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    state: {
      isLoading,
      isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
      showAlertBanner: isError,
      showProgressBars: isFetching,
    },
  })

  return <MaterialReactTable table={table} />
}

// ============================================
// MAKER CHECKER THRESHOLD TAB
// ============================================
const MakerCheckerThresholdTab = () => {
  const accessToken = useSelector((state) => state.user.accessToken)
  const user = useSelector((state) => state.user)
  const [thresholdAmount, setThresholdAmount] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch current threshold
  const {
    data: threshold,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['makerCheckerThreshold'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/maker-checker-threshold`, {
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      return result.data
    },
    onSuccess: (data) => {
      setThresholdAmount(data?.threshold_amount?.toString() || '')
    },
  })

  useEffect(() => {
    if (threshold) {
      setThresholdAmount(threshold.threshold_amount?.toString() || '')
    }
  }, [threshold])

  // Save threshold
  const handleSave = async () => {
    if (!thresholdAmount || isNaN(parseFloat(thresholdAmount)) || parseFloat(thresholdAmount) < 0) {
      toast.error('Please enter a valid threshold amount')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/limit-management/maker-checker-threshold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({
          threshold_amount: parseFloat(thresholdAmount),
          currency: 'ETB',
          created_by: user.name || user.email,
          created_by_id: user.id,
        }),
      })
      const result = await parseJsonResponse(response)
      if (result.error) throw new Error(result.message)
      toast.success('Maker-checker threshold saved successfully')
      setIsEditing(false)
      refetch()
    } catch (error) {
      toast.error(error.message || 'Failed to save threshold')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Maker-Checker Threshold Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Transactions with amount greater than or equal to this threshold will require checker
            approval before processing.
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            Current Threshold:{' '}
            <strong>
              ETB{' '}
              {threshold?.threshold_amount?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) || '0.00'}
            </strong>
          </Alert>

          <TextField
            fullWidth
            label="Threshold Amount"
            type="number"
            value={thresholdAmount}
            onChange={(e) => setThresholdAmount(e.target.value)}
            disabled={!isEditing && threshold?.is_active}
            InputProps={{
              startAdornment: <InputAdornment position="start">ETB</InputAdornment>,
            }}
            helperText="Transactions >= this amount require checker approval"
            sx={{ mb: 2 }}
          />

          {threshold?.updated_by && (
            <Typography variant="caption" color="text.secondary">
              Last updated by: {threshold.updated_by} on{' '}
              {new Date(threshold.updated_at).toLocaleDateString()}
            </Typography>
          )}
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
          {!isEditing && threshold?.is_active ? (
            <Button
              variant="outlined"
              onClick={() => setIsEditing(true)}
              startIcon={<EditIcon />}
            >
              Edit
            </Button>
          ) : (
            <>
              {threshold?.is_active && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsEditing(false)
                    setThresholdAmount(threshold?.threshold_amount?.toString() || '')
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{ backgroundColor: '#E60000', '&:hover': { backgroundColor: '#CC0000' } }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </CardActions>
      </Card>
    </Box>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
const LimitManagementContent = () => {
  const [tabValue, setTabValue] = useState(0)

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue)
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ p: 2, fontWeight: 'bold' }}>
          Limit Management
        </Typography>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="limit management tabs"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 'medium',
            },
            '& .Mui-selected': {
              color: '#E60000',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#E60000',
            },
          }}
        >
          <Tab label="Daily Customer Category Limit" />
          <Tab label="Maker Checker Threshold" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <CustomerCategoryLimitTab />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <MakerCheckerThresholdTab />
      </TabPanel>
      <ToastContainer position="top-right" autoClose={3000} />
    </Box>
  )
}

// Wrap with QueryClientProvider
const queryClient = new QueryClient()

const LimitManagement = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LimitManagementContent />
    </QueryClientProvider>
  )
}

export default LimitManagement
