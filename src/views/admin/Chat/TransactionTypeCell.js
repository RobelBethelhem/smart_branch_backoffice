import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const TransactionTypeCell = ({ value }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const getTransactionTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'transfer': return '#3498db';
      case 'otherbanktransfer': return '#e74c3c';
      case 'withdraw': return '#f39c12';
      case 'deposit': return '#2ecc71';
      default: return '#95a5a6';
    }
  };

  const getTransactionTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'transfer': return '↔️';
      case 'otherbanktransfer': return '🏦';
      case 'withdraw': return '⬇️';
      case 'deposit': return '⬆️';
      default: return '❓';
    }
  };

  const typeColor = getTransactionTypeColor(value);
  const typeIcon = getTransactionTypeIcon(value);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.5 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        background: typeColor,
        padding: '6px 12px',
        borderRadius: '20px',
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        boxShadow: `0 0 10px ${typeColor}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span>{typeIcon}</span>
      <span>{value}</span>
    </motion.div>
  );
};

export default TransactionTypeCell;