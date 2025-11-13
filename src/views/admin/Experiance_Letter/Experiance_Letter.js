import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Divider,
  Avatar,
  IconButton,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import {
  AccountBalance as BankIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';

// Add print-specific styles
const printStyles = `
  @media print {
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
  }
`;

const InfiniteScrollText = ({ text }) => {
  const controls = useAnimationControls();
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    const textElement = document.createElement('span');
    textElement.style.visibility = 'hidden';
    textElement.style.position = 'absolute';
    textElement.style.whiteSpace = 'nowrap';
    textElement.innerText = text;
    document.body.appendChild(textElement);
    setTextWidth(textElement.offsetWidth);
    document.body.removeChild(textElement);
  }, [text]);

  useEffect(() => {
    if (containerWidth > 0 && textWidth > 0) {
      controls.start({
        x: [-textWidth, containerWidth],
        transition: {
          duration: 20,
          ease: "linear",
          repeat: Infinity,
        },
      });
    }
  }, [controls, containerWidth, textWidth]);

  return (
    <div ref={containerRef} className="scroll-container" style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
      <motion.div
        animate={controls}
        style={{ display: 'inline-block' }}
      >
        <span>{text}</span>
      </motion.div>
    </div>
  );
};

const formatDateTime = (dateString) => {
  try {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};

const formatAmount = (amount) => {
  if (!amount) return 'N/A';
  return Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'ETB',
  });
};

const renderImage = (base64String, altText) => {
  const imageData = base64String.includes('data:image')
    ? base64String
    : `data:image/jpeg;base64,${base64String}`;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        mb: 4,
        mt: 2,
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <img
          src={imageData}
          alt={altText}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onClick={() => handleImageClick(imageData)}
        />
      </Box>
    </Box>
  );
};

const Experiance_Letter = () => {
  const location = useLocation();
  const rowData = location.state?.rowData;
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    // Add print styles
    const style = document.createElement('style');
    style.innerHTML = printStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
  };

  if (!rowData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '400px' }}
      >
        <Typography variant="h5">No data available</Typography>
      </motion.div>
    );
  }

  const renderLetterTemplate = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          {/* Header Section */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <BankIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            </motion.div>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Zemen Bank
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Transaction Receipt
            </Typography>
          </Box>

          {/* Profile Image Section */}
          {rowData.profile_image && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {renderImage(rowData.profile_image, 'Profile Image')}
            </motion.div>
          )}

          {/* Transaction Details */}
          <Grid container spacing={3}>
            {/* Transaction Info */}
            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Paper elevation={2} sx={{ p: 3, height: '100%', bgcolor: 'background.default' }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimeIcon /> Transaction Details
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body1" gutterBottom>
                      <strong>Date:</strong> {formatDateTime(rowData.request_date)}
                    </Typography>
                    {rowData.trn_ref_no && (
                      <Typography variant="body1" gutterBottom>
                        <strong>Transaction ID:</strong> {rowData.trn_ref_no}
                      </Typography>
                    )}
                    <Typography variant="body1" gutterBottom>
                      <strong>Type:</strong> {rowData.request_type || 'N/A'}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Amount:</strong> {formatAmount(rowData.amount_in_figures)}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Status:</strong> 
                      <Box component="span" sx={{
                        ml: 1,
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: rowData.status === 'authorized' ? 'success.light' : 'warning.light',
                        color: rowData.status === 'authorized' ? 'success.dark' : 'warning.dark',
                      }}>
                        {rowData.status || 'N/A'}
                      </Box>
                    </Typography>
                  </Box>
                </Paper>
              </motion.div>
            </Grid>

            {/* Account Info */}
            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Paper elevation={2} sx={{ p: 3, height: '100%', bgcolor: 'background.default' }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon /> Account Information
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {rowData.acc_holder_name && (
                      <Typography variant="body1" gutterBottom>
                        <strong>Account Holder:</strong> {rowData.acc_holder_name}
                      </Typography>
                    )}
                    {rowData.account_number && (
                      <Typography variant="body1" gutterBottom>
                        <strong>Account Number:</strong> {rowData.account_number}
                      </Typography>
                    )}
                    {rowData.branch_name && (
                      <Typography variant="body1" gutterBottom>
                        <strong>Branch:</strong> {rowData.branch_name}
                      </Typography>
                    )}
                    {/* Show beneficiary details only for transfer transactions */}
                    {rowData.request_type?.toLowerCase() === 'transfer' && (
                      <>
                        {rowData.beneficiary_account_number && (
                          <Typography variant="body1" gutterBottom>
                            <strong>Beneficiary Account:</strong> {rowData.beneficiary_account_number}
                          </Typography>
                        )}
                        {rowData.beneficiary_name && (
                          <Typography variant="body1" gutterBottom>
                            <strong>Beneficiary Name:</strong> {rowData.beneficiary_name}
                          </Typography>
                        )}

                      

                      </>
                    )}


                  {rowData.request_type?.toLowerCase() === 'other_bank_transfer' && (
                      <>
                        {rowData.beneficiary_account_number && (
                          <Typography variant="body1" gutterBottom>
                            <strong>Beneficiary Account:</strong> {rowData.beneficiary_account_number}
                          </Typography>
                        )}
                        {rowData.beneficiary_name && (
                          <Typography variant="body1" gutterBottom>
                            <strong>Beneficiary Name:</strong> {rowData.beneficiary_name}
                          </Typography>
                        )}

{rowData.beneficiary_bank && (
                          <Typography variant="body1" gutterBottom>
                            <strong>Beneficiary Bank:</strong> {rowData.beneficiary_bank}
                          </Typography>
                        )}

                        {rowData.beneficiary_branch && (
                          <Typography variant="body1" gutterBottom>
                            <strong>Beneficiary Branch:</strong> {rowData.beneficiary_branch}
                          </Typography>
                        )}



                      </>
                    )}


                  </Box>
                </Paper>
              </motion.div>
            </Grid>
          </Grid>

          {/* Signature Section */}
          {rowData.signature && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Paper elevation={2} sx={{ mt: 3, p: 3, bgcolor: 'background.default' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Digital Signature
                </Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/jpeg;base64,${rowData.signature}`}
                    alt="Digital Signature"
                    style={{ maxWidth: '100%', height: 'auto', cursor: 'pointer' }}
                    onClick={() => handleImageClick(`data:image/jpeg;base64,${rowData.signature}`)}
                  />
                </Box>
              </Paper>
            </motion.div>
          )}
        </Paper>
      </motion.div>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="container mt-4"
      >
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
          <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            {rowData.request_type} Details
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => window.print()}
            startIcon={<PrintIcon />}
            sx={{ borderRadius: 2 }}
          >
            Print
          </Button>
        </Box>
        {renderLetterTemplate()}
      </motion.div>

      {/* Image Modal */}
      <AnimatePresence>
        {isImageModalOpen && (
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
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
            onClick={() => setIsImageModalOpen(false)}
            className="no-print"
          >
            <motion.img
              src={selectedImage}
              alt="Full Size"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              style={{
                maxWidth: '90%',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default Experiance_Letter;



