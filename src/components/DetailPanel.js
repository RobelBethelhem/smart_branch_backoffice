import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import { X as CloseIcon } from 'lucide-react';

// Shared transaction detail slide-over panel. Previously this exact file was
// duplicated byte-for-byte under Approval/, Authorize/, Audit/, Reassignment/
// and Branch_Record/. Consolidated into one memoized component to remove the
// redundant bundle weight and eliminate drift between copies.
const DetailPanel = ({ isOpen, onClose, data, entranceDirection }) => {
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);

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
        hour12: true,
      });
      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatAmount = (amount) => {
    try {
      return Number(amount).toLocaleString('en-US');
    } catch (error) {
      return amount;
    }
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
          />
        </Box>
      </Box>
    );
  };

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
            boxShadow: 1,
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
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
                  transform: 'scale(1.02)',
                },
              }}
              onClick={() => handleSignatureClick(signatureData)}
            >
              <img
                src={signatureData}
                alt="Digital Signature"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            </Paper>
          </Box>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
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
                  transform: 'scale(1.02)',
                },
              }}
              onClick={() => handleSignatureClick(signImageData)}
            >
              <img
                src={signImageData}
                alt="Uploaded Signature"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            </Paper>
          </Box>
        </Box>

        <AnimatePresence>
          {isSignatureModalOpen && (
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
                padding: '20px',
              }}
            >
              <IconButton
                onClick={() => setIsSignatureModalOpen(false)}
                sx={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  color: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>

              <motion.img
                src={selectedSignature}
                alt="Signature Full View"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                style={{
                  maxWidth: '90%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  cursor: 'auto',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  const formatNestedObject = (obj) => {
    try {
      const parsedObj = typeof obj === 'string' ? JSON.parse(obj) : obj;

      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Object.entries(parsedObj).map(([key, value]) => (
            <Box
              key={key}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                p: 1.5,
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: 1,
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                  transform: 'translateX(4px)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'capitalize',
                  fontWeight: 500,
                  mb: 0.5,
                }}
              >
                {key.replace(/_/g, ' ')}
              </Typography>
              <Typography
                sx={{
                  color: value ? 'text.primary' : 'text.secondary',
                  fontWeight: value ? 500 : 400,
                }}
              >
                {value || 'Not provided'}
              </Typography>
            </Box>
          ))}
        </Box>
      );
    } catch (error) {
      return String(obj);
    }
  };

  const formatValue = (value, key) => {
    if (value === null || value === undefined) return '-';

    if (key.toLowerCase().includes('date') || key === 'TimeStamp' || key === 'request_date') {
      return formatDateTime(value);
    }

    if (key === 'amount_in_figures') {
      return formatAmount(value);
    }

    if (key === 'signature') {
      return renderSignatureComparison(value);
    }

    if (typeof value === 'object' || (typeof value === 'string' && value.startsWith('{'))) {
      return formatNestedObject(value);
    }

    return String(value);
  };

  const getAnimationVariants = () => {
    switch (entranceDirection) {
      case 1:
        return {
          initial: { x: '-100%', opacity: 0 },
          animate: {
            x: 0,
            opacity: 1,
            transition: {
              type: 'spring',
              stiffness: 100,
              damping: 20,
            },
          },
          exit: {
            x: '-100%',
            opacity: 0,
            transition: {
              duration: 0.3,
              ease: 'easeInOut',
            },
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
            overflow: 'hidden',
          },
        };
      case 2:
        return {
          initial: { x: '100%', opacity: 0 },
          animate: {
            x: 0,
            opacity: 1,
            transition: {
              type: 'spring',
              stiffness: 100,
              damping: 20,
            },
          },
          exit: {
            x: '100%',
            opacity: 0,
            transition: {
              duration: 0.3,
              ease: 'easeInOut',
            },
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
            overflow: 'hidden',
          },
        };
      default:
        return null;
    }
  };

  const variants = getAnimationVariants();

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
              backgroundColor: '#f5f5f5',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px',
                borderBottom: '3px solid',
                borderColor: 'primary.main',
                paddingBottom: '16px',
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  color: 'primary.main',
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
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {data.profile_image && renderImage(data.profile_image, 'Profile Image')}

            {data.signature && data.sign_image && renderSignatureComparison(data.signature, data.sign_image)}

            <Box
              sx={{
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              }}
            >
              {Object.entries(data).map(([key, value]) => {
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
                        boxShadow: 3,
                      },
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
                        pb: 1,
                      }}
                    >
                      {key.replace(/_/g, ' ')}
                    </Typography>
                    <Box sx={{ mt: 2 }}>{formatValue(value, key)}</Box>
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

export default React.memo(DetailPanel);
