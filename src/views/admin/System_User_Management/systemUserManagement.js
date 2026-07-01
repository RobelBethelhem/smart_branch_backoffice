import React,{ useMemo, useState ,useCallback, useEffect  } from 'react';
import {
  MRT_EditActionButtons,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import RefreshIcon from '@mui/icons-material/Refresh';
import { roles } from './fetchedRole';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
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
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_BASE_URL } from 'src/config/api';

// Compiled once at module load instead of re-allocated for every row during
// .xlsx validation.
const NAME_REGEX = /^[a-zA-Z\s-]+$/;

const ExcelImportDialog = ({ open, onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const accessToken = useSelector((state) => state.user.accessToken);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        setFile(file);
        setError('');
      } else {
        setError('Please upload only Excel files (.xlsx)');
      }
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });



  const validateExcelFormat = (data) => {
    const requiredHeaders = ['first_name', 'last_name', 'employee_id', 'user', 'email', 'position','department','roles' ];
    const headers = Object.keys(data[0]);
    
    if (!requiredHeaders.every(header => headers.includes(header))) {
      return { isValid: false, error: 'Invalid Excel format. Please ensure the file contains columns: employee_id, first_name, last_name, department, and position' };
    }

    const errors = [];
    const employeeIds = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      
      // Check for null or empty values
      for (const header of requiredHeaders) {
        if (!row[header] || row[header].toString().trim() === '') {
          errors.push(`Row ${i + 2}: ${header} cannot be empty`);
        }
      }

      // Check for numbers and special characters
      if (!NAME_REGEX.test(row.first_name)) {
        errors.push(`Row ${i + 2}: first_name should not contain numbers or special characters`);
      }
      if (!NAME_REGEX.test(row.position)) {
        errors.push(`Row ${i + 2}: position should not contain numbers or special characters`);
      }
      if (!NAME_REGEX.test(row.roles)) {
        errors.push(`Row ${i + 2}: roles should not contain numbers or special characters`);
      }
      if (!NAME_REGEX.test(row.last_name)) {
        errors.push(`Row ${i + 2}: last_name should not contain numbers or special characters`);
      }
      if (!NAME_REGEX.test(row.department)) {
        errors.push(`Row ${i + 2}: department should not contain numbers or special characters`);
      }
      // if (!nameRegex.test(row.position)) {
      //   errors.push(`Row ${i + 2}: position should not contain numbers or special characters`);
      // }
      // Check for duplicates
    if (employeeIds.has(row.employee_id)) {
      errors.push(`Row ${i + 2}: Duplicate  found: ${row.employee_id}`);
    } else {
      employeeIds.add(row.employee_id);
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
      // Load xlsx on-demand (only when a user actually imports a file) rather
      // than shipping it in the admin route chunk for everyone.
      const XLSX = await import('xlsx');
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

          const response = await fetch(`${API_BASE_URL}/api/candidates/employee_excel_upload`, {
            method: 'POST',
            headers: {
              'x-access-token': accessToken,
            },
            body: formData,
          });

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
        <Box {...getRootProps()} sx={{ border: '2px dashed #cccccc', p: 2, mb: 2, textAlign: 'center' }}>
          <input {...getInputProps()} />
          <Typography>Drag and drop an Excel file here, or click to select a file</Typography>
        </Box>
        {file && <Typography>Selected file: {file.name}</Typography>}
        {error && <Typography color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleImport} disabled={!file || !!error}>Import</Button>
      </DialogActions>
    </Dialog>
  );
};



const Example = () => {
  const [validationErrors, setValidationErrors] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const userRole = useSelector((state) => state.user.role);
  // Branch_Management can only create Admin users (via the clean /create_admin path).
  const isBranchManagement = userRole === 'Branch_Management';
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  // With server-side paging, jump back to the first page when a filter/search
  // changes so the user isn't stranded on a now-empty page.
  useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [columnFilters, globalFilter]);

  const {
    data: fetchData = { data: [], meta: {} },
    isError,
    isRefetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['table-data', columnFilters, globalFilter, sorting, pagination],
    queryFn: async () => {
      const fetchURL = new URL(`${API_BASE_URL}/api/getUsers`, window.location.origin);

      fetchURL.searchParams.set('filters', JSON.stringify(columnFilters ?? []));
      fetchURL.searchParams.set('globalFilter', globalFilter ?? '');
      fetchURL.searchParams.set('sorting', JSON.stringify(sorting ?? []));
      // Server-side pagination: backend returns this page + meta.totalRowCount.
      fetchURL.searchParams.set('start', `${pagination.pageIndex * pagination.pageSize}`);
      fetchURL.searchParams.set('size', `${pagination.pageSize}`);

      const response = await fetch(fetchURL.href, {
        headers: {
          'x-access-token': getAccessToken(),
        },
      });
      const json = await response.json();
    
      return json;
    },
    placeholderData: keepPreviousData,
  });

  const { data = [], meta } = fetchData;

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
    () => {
      const cols = [

      {
        accessorKey: 'first_name',
        header: 'First Name',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.first_name,
          helperText: validationErrors?.first_name,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              first_name: undefined,
            }),
        },
      },
      {
        accessorKey: 'last_name',
        header: 'Last Name',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.last_name,
          helperText: validationErrors?.last_name,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              last_name: undefined,
            }),
        },
      },
      {
        accessorKey: 'employee_id',
        header: 'Employee ID',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.employee_id,
          helperText: validationErrors?.employee_id,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              employee_id: undefined,
            }),
        },
      },
      {
        accessorKey: 'user',
        header: 'User',
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
        accessorKey: 'email',
        header: 'Email',
        muiEditTextFieldProps: {
          type: 'email',
          required: true,
          error: !!validationErrors?.email,
          helperText: validationErrors?.email,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              email: undefined,
            }),
        },
      },

      {
        accessorKey: 'position',
        header: 'Position',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.position,
          helperText: validationErrors?.position,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              position: undefined,
            }),
        },
      },

      {
        accessorKey: 'department',
        header: 'Department',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.department,
          helperText: validationErrors?.department,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              department: undefined,
            }),
        },
      },
     

      {
        accessorKey: 'branch',
        header: 'Branch',
        muiEditTextFieldProps: {
          required: isBranchManagement,
          error: !!validationErrors?.branch,
          helperText: validationErrors?.branch,
        },
      },
      {
        accessorKey: 'roles',
        header: 'Roles',
        editVariant: 'select',
        // Branch_Management may only create Admins; everyone else keeps the full list.
        editSelectOptions: isBranchManagement ? ['Admin'] : roles,
        muiEditTextFieldProps: {
          select: true,
          error: !!validationErrors?.roles,
          helperText: validationErrors?.roles,
        },
      },
      {
        accessorKey: 'active',
        header: 'Status',
        enableEditing: false,      // not an input in the create/edit dialog
        enableColumnFilter: false,
        Cell: ({ row }) => {
          const active = row.original.active !== false;
          return (
            <Chip
              size="small"
              color={active ? 'success' : 'default'}
              label={active ? 'Active' : 'Inactive'}
            />
          );
        },
      },

      ];
      if (isBranchManagement) {
        // Branch_Management manages Admins by name / branch / role only — the RMS
        // employee fields are noise for them, so hide those columns (this also
        // trims the create & edit dialogs down to just the relevant fields).
        const hidden = new Set(['first_name', 'last_name', 'employee_id', 'position', 'department']);
        return cols.filter((c) => !hidden.has(c.accessorKey));
      }
      return cols;
    },
    [validationErrors, isBranchManagement],
  );

  const { mutateAsync: createUser, isPending: isCreatingUser } = useCreateUser(refetch);
  const { mutateAsync: updateUser, isPending: isUpdatingUser } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: isDeletingUser } = useDeleteUser(refetch);
  const { mutateAsync: setUserActive } = useSetUserActive(refetch);

  const handleCreateUser = async ({ values, table }) => {
    if (isBranchManagement) {
      // Branch_Management creates Admins only: only user (name) + branch are
      // needed; email is derived and the role is forced to Admin server-side.
      const errs = {};
      if (!values.user) errs.user = 'Name is Required';
      if (!values.branch) errs.branch = 'Branch is Required';
      if (Object.keys(errs).length) { setValidationErrors(errs); return; }
      setValidationErrors({});
      await createUser({
        user: values.user,
        email: values.email || `${values.user}@zemenbank.com`,
        branch: values.branch,
        roles: ['Admin'],
      });
      table.setCreatingRow(null);
      return;
    }
    const newValidationErrors = validateUser(values);
    if (Object.values(newValidationErrors).some((error) => error)) {
      setValidationErrors(newValidationErrors);
      return;
    }
    setValidationErrors({});
    await createUser(values);
    table.setCreatingRow(null); //exit creating mode
  };

  const handleSaveUser = async ({ values, table, row }) => {
    if (isBranchManagement) {
      // Branch_Management edits an Admin: validate name + branch only, keep the
      // role locked to Admin, and always send the row id so the update lands.
      const errs = {};
      if (!values.user) errs.user = 'Name is Required';
      if (!values.branch) errs.branch = 'Branch is Required';
      if (Object.keys(errs).length) { setValidationErrors(errs); return; }
      setValidationErrors({});
      await updateUser({
        id: row.original.id,
        user: values.user,
        email: values.email || `${values.user}@zemenbank.com`,
        branch: values.branch,
        roles: ['Admin'],
      });
      table.setEditingRow(null);
      return;
    }
    const newValidationErrors = validateUser(values);
    if (Object.values(newValidationErrors).some((error) => error)) {
      setValidationErrors(newValidationErrors);
      return;
    }
    setValidationErrors({});
    // The id isn't an editable column, so pull it from the row or the update no-ops.
    await updateUser({ ...values, id: row.original.id });
    table.setEditingRow(null); //exit editing mode
  };

  const handleDeleteConfirm = async () => {
    if (selectedRow) {
      await deleteUser(selectedRow.original.id);
      setOpenDeleteModal(false);
      setSelectedRow(null);
    }
  };

  const table = useMaterialReactTable({
    columns,
    data, // Ensure data is passed here
    // Server-side data: the backend (/getUsers) does the filtering, sorting and
    // paging, returning one page + meta.totalRowCount. This stops loading the
    // entire user collection into the browser.
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    rowCount: meta?.totalRowCount ?? 0,
    onPaginationChange: setPagination,
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
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => row.id,
    muiTableContainerProps: {
      sx: { minHeight: '500px' },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleCreateUser,
    onEditingRowCancel: () => setValidationErrors({}),
    onEditingRowSave: handleSaveUser,
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h3">New Employee</DialogTitle>
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
        <DialogTitle variant="h3">Edit User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {internalEditComponents}
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </>
    ),
    renderRowActions: ({ row, table }) => {
      const active = row.original.active !== false;
      return (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Edit">
          <IconButton onClick={() => table.setEditingRow(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        {isBranchManagement ? (
          // Branch_Management can't hard-delete — it deactivates (blocks login)
          // and can reactivate the same way.
          <Tooltip title={active ? 'Deactivate (block login)' : 'Activate'}>
            <IconButton
              color={active ? 'warning' : 'success'}
              onClick={() => setUserActive({ id: row.original.id, active: !active })}
            >
              {active ? <BlockIcon /> : <CheckCircleIcon />}
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Delete">
            <IconButton color="error" onClick={() => {
              setOpenDeleteModal(true);
              setSelectedRow(row);
            }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <Tooltip arrow title="Refresh Data">
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          New Employee
        </Button>
      </Box>
    ),
    state: {
      columnFilters,
      globalFilter,
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      sorting,
      pagination,
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />

      <Button variant="contained" onClick={handleExcelImport}>
        Import Excel
      </Button>

      <ExcelImportDialog
        open={isExcelImportOpen}
        onClose={handleExcelImportClose}
        onImport={handleExcelImportSuccess}
      />

      <Dialog open={openDeleteModal} onClose={() => setOpenDeleteModal(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this user?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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

function getAccessToken() {
  try {
    const persisted = JSON.parse(sessionStorage.getItem('persist:root') || '{}');
    const userState = JSON.parse(persisted.user || '{}');
    return userState.accessToken || '';
  } catch { return ''; }
}

function useCreateUser(refetch) {
  const queryClient = useQueryClient();
  const role = useSelector((state) => state.user.role);
  return useMutation({
    mutationFn: async (user) => {
      // Branch_Management uses the clean /create_admin path (no RMS site_id) and
      // may only create Admins; everyone else uses the existing /signUp.
      const isBM = role === 'Branch_Management';
      const url = isBM ? `${API_BASE_URL}/api/create_admin` : `${API_BASE_URL}/api/signUp/`;
      const payload = isBM
        ? { user: user.user, email: user.email, branch: user.branch }
        : user;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": getAccessToken(),
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json()
      if(response.ok){
        toast.success(`Action Done Successfully`);
      }else{
        toast.error(`Error: ${data.message}`);
      }


      // const response = await axios.post(`${API_BASE_URL}/api/signUp/`, user);
      // return response.data;
    },
    onMutate: (newUserInfo) => {
      queryClient.setQueryData(['users'], (prevUsers) =>
        prevUsers?.map((prevUser) =>
          prevUser.id === newUserInfo.id ? newUserInfo : prevUser,
        ),
      );
    },
    onSuccess: () => {
      refetch(); // Trigger a refetch of the data
    },
  });
}


function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user) => {

      const response = await fetch(`${API_BASE_URL}/api/editUser/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": getAccessToken(),
        },
        body: JSON.stringify(user)
      });

      // const response = await axios.patch(`${API_BASE_URL}/api/editUser/`, user);
     
      const data = await response.json()
      if(response.ok){
        toast.success(`Action Done Successfully`);
      }else{
        toast.error(`Error: ${data.message}`);
      }
     
     
    },
    onMutate: (newUserInfo) => {
      queryClient.setQueryData(['users'], (prevUsers) =>
        prevUsers?.map((prevUser) =>
          prevUser.id === newUserInfo.id ? newUserInfo : prevUser,
        ),
      );
    },
  });
}

function useDeleteUser(refetch) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId) => {
      // const response = await axios.delete(`${API_BASE_URL}/api/deleteUser/`, {
      //   data: { id: userId },
      // });

      const response = await fetch(`${API_BASE_URL}/api/deleteUser/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": getAccessToken(),
        },
        body: JSON.stringify({id: userId})
      });

      const data = await response.json()
      if(response.ok){
        toast.success(`Action Done Successfully`);
      }else{
        toast.error(`Error: ${data.message}`);
      }
    },
    onMutate: (userId) => {
      queryClient.setQueryData(['users'], (prevUsers) =>
        prevUsers?.filter((user) => user.id !== userId),
      );
    },
    onSuccess: () => {
      refetch(); // Trigger a refetch of the data
    },
  });
}

// Soft-delete toggle used by Branch_Management: deactivate blocks login,
// activate restores it. No hard delete.
function useSetUserActive(refetch) {
  return useMutation({
    mutationFn: async ({ id, active }) => {
      const response = await fetch(`${API_BASE_URL}/api/set_user_active/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": getAccessToken(),
        },
        body: JSON.stringify({ id, active }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(active ? "User activated" : "User deactivated");
      } else {
        toast.error(`Error: ${data.message}`);
      }
    },
    onSuccess: () => {
      refetch();
    },
  });
}

const queryClient = new QueryClient();

const ExampleWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <Example />
  </QueryClientProvider>
);

export default ExampleWithProviders;

const validateRequired = (value) => !!String(value ?? '').length;
const validateEmail = (email) =>
  !!String(email ?? '').length &&
  String(email).toLowerCase().match(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  );

function validateUser(user) {
  // The Name column's accessorKey is `user` (not `name`); guard undefined so an
  // edit save never throws and leaves the dialog stuck open.
  const rolesCount = Array.isArray(user.roles) ? user.roles.length : (user.roles ? 1 : 0);
  return {
    user: !validateRequired(user.user) ? 'Name is Required' : '',
    email: !validateEmail(user.email) ? 'Incorrect Email Format' : '',
    roles: rolesCount === 0 ? 'Roles are Required' : '',
  };
}