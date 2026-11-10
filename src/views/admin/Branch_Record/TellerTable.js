import React, { useMemo } from 'react';
import {
  Box, Paper, Typography, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import { formatMoney, formatCount, formatDuration } from './recordFormat';

// One row per teller, from the server's `tellerStats`. The rows add up to the branch totals
// shown in the cards above. On a narrow screen the table scrolls sideways inside its card and
// the teller's name stays in view.

const COUNT_COLUMNS = [
  { key: 'total', label: 'Requests', hint: 'Every request this teller was given in the period' },
  { key: 'completed', label: 'Completed', hint: 'Posted to FlexCube: posted, authorized or audited' },
  { key: 'pending', label: 'Pending', hint: 'Still waiting to be served, or waiting for a checker' },
  { key: 'notServed', label: 'Not served', hint: 'Still open after the day of the request. The reference code has expired.', color: 'warning.dark' },
  { key: 'rejected', label: 'Rejected', hint: 'Rejected by a limit check or by the checker' },
  { key: 'awaitingAuthorization', label: 'To authorize', hint: 'Posted by this teller and not yet authorized' },
];

const headSx = { fontWeight: 700, whiteSpace: 'nowrap', bgcolor: '#f4f6f8', color: '#2c3e50' };
const stickySx = { position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' };
const numberSx = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

const Head = ({ label, hint, align = 'right', sx }) => (
  <TableCell align={align} sx={{ ...headSx, ...sx }}>
    <Tooltip title={hint} arrow placement="top">
      <span style={{ cursor: 'help', borderBottom: '1px dotted #90a4ae' }}>{label}</span>
    </Tooltip>
  </TableCell>
);

const TellerTable = ({ tellers = [] }) => {
  const totals = useMemo(() => {
    const sum = (key) => tellers.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
    const handled = tellers.reduce((acc, row) => acc + (row.handlingMinutes?.count || 0), 0);
    const minutes = tellers.reduce((acc, row) => acc + (row.handlingMinutes?.avg || 0) * (row.handlingMinutes?.count || 0), 0);
    return {
      ...Object.fromEntries(COUNT_COLUMNS.map(({ key }) => [key, sum(key)])),
      incomingMoney: sum('incomingMoney'),
      outgoingMoney: sum('outgoingMoney'),
      handled,
      avg: handled > 0 ? minutes / handled : 0,
      max: tellers.reduce((acc, row) => Math.max(acc, row.handlingMinutes?.max || 0), 0),
    };
  }, [tellers]);

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 1 }}>
        <PeopleIcon /> Teller Detail
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A request counts for the teller who posted it or, until it is posted, the teller it is assigned to.
        Money counts completed requests only.
      </Typography>

      {tellers.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No requests in this period</Box>
      ) : (
        <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headSx, ...stickySx, bgcolor: '#f4f6f8', zIndex: 2 }}>Teller</TableCell>
                {COUNT_COLUMNS.map((column) => <Head key={column.key} label={column.label} hint={column.hint} />)}
                <Head label="Money in" hint="Completed deposits and transfers into this branch" />
                <Head label="Money out" hint="Completed withdrawals, e-cheques, other-bank transfers and transfers out" />
                <Head label="Avg time" hint="Average time from assignment to posting" />
                <Head label="Longest" hint="Longest time from assignment to posting" />
              </TableRow>
            </TableHead>
            <TableBody>
              {tellers.map((row) => (
                <TableRow key={row.teller} hover>
                  <TableCell sx={{ ...stickySx, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.teller}</TableCell>
                  {COUNT_COLUMNS.map(({ key, color }) => (
                    <TableCell key={key} align="right" sx={{ ...numberSx, ...(color && row[key] > 0 ? { color, fontWeight: 700 } : {}) }}>
                      {formatCount(row[key])}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ ...numberSx, color: '#1e8449' }}>{formatMoney(row.incomingMoney)}</TableCell>
                  <TableCell align="right" sx={{ ...numberSx, color: '#c0392b' }}>{formatMoney(row.outgoingMoney)}</TableCell>
                  <TableCell align="right" sx={numberSx}>{row.handlingMinutes?.count ? formatDuration(row.handlingMinutes.avg) : '—'}</TableCell>
                  <TableCell align="right" sx={numberSx}>{row.handlingMinutes?.count ? formatDuration(row.handlingMinutes.max) : '—'}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ ...stickySx, ...headSx }}>Total</TableCell>
                {COUNT_COLUMNS.map(({ key }) => (
                  <TableCell key={key} align="right" sx={{ ...headSx, ...numberSx }}>{formatCount(totals[key])}</TableCell>
                ))}
                <TableCell align="right" sx={{ ...headSx, ...numberSx }}>{formatMoney(totals.incomingMoney)}</TableCell>
                <TableCell align="right" sx={{ ...headSx, ...numberSx }}>{formatMoney(totals.outgoingMoney)}</TableCell>
                <TableCell align="right" sx={{ ...headSx, ...numberSx }}>{totals.handled ? formatDuration(totals.avg) : '—'}</TableCell>
                <TableCell align="right" sx={{ ...headSx, ...numberSx }}>{totals.handled ? formatDuration(totals.max) : '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default TellerTable;
