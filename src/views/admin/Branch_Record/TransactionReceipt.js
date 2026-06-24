import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
// Import the brand PNG directly (same logo shown in the sidebar) so Vite
// fingerprints and emits it — guarantees it renders/prints in production
// builds, unlike the bare string path which only resolves in dev.
import logoImg from 'src/assets/brand/zb.png';

// ===========================================================================
// Professional half-page bank receipt for Branch Record transactions.
//  - Reuses the sidebar logo (src/assets/brand/logo)
//  - NO customer photo / signature images (intentionally excluded)
//  - Designed to print only the receipt content (not the whole app page)
//  - Multiple selected transactions print together, one receipt each
// ===========================================================================

const BRAND = '#0b3d6b';
const BRAND_LIGHT = '#10487e';

// Print isolation: hide everything on the page except the receipt print root.
// All print rules are scoped under `body.receipt-printing`, which is only set
// while an intentional receipt print is in progress — so a normal Ctrl+P
// elsewhere on the page still prints the page as usual.
// Each receipt is kept on a single page fragment (page-break-inside: avoid),
// so multiple selected receipts flow ~2 per A4 page.
const PRINT_STYLE_ID = 'branch-receipt-print-style';
const PRINTING_CLASS = 'receipt-printing';
const PRINT_CSS = `
  .receipt-print-root { position: fixed; left: -100000px; top: 0; }
  @media print {
    body.receipt-printing * { visibility: hidden !important; }
    body.receipt-printing .receipt-print-root,
    body.receipt-printing .receipt-print-root * { visibility: visible !important; }
    body.receipt-printing .receipt-print-root {
      position: absolute !important;
      left: 0 !important; top: 0 !important;
      width: 100%; margin: 0; padding: 0;
    }
    body.receipt-printing .receipt-no-print { display: none !important; }
    body.receipt-printing .receipt-card {
      page-break-inside: avoid;
      break-inside: avoid;
      box-shadow: none !important;
      margin: 0 auto 8mm auto !important;
    }
    @page { size: A4 portrait; margin: 10mm; }
    body.receipt-printing, body.receipt-printing .receipt-print-root {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

const formatDateTime = (dateString) => {
  try {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatAmount = (amount, currency = 'ETB') => {
  const num = Number(amount);
  if (isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Mask an account number, keeping only the last 4 digits visible.
// e.g. "1000123456789" -> "•••••••••6789". Short values (<=4) are left as-is
// since there is nothing meaningful left to reveal once masked.
const maskAccountNumber = (acc) => {
  if (acc === null || acc === undefined || acc === '') return acc;
  const str = String(acc).trim();
  if (str.length <= 4) return str;
  return '•'.repeat(str.length - 4) + str.slice(-4);
};

// --- Number to words (for the legal "amount in words" line on the receipt) ---
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

const threeDigitsToWords = (n) => {
  let str = '';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) str += `${ONES[hundreds]} Hundred`;
  if (rest) {
    if (str) str += ' ';
    if (rest < 20) {
      str += ONES[rest];
    } else {
      str += TENS[Math.floor(rest / 10)];
      if (rest % 10) str += `-${ONES[rest % 10]}`;
    }
  }
  return str;
};

const numberToWords = (value) => {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const groups = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  let words = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const chunk = threeDigitsToWords(groups[i]);
    words += (words ? ' ' : '') + chunk + (SCALES[i] ? ` ${SCALES[i]}` : '');
  }
  return words.trim();
};

// "1250.50" -> "One Thousand Two Hundred Fifty Birr and Fifty Cents Only"
const amountToWords = (amount, currency = 'ETB') => {
  const num = Number(amount);
  if (isNaN(num)) return '';
  const currencyName = currency === 'ETB' ? 'Birr' : currency;
  const whole = Math.floor(num);
  const cents = Math.round((num - whole) * 100);
  const parts = [];
  if (whole > 0) parts.push(`${numberToWords(whole)} ${currencyName}`);
  if (cents > 0) parts.push(`${numberToWords(cents)} Cent${cents > 1 ? 's' : ''}`);
  if (parts.length === 0) parts.push(`Zero ${currencyName}`);
  return `${parts.join(' and ')} Only`;
};

const Field = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 9.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: '#111827', fontWeight: 600, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
};

// A single professional receipt card.
export const TransactionReceipt = ({ tx = {}, branchCode }) => {
  const type = tx.transactionType || tx.request_type || tx.transaction_type || 'Transaction';
  const currency = tx.currency || 'ETB';
  const refNo = tx.trn_ref_no || tx._id || '—';
  const isTransfer = String(type).toLowerCase().includes('transfer');
  const printedAt = formatDateTime(new Date().toISOString());

  return (
    <div
      className="receipt-card"
      style={{
        width: '100%',
        maxWidth: 720,
        margin: '0 auto 20px auto',
        background: '#ffffff',
        border: '1px solid #d8dee6',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#111827',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_LIGHT} 100%)`,
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logoImg} alt="Bank logo" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1.1 }}>
              ZEMEN BANK
            </div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Transaction Receipt</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Status
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
            {tx.status || '—'}
          </div>
        </div>
      </div>

      {/* Reference / date strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 20px',
          background: '#f3f6fa',
          borderBottom: '1px solid #e5e9f0',
          fontSize: 11,
        }}
      >
        <span>
          <strong style={{ color: BRAND }}>Ref No:</strong> {refNo}
        </span>
        <span>
          <strong style={{ color: BRAND }}>Date:</strong> {formatDateTime(tx.posted_date || tx.request_date)}
        </span>
      </div>

      {/* Amount highlight */}
      <div
        style={{
          margin: '14px 20px 0 20px',
          padding: '12px 16px',
          background: '#f0f6ff',
          border: `1px solid ${BRAND}22`,
          borderLeft: `4px solid ${BRAND}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {type}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Amount</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: BRAND }}>
          {formatAmount(tx.amount_in_figures, currency)}
        </div>
      </div>

      {/* Amount in words */}
      {tx.amount_in_figures !== null && tx.amount_in_figures !== undefined && tx.amount_in_figures !== '' && (
        <div
          style={{
            margin: '8px 20px 0 20px',
            padding: '6px 12px',
            background: '#fafbfc',
            border: '1px solid #eef1f5',
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 9.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Amount in words:{' '}
          </span>
          <span style={{ fontSize: 11.5, color: '#111827', fontWeight: 600, fontStyle: 'italic' }}>
            {amountToWords(tx.amount_in_figures, currency)}
          </span>
        </div>
      )}

      {/* Details grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 24px',
          padding: '14px 20px 6px 20px',
        }}
      >
        <Field label="Account Holder" value={tx.acc_holder_name} />
        <Field label="Account Number" value={maskAccountNumber(tx.account_number)} />
        <Field label="Branch" value={tx.branch_name || branchCode} />
        {/* Posted By falls back to the assigned teller — the assigned user is the
            one who posts the transaction, so for records saved before posted_by
            was captured, assigned_to is the correct poster. */}
        <Field label="Posted By" value={tx.posted_by || tx.assigned_to} />
        <Field label="Request Date" value={tx.request_date ? formatDateTime(tx.request_date) : null} />
        <Field label="Posted Date" value={tx.posted_date ? formatDateTime(tx.posted_date) : null} />
      </div>

      {/* Beneficiary block for transfers */}
      {isTransfer && (tx.beneficiary_account_number || tx.beneficiary_name) && (
        <div style={{ padding: '0 20px 6px 20px' }}>
          <div
            style={{
              fontSize: 10,
              color: BRAND,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              borderTop: '1px dashed #d8dee6',
              paddingTop: 8,
              marginBottom: 6,
            }}
          >
            Beneficiary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
            <Field label="Beneficiary Name" value={tx.beneficiary_name} />
            <Field label="Beneficiary Account" value={maskAccountNumber(tx.beneficiary_account_number)} />
            <Field label="Beneficiary Bank" value={tx.beneficiary_bank} />
            <Field label="Beneficiary Branch" value={tx.beneficiary_branch} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '10px 20px 14px 20px',
          marginTop: 6,
          borderTop: '1px solid #e5e9f0',
        }}
      >
        <div style={{ fontSize: 9.5, color: '#9ca3af', maxWidth: '60%' }}>
          This is a system-generated receipt and does not require a signature.
          <br />
          Printed on {printedAt}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 160, borderTop: '1px solid #9ca3af', marginBottom: 4 }} />
          <div style={{ fontSize: 9.5, color: '#6b7280' }}>Authorized Signature &amp; Stamp</div>
        </div>
      </div>
    </div>
  );
};

// Dialog that previews all selected receipts and prints them together.
export const ReceiptPreviewDialog = ({ open, onClose, transactions = [], branchCode }) => {
  useEffect(() => {
    if (document.getElementById(PRINT_STYLE_ID)) return undefined;
    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.innerHTML = PRINT_CSS;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(PRINT_STYLE_ID);
      if (el) document.head.removeChild(el);
    };
  }, []);

  const handlePrint = () => {
    const cleanup = () => {
      document.body.classList.remove(PRINTING_CLASS);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.classList.add(PRINTING_CLASS);
    window.print();
    // Fallback cleanup for browsers that don't reliably fire `afterprint`.
    setTimeout(cleanup, 1000);
  };
  const count = transactions.length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <Box
          className="receipt-no-print"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            background: BRAND,
            color: 'white',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Receipt Preview {count > 1 ? `(${count} transactions)` : ''}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent dividers sx={{ bgcolor: '#eef2f7' }}>
          {count === 0 ? (
            <Typography sx={{ textAlign: 'center', py: 4 }}>No transactions selected.</Typography>
          ) : (
            transactions.map((tx) => (
              <TransactionReceipt key={tx._id || tx.trn_ref_no} tx={tx} branchCode={branchCode} />
            ))
          )}
        </DialogContent>
        <DialogActions className="receipt-no-print" sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
          <Button
            onClick={handlePrint}
            variant="contained"
            startIcon={<PrintIcon />}
            disabled={count === 0}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
          >
            Print {count > 1 ? `All (${count})` : 'Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Off-screen print root (portaled to body so no transformed/overflow
          ancestor can clip it). Only this prints, via @media print rules.
          Rendered only while the dialog is open so a stale selection can never
          be printed by an unrelated Ctrl+P. */}
      {open &&
        createPortal(
          <div className="receipt-print-root" aria-hidden="true">
            {transactions.map((tx) => (
              <TransactionReceipt key={`print-${tx._id || tx.trn_ref_no}`} tx={tx} branchCode={branchCode} />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
};

export default TransactionReceipt;
