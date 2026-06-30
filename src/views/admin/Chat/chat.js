import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CCard,
  CCardBody,
  CInputGroup,
  CFormInput,
  CButton,
  CContainer,
} from '@coreui/react';
import { CgSearch } from 'react-icons/cg';
import { MaterialReactTable } from 'material-react-table';
import './SearchComponent.css';
import { X as CloseIcon } from 'lucide-react';
import { Box, Paper, Typography, Button, IconButton } from '@mui/material';

import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from 'src/config/api';

const TransactionTypeCell = ({ value }) => {
  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'transfer': return '#3498db';
      case 'otherbanktransfer': return '#e74c3c';
      case 'withdraw': return '#f39c12';
      case 'deposit': return '#2ecc71';
      default: return '#95a5a6';
    }
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      style={{
        background: getTypeColor(value),
        padding: '6px 12px',
        borderRadius: '20px',
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 'fit-content'
      }}
    >
      {value}
    </motion.div>
  );
};

// Define the getInitialPosition function
const getInitialPosition = (direction) => {
  switch (direction) {
    case 'top':
      return { y: -20, x: 0 };
    case 'right':
      return { x: 20, y: 0 };
    case 'bottom':
      return { y: 20, x: 0 };
    case 'left':
      return { x: -20, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
};

const DetailPanel = ({ isOpen, onClose, data, entranceDirection }) => {
  const typeColor = '#3498db';
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);

  // Format date function
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return dateString;
      
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const formattedTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      return dateString;
    }
  };

  // Format amount function
  const formatAmount = (amount) => {
    try {
      return Number(amount).toLocaleString('en-US');
    } catch (error) {
      return amount;
    }
  };

  // Render signature function
  const renderSignature = (base64String) => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          p: 2,
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 2,
          bgcolor: 'background.paper'
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Digital Signature
        </Typography>
        <Box
          sx={{
            maxWidth: '200px',
            width: '100%',
            p: 2,
            bgcolor: 'white',
            borderRadius: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <img
            src={`data:image/jpeg;base64,${base64String}`}
            alt="Signature"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </Box>
      </Box>
    );
  };

  // Format object function
  const formatObjectValue = (obj) => {
    try {
      const parsedObj = typeof obj === 'string' ? JSON.parse(obj) : obj;

      return (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            p: 2,
          }}
        >
          {Object.entries(parsedObj).map(([key, value], index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    transform: 'translateX(8px)',
                    transition: 'all 0.3s ease'
                  }
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      textTransform: 'capitalize',
                      fontWeight: 500
                    }}
                  >
                    {key.replace(/_/g, ' ')}:
                  </Typography>
                  {key === 'telephone' ? (
                    <Typography
                      component="a"
                      href={`tel:${value}`}
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      {value}
                    </Typography>
                  ) : (
                    <Typography 
                      variant="body1"
                      sx={{ 
                        fontWeight: 'medium',
                        color: 'text.primary',
                        textTransform: 'capitalize'
                      }}
                    >
                      {value}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </motion.div>
          ))}
        </Box>
      );
    } catch (error) {
      return String(obj);
    }
  };

  // Format value function
  const formatValue = (value, key) => {
    if (value === null || value === undefined) return '-';

    // Handle dates
    if (key.toLowerCase().includes('date') || 
        key === 'TimeStamp' || 
        key === 'request_date') {
      return formatDateTime(value);
    }

    // Handle amounts
    if (key === 'amount_in_figures') {
      return formatAmount(value);
    }

    // Handle signature
    if (key === 'signature') {
      return renderSignature(value);
    }

    // Handle objects (including address)
    if (typeof value === 'object' || 
        (typeof value === 'string' && value.startsWith('{'))) {
      return formatObjectValue(value);
    }

    return String(value);
  };

  // Animation variants
  const getAnimationVariants = () => {
    switch (entranceDirection) {
      case 1:
        return {
          initial: { x: '-100%', opacity: 0 },
          animate: { 
            x: 0, 
            opacity: 1,
            transition: {
              type: "spring",
              stiffness: 100,
              damping: 20
            }
          },
          exit: { 
            x: '-100%', 
            opacity: 0,
            transition: { 
              duration: 0.3,
              ease: "easeInOut"
            }
          },
          style: {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '75%',
            height: '100%',
            backgroundColor: 'white',
            boxShadow: '10px 0 40px rgba(0,0,0,0.2)',
            zIndex: 9999,
            overflow: 'hidden'
          }
        };
      case 2:
        return {
          // ... same as case 1 but with right side animations
          initial: { x: '100%', opacity: 0 },
          animate: { 
            x: 0, 
            opacity: 1,
            transition: {
              type: "spring",
              stiffness: 100,
              damping: 20
            }
          },
          exit: { 
            x: '100%', 
            opacity: 0,
            transition: { 
              duration: 0.3,
              ease: "easeInOut"
            }
          },
          style: {
            position: 'fixed',
            top: '0',
            right: '0',
            width: '75%',
            height: '100%',
            backgroundColor: 'white',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
            zIndex: 9999,
            overflow: 'hidden'
          }
        };
      default:
        return null;
    }
  };

  const variants = getAnimationVariants();

  // Add new render function for profile image
  const renderProfileImage = (base64String) => {
    // Remove the data:image/jpeg;base64, prefix if it exists in the string
    const imageData = base64String.includes('data:image') 
      ? base64String 
      : `data:image/jpeg;base64,${base64String}`;

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 4,
          mt: 2
        }}
      >
        <Box
          sx={{
            width: 300,
            height: 300,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '4px solid',
            borderColor: 'primary.main',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <img
            src={imageData}
            alt="Profile"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </Box>
      </Box>
    );
  };

  // Add this new component for the full-screen modal
  const SignatureModal = ({ isOpen, onClose, imageData }) => {
    if (!isOpen) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        
        <motion.img
          src={imageData}
          alt="Signature Full View"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          style={{
            maxWidth: '90%',
            maxHeight: '80vh',
            objectFit: 'contain',
            cursor: 'auto'
          }}
        />
      </motion.div>
    );
  };

  // Modify the renderSignatureComparison function
  const renderSignatureComparison = (signature, signImage) => {
    const signatureData = signature?.includes('data:image') 
      ? signature 
      : `data:image/jpeg;base64,${signature}`;
    
    const signImageData = signImage?.includes('data:image') 
      ? signImage 
      : `data:image/jpeg;base64,${signImage}`;

    const handleSignatureClick = (imageData) => {
      setSelectedSignature(imageData);
      setIsSignatureModalOpen(true);
    };

    return (
      <>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            p: 3,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          {/* Digital Signature */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography variant="subtitle1" color="primary.main" fontWeight="bold">
              Digital Signature
            </Typography>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                width: '100%',
                maxWidth: 300,
                bgcolor: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.02)'
                }
              }}
              onClick={() => handleSignatureClick(signatureData)}
            >
              <img
                src={signatureData}
                alt="Digital Signature"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </Paper>
          </Box>

          {/* Uploaded Signature */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography variant="subtitle1" color="primary.main" fontWeight="bold">
              Uploaded Signature
            </Typography>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                width: '100%',
                maxWidth: 300,
                bgcolor: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.02)'
                }
              }}
              onClick={() => handleSignatureClick(signImageData)}
            >
              <img
                src={signImageData}
                alt="Uploaded Signature"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </Paper>
          </Box>
        </Box>

        {/* Signature Modal */}
        <AnimatePresence>
          <SignatureModal
            isOpen={isSignatureModalOpen}
            onClose={() => setIsSignatureModalOpen(false)}
            imageData={selectedSignature}
          />
        </AnimatePresence>
      </>
    );
  };

  // Render component
  return (
    <AnimatePresence>
      {isOpen && variants && (
        <motion.div
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          style={variants.style}
        >
          <motion.div
            className="panel-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              padding: '32px',
              height: '100%',
              overflow: 'auto',
              backgroundColor: '#f5f5f5' // Light gray background
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '32px',
              borderBottom: '3px solid',
              borderColor: 'primary.main',
              paddingBottom: '16px'
            }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 'bold',
                  color: 'primary.main'
                }}
              >
                Transaction Details
              </Typography>
              <IconButton 
                onClick={onClose}
                sx={{
                  backgroundColor: 'primary.light',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Profile Image */}
            {data.profile_image && renderProfileImage(data.profile_image)}

            {/* Signature Comparison */}
            {data.signature && data.sign_image && (
              renderSignatureComparison(data.signature, data.sign_image)
            )}

            <Box sx={{ 
              display: 'grid', 
              gap: '24px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
            }}>
              {Object.entries(data).map(([key, value]) => {
                // Skip rendering these fields as they're handled separately
                if (['profile_image', 'signature', 'sign_image'].includes(key)) return null;
                
                return (
                  <Paper
                    key={key}
                    elevation={1}
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      backgroundColor: 'white',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3
                      }
                    }}
                  >
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'primary.main',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        mb: 2,
                        display: 'block',
                        borderBottom: '2px solid',
                        borderColor: 'primary.light',
                        pb: 1
                      }}
                    >
                      {key.replace(/_/g, ' ')}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      {formatValue(value, key)}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const SearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [letters, setLetters] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [entranceDirection, setEntranceDirection] = useState(1);
  const [rowSelection, setRowSelection] = useState({});
  const accessToken = useSelector((state) => state.user.accessToken);
  const userRole = useSelector((state) => state.user.role)

  // NOTE: the previous mount-time fetchData() was removed. The results table is
  // hidden until the user clicks Search (showTable), and Search re-fetches with
  // the query — so the eager mount fetch downloaded the full transactions list
  // on the post-login landing page for every user without ever displaying it.

  useEffect(() => {
    const newLetters = searchTerm.split('').map((char, index) => ({
      char,
      id: `${char}-${index}-${Date.now()}`,
      direction: ['top', 'right', 'bottom', 'left'][index % 4],
    }));
    setLetters(newLetters);
  }, [searchTerm]);

  // const fetchData = async (query = '') => {
  //   try {
  //     const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/transactions${query ? `?query=${query}` : ''}`);
  //     const result = await response.json();
  //     setData(result);
  //     setFilteredData(result);
  //   } catch (error) {
  //     console.error('Error fetching data:', error);
  //   }
  // };



  const fetchData = async (query = '') => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/transactions${query ? `?query=${query}` : ''}`, {
            method: 'GET', // Specify the method if needed
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': accessToken, // Ensure accessToken is defined in your scope
            },
        });

        // Check if the response is OK (status in the range 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
        setFilteredData(result);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};




  const handleSearch = () => {
    fetchData(searchTerm);
    setShowTable(true);
  };

  const handleOpenDetail = useCallback((data) => {
    const randomDirection = Math.floor(Math.random() * 2) + 1;
    setEntranceDirection(randomDirection);
    setSelectedDetail(data); // show immediately (transaction fields + signature)
    // Fetch customer images on demand — kept OFF the high-traffic search path,
    // which no longer returns profile_image/sign_image.
    if (data?.account_number) {
      fetch(`${API_BASE_URL}/api/zsmart_branch_requests/account_images/${encodeURIComponent(data.account_number)}`, {
        headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken },
      })
        .then((r) => r.json())
        .then((json) => {
          if (!json.error && json.data) {
            setSelectedDetail((prev) => (prev && prev._id === data._id ? { ...prev, ...json.data } : prev));
          }
        })
        .catch(() => {});
    }
  }, [accessToken]);

  const handleAssignToMe = async () => {
    try {
      const selectedRows = Object.keys(rowSelection).map(index => {
        const row = filteredData.transactions[parseInt(index)];
        return {
          id: row._id || row.id,
          transactionType: row.request_type
        };
      });

      const payload = {
        transactions: selectedRows
      };

      const response = await fetch(`${API_BASE_URL}/api/zsmart_branch_requests/assigned_to_me`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken,
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setRowSelection({});
        fetchData();
        toast.success('Successfully assigned transactions!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign transactions');
      }
    } catch (error) {
      console.error('Error assigning transactions:', error);
      toast.error(error.message || 'Failed to assign transactions', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'request_type',
      header: 'Request Type',
      Cell: ({ cell, row }) => (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: '#3498db',
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
    {
      accessorKey: 'account_number',
      header: 'Account Number',
    },
    {
      accessorKey: 'acc_holder_name',
      header: 'Account Holder Name',
    },
    {
      accessorKey: 'amount_in_figures',
      header: 'Amount',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      Cell: ({ cell }) => (
        <div
          style={{
            backgroundColor: cell.getValue() === 'requested' ? '#e3f2fd' : '#e8f5e9',
            borderRadius: '20px',
            padding: '6px 12px',
            width: 'fit-content',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: cell.getValue() === 'requested' ? '#1976d2' : '#2e7d32'
          }}
        >
          {cell.getValue()}
        </div>
      ),
    }
  ], [handleOpenDetail]);

  return (
    <CContainer className="search-wrapper">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="search-container"
      >
        <CCard className="glass-card">
          <CCardBody className="p-4">
            <motion.h2 
              className="text-center mb-4 search-title"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ 
                scale: [1, 1.35, 1], 
                opacity: [1, 0.8, 1] 
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut"
              }}
            >
              Search Transactions
            </motion.h2>
            
            <CInputGroup className="search-input-group">
              <motion.div
                className="input-container"
                animate={{
                  scale: 1.02,
                  boxShadow: "0 0 30px rgba(0,123,255,0.3)"
                }}
                transition={{ 
                  duration: 0.3,
                  type: "spring",
                  stiffness: 300
                }}
              >
                <div className="input-wrapper">
                  <CFormInput
                    className="custom-input"
                    placeholder="Transaction Number, Account Number, or Account Holder Name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="floating-letters">
                    <AnimatePresence>
                      {letters.map(({ char, id, direction }) => (
                        <motion.span
                          key={id}
                          className="floating-letter"
                          initial={getInitialPosition(direction)}
                          animate={{ x: 0, y: 0, opacity: 0 }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{
                            type: "spring",
                            damping: 10,
                            stiffness: 200,
                            mass: 0.8
                          }}
                        >
                          {char}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
              
              <CButton
                color="primary"
                type="button"
                onClick={handleSearch}
                className="search-button"
                as={motion.button}
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 0 25px rgba(0,123,255,0.5)"
                }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="button-content"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <CgSearch className="search-icon" />
                  <span>Search</span>
                </motion.div>
              </CButton>
            </CInputGroup>
          </CCardBody>
        </CCard>
      </motion.div>

      {/* Table Section */}
      <AnimatePresence>
        {showTable && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="table-container mt-4"
          >
            <CCard className="glass-card">
              <CCardBody>
                <MaterialReactTable
                  columns={columns}
                  data={filteredData.transactions || []}
                  enableRowSelection={(row) => userRole ==="Teller"? row.original.status === 'requested' && row.original.request_type.toLowerCase() !== "other_bank_transfer": userRole === "Maker"? row.original.status === 'requested' && row.original.request_type.toLowerCase() === "other_bank_transfer":row.original.status === 'requested'}
                  enableColumnFiltering
                  enableSorting
                  enableTopToolbar
                  enableBottomToolbar
                  enablePagination
                  muiTableBodyRowProps={{ hover: true }}
                  enableFullScreenToggle={false}
                  onRowSelectionChange={setRowSelection}
                  state={{ rowSelection }}
                  renderTopToolbarCustomActions={({ table }) => {
                    const selectedRows = Object.keys(rowSelection).length;
                    
                    return (
                      <>
                        {selectedRows > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                          >
                            <Button
                              color="primary"
                              variant="contained"
                              onClick={handleAssignToMe}
                              startIcon={<AssignmentIndIcon />}
                              sx={{
                                backgroundColor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: 'primary.dark',
                                },
                                transition: 'all 0.3s ease',
                              }}
                            >
                              Assign {selectedRows} Transaction{selectedRows > 1 ? 's' : ''} to Me
                            </Button>
                          </motion.div>
                        )}
                      </>
                    );
                  }}
                />
              </CCardBody>
            </CCard>
          </motion.div>
        )}
      </AnimatePresence>

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
        theme="light"
      />
    </CContainer>
  );
};

export default SearchComponent;