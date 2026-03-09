import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  MRT_EditActionButtons,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSelector } from 'react-redux';
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
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  keepPreviousData,
  useQueryClient,
} from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';
import Autocomplete from '@mui/material/Autocomplete';
import SearchIcon from '@mui/icons-material/Search';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_BASE_URL } from 'src/config/api';

// Add this component at the top of your file, after the imports
const CreateUserModal = ({ open, onClose, onSave, tillIdOptions }) => {
  const [formData, setFormData] = useState({
    user: '',
    till_id: null,
    role: null
  });
  const [errors, setErrors] = useState({});

  // Define roles
  const roleOptions = ['Teller', 'Maker', 'Authorizer', 'Auditor', 'Admin'];

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Clear till_id if role is changed to something other than Teller
      if (field === 'role' && value !== 'Teller') {
        newData.till_id = null;
      }

      return newData;
    });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = () => {
    // Validate form
    const newErrors = {};
    if (!formData.user) {
      newErrors.user = 'Name is Required';
    }
    if (!formData.role) {
      newErrors.role = 'Role is Required';
    }
    // Only validate till_id if role is Teller
    if (formData.role === 'Teller' && !formData.till_id) {
      newErrors.till_id = 'Till ID is Required for Teller role';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If validation passes, create user with name instead of domain_user
    const userData = {
      user: formData.user,
      till_id: formData.till_id,
      role: formData.role,
      roles: [formData.role],
      email: `${formData.user}@zemenbank.com`
    };

    onSave(userData);
    // Reset form
    setFormData({
      user: '',
      till_id: null,
      role: null
    });
    setErrors({});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New User</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Name"
            value={formData.user}
            onChange={(e) => handleChange('user', e.target.value)}
            error={!!errors.user}
            helperText={errors.user}
            required
            fullWidth
          />

          {/* Role Selection */}
          <Autocomplete
            value={formData.role}
            onChange={(event, newValue) => handleChange('role', newValue)}
            options={roleOptions}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Role"
                error={!!errors.role}
                helperText={errors.role}
                required
              />
            )}
          />

          {/* Till ID - Only enabled for Teller role */}
          <Autocomplete
            value={formData.till_id}
            onChange={(event, newValue) => handleChange('till_id', newValue)}
            options={tillIdOptions}
            getOptionLabel={(option) => option}
            disabled={formData.role !== 'Teller'}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Till ID"
                error={!!errors.till_id}
                helperText={errors.till_id || (formData.role !== 'Teller' ? 'Till ID is only required for Teller role' : '')}
                required={formData.role === 'Teller'}
              />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Create User
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Excel Import Dialog Component
const ExcelImportDialog = ({ open, onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const accessToken = useSelector((state) => state.user.accessToken);

  const onDrop = useCallback((acceptedFiles) => {
    const droppedFile = acceptedFiles[0];
    if (droppedFile) {
      if (
        droppedFile.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Please upload only Excel files (.xlsx)');
      }
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const validateExcelFormat = (data) => {
    const requiredHeaders = ['name', 'branch', 'till_id', 'created_at'];
    const headers = Object.keys(data[0]);

    if (!requiredHeaders.every((header) => headers.includes(header))) {
      return {
        isValid: false,
        error:
          'Invalid Excel format. Please ensure the file contains columns: name, branch, till_id, created_at',
      };
    }

    const errors = [];
    const domainUsers = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Check for null or empty values
      for (const header of requiredHeaders) {
        if (!row[header] || row[header].toString().trim() === '') {
          errors.push(`Row ${i + 2}: ${header} cannot be empty`);
        }
      }

      // Validate till_id existence
      if (!row.till_id) {
        errors.push(`Row ${i + 2}: till_id is invalid`);
      }

      // Check for duplicates
      if (domainUsers.has(row.name)) {
        errors.push(
          `Row ${i + 2}: Duplicate name found: ${row.name}`
        );
      } else {
        domainUsers.add(row.name);
      }
    }

    return { isValid: errors.length === 0, error: errors.join('\n') };
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const validationResult = validateExcelFormat(jsonData);
      if (validationResult.isValid) {
        try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(
            '/api/api/candidates/employee_excel_upload',
            {
              method: 'POST',
              headers: {
                'x-access-token': accessToken,
              },
              body: formData,
            }
          );

          if (response.ok) {
            toast.success('Excel file imported successfully');
            onImport();
            onClose();
          } else {
            const errorData = await response.json();
            toast.error(`Error importing Excel file: ${errorData.message}`);
          }
        } catch (error) {
          console.error('Error importing Excel file:', error);
          toast.error('Error importing Excel file');
        }
      } else {
        setError(validationResult.error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Import Excel</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed #cccccc',
            p: 2,
            mb: 2,
            textAlign: 'center',
          }}
        >
          <input {...getInputProps()} />
          <Typography>
            Drag and drop an Excel file here, or click to select a file
          </Typography>
        </Box>
        {file && <Typography>Selected file: {file.name}</Typography>}
        {error && <Typography color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleImport} disabled={!file || !!error}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Example Component
const Example = () => {
  const [validationErrors, setValidationErrors] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch accessToken from Redux state
  const accessToken = useSelector((state) => state.user.accessToken);

  // Fetch Users Data
  const {
    data: fetchData = { data: [], meta: {} },
    isError,
    isRefetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['table-data', columnFilters, globalFilter, sorting],
    queryFn: async () => {
      const fetchURL = new URL(`${API_BASE_URL}/api/zsmart_branch_requests/get_users_per_branch`, window.location.origin);
      
      // Set search params before making the request
      fetchURL.searchParams.set('filters', JSON.stringify(columnFilters ?? []));
      fetchURL.searchParams.set('globalFilter', globalFilter ?? '');
      fetchURL.searchParams.set('sorting', JSON.stringify(sorting ?? []));

      const response = await fetch(fetchURL.href, {
        headers: {
          'x-access-token': accessToken,
        },
      });

      const json = await response.json();
      return json;
    },
    placeholderData: keepPreviousData,
  });

  // Manage local state for table data to handle real-time updates
  const [tableData, setTableData] = useState([]);

  // Synchronize fetched data with local tableData state
  useEffect(() => {
    if (fetchData) {
      const processedData = fetchData.data.map((row, index) => ({
        ...row,
        id: row.id || `row-${index}`, // Assign unique string ID
      }));
      console.log("Processed Data with IDs:", processedData); // Debugging log
      setTableData(processedData);
    }
  }, [fetchData]);

  // Fetch Till IDs from Backend
  const {
    data: tillIdData = [],
    isLoading: isTillIdLoading,
    isError: isTillIdError,
  } = useQuery({
    queryKey: ['till-ids'],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/zsmart_branch_requests/till_id`,
        {
          headers: {
            'x-access-token': accessToken,
          },
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch Till IDs');
      }
      const json = await response.json();

      if (json.error === false && Array.isArray(json.data)) {
        return json.data.map((till) => till.TILL_ID);
      } else {
        console.error('Unexpected Till IDs format:', json);
        throw new Error('Invalid Till IDs format received from server');
      }
    },
    staleTime: 0,
    cacheTime: 0,
    enabled: !!accessToken,
  });

  // Define hardcoded roles as the fetch API for roles is removed
  const roles = useMemo(() => ['Teller', 'Maker', 'Authorizer', 'Auditor', 'Admin'], []);

  const handleExcelImport = () => {
    setIsExcelImportOpen(true);
  };

  const handleExcelImportClose = () => {
    setIsExcelImportOpen(false);
  };

  const handleExcelImportSuccess = () => {
    refetch(); // Refresh the data after successful import
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'user',
        header: 'Name',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.user,
          helperText: validationErrors?.user,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              user: undefined,
            }),
        },
      },
      {
        accessorKey: 'roles',
        header: 'Role',
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return Array.isArray(value) ? value.join(', ') : (value || '');
        },
        Edit: ({ row, table }) => {
          const roleOptions = ['Teller', 'Maker', 'Authorizer', 'Auditor', 'Admin'];

          // roles is an array in the DB like ["Teller"], extract first element
          const currentRole = Array.isArray(row.original.roles)
            ? row.original.roles[0]
            : (row.original.roles || null);

          const handleChange = (event, newValue) => {
            // Store as array to match backend schema
            table.options.meta.updateData(row.id, 'roles', newValue ? [newValue] : []);
            // Clear till_id if role is changed from Teller
            if (newValue !== 'Teller') {
              table.options.meta.updateData(row.id, 'till_id', null);
            }
          };

          return (
            <Autocomplete
              disablePortal
              value={currentRole}
              onChange={handleChange}
              options={roleOptions}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Role"
                  variant="outlined"
                  error={!!validationErrors?.role}
                  helperText={validationErrors?.role}
                  required
                />
              )}
              sx={{ minWidth: 250 }}
            />
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        muiEditTextFieldProps: {
          disabled: true,
        },
      },
      {
        accessorKey: 'branch',
        header: 'Branch',
        muiEditTextFieldProps: {
          disabled: true,
        },
      },
      {
        accessorKey: 'till_id',
        header: 'Till ID',
        Edit: ({ row, table }) => {
          const tillIdOptions = Array.isArray(tillIdData) ? tillIdData : [];
          const isTeller = Array.isArray(row.original.roles)
            ? row.original.roles.includes('Teller')
            : row.original.roles === 'Teller';

          const handleChange = (event, newValue) => {
            table.options.meta.updateData(row.id, 'till_id', newValue);
          };

          return (
            <Autocomplete
              disablePortal
              value={row.original.till_id || null}
              onChange={handleChange}
              options={tillIdOptions}
              disabled={!isTeller}
              getOptionLabel={(option) => option}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Till ID"
                  variant="outlined"
                  error={isTeller && !!validationErrors?.till_id}
                  helperText={
                    isTeller 
                      ? validationErrors?.till_id 
                      : 'Till ID is only required for Teller role'
                  }
                  required={isTeller}
                />
              )}
              sx={{ minWidth: 250 }}
              ListboxProps={{
                style: { maxHeight: '200px' },
              }}
            />
          );
        },
      },
      {
        accessorKey: 'flex_id',
        header: 'Flex User',
        muiEditTextFieldProps: {
          disabled: true, // Make branch non-editable
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created At',
        muiTableBodyCellProps: {
          align: 'right',
        },
        muiEditTextFieldProps: {
          disabled: true,
        },
      },
    ],
    [validationErrors, tillIdData]
  );

  const { mutateAsync: createUser, isPending: isCreatingUser } = useCreateUser(refetch);
  const { mutateAsync: updateUser, isPending: isUpdatingUser } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: isDeletingUser } = useDeleteUser(refetch, accessToken);

  const handleCreateUserSubmit = async (userData) => {
    try {
      await createUser(userData);
      setCreateModalOpen(false);
      refetch();
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleSaveUser = async ({ values, table }) => {
    console.log("Saving User with Values:", values);
    // Ensure roles is always an array for the backend
    const rolesArray = Array.isArray(values.roles) ? values.roles : (values.roles ? [values.roles] : []);
    const updatedValues = {
      ...values,
      user: values.user,
      email: `${values.user}@zemenbank.com`,
      till_id: values.till_id,
      roles: rolesArray,
    };

    console.log('Updated Values for Saving:', updatedValues);

    const newValidationErrors = validateUser(updatedValues);
    const hasErrors = Object.values(newValidationErrors).some(error => error);
    
    if (hasErrors) {
      setValidationErrors(newValidationErrors);
      return;
    }
    
    try {
      setValidationErrors({});
      await updateUser(updatedValues);
      table.setEditingRow(null);
      refetch();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(`Error saving user: ${error.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedRow) {
      await deleteUser(selectedRow.id); // Use selectedRow.id if properly set
      setOpenDeleteModal(false);
      setSelectedRow(null);
    }
  };

  const renderTopToolbarCustomActions = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '1rem',
      }}
    >
      <Tooltip arrow title="Refresh Data">
        <IconButton onClick={() => refetch()}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        onClick={() => setCreateModalOpen(true)}
      >
        New User
      </Button>
    </Box>
  );

  const table = useMaterialReactTable({
    columns,
    data: tableData,
    paginationDisplayMode: 'pages',
    enableColumnOrdering: true,
    enableGrouping: true,
    enableStickyHeader: true,
    enableRowPinning: true,
    enableFacetedValues: true,
    enableColumnPinning: true,

    rowPinningDisplayMode: 'top-and-bottom',
    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: 'Error loading data',
        }
      : undefined,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => row.id, // Ensure 'id' is unique and correctly set
    muiTableContainerProps: {
      sx: { minHeight: '500px' },
    },
    onEditingRowCancel: () => setValidationErrors({}),
    onEditingRowSave: handleSaveUser,
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Edit">
          <IconButton onClick={() => table.setEditingRow(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            color="error"
            onClick={() => {
              setOpenDeleteModal(true);
              setSelectedRow(row);
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions,
    state: {
      columnFilters,
      globalFilter,
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      sorting,
    },
    meta: {
      updateData: (rowId, columnId, value) => {
        console.log(`Updating row ${rowId}, column ${columnId} to value ${value}`); // Debugging log
        setTableData((oldData) =>
          oldData.map((row) => {
            if (row.id === rowId) {
              return {
                ...row,
                [columnId]: value,
              };
            }
            return row;
          })
        );
      },
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />

      <Button variant="contained" onClick={handleExcelImport} sx={{ mt: 2 }}>
        Import Excel
      </Button>

      <ExcelImportDialog
        open={isExcelImportOpen}
        onClose={handleExcelImportClose}
        onImport={handleExcelImportSuccess}
      />

      <Dialog open={openDeleteModal} onClose={() => setOpenDeleteModal(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>Are you sure you want to delete this user?</DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <CreateUserModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreateUserSubmit}
        tillIdOptions={Array.isArray(tillIdData) ? tillIdData : []}
      />

      <ToastContainer
        position="top-right"
        autoClose={5000}
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

// Custom Hook to Create User
function useCreateUser(refetch) {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state) => state.user.accessToken);

  return useMutation({
    mutationFn: async (user) => {
      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/add_teller`, {
        method: 'POST',
        headers: {
            'x-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        body: JSON.stringify(user),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create user');
      }
      
      toast.success('User created successfully');
      return data;
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
    onSuccess: () => {
      refetch();
    },
  });
}

// Custom Hook to Update User
function useUpdateUser() {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state) => state.user.accessToken);
  return useMutation({
    mutationFn: async (user) => {
      const response = await fetch('/api/api/editUser/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify(user),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`User updated successfully`);
      } else {
        toast.error(`Error: ${data.message}`);
      }

      return data;
    },
    onMutate: (updatedUser) => {
      queryClient.setQueryData(['table-data'], (prevData) =>
        prevData?.data.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        )
      );
    },
    onSuccess: () => {
      // Optionally refetch or update cache
    },
  });
}

// Custom Hook to Delete User
function useDeleteUser(refetch, accessToken) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId) => {
      const response = await fetch('/api/api/deleteUser/', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify({ id: userId }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`User deleted successfully`);
      } else {
        toast.error(`Error: ${data.message}`);
      }

      return data;
    },
    onMutate: (userId) => {
      queryClient.setQueryData(['table-data'], (prevData) =>
        prevData?.data.filter((user) => user.id !== userId)
      );
    },
    onSuccess: () => {
      refetch(); // Trigger a refetch of the data
    },
  });
}

// Query Client and Provider
const queryClient = new QueryClient();

const ExampleWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <Example />
  </QueryClientProvider>
);

export default ExampleWithProviders;

// Validation Functions
const validateRequired = (value) => !!value;
const validateEmail = (email) =>
  !!email.length &&
  email.toLowerCase().match(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );

function validateUser(user) {
  console.log("Validating User:", user);
  // roles is an array like ["Teller"]
  const hasRole = Array.isArray(user.roles) ? user.roles.length > 0 : !!user.roles;
  const firstRole = Array.isArray(user.roles) ? user.roles[0] : user.roles;

  const errors = {
    user: !validateRequired(user.user)
      ? 'Name is Required'
      : '',
    role: !hasRole
      ? 'Role is Required'
      : '',
  };

  // Only validate till_id if role is Teller
  if (firstRole === 'Teller') {
    errors.till_id = !validateRequired(user.till_id) ? 'Till ID is Required for Teller role' : '';
  }

  return errors;
}