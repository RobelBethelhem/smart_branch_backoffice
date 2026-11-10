import React from 'react';
import { Paper, Typography, TextField, Chip, Box } from '@mui/material';
import { format, startOfMonth, subDays } from 'date-fns';

// One period for the whole Branch Record screen: the table and both statistics tabs read the
// same From/To, so their figures always describe the same days. Empty = all time.

const day = (date) => format(date, 'yyyy-MM-dd');

const presets = () => {
  const today = new Date();
  return [
    { label: 'Today', start: day(today), end: day(today) },
    { label: 'Last 7 days', start: day(subDays(today, 6)), end: day(today) },
    { label: 'This month', start: day(startOfMonth(today)), end: day(today) },
    { label: 'All time', start: '', end: '' },
  ];
};

const PeriodBar = ({ value, onChange, children }) => (
  <Paper sx={{ p: 2, mb: 2, borderRadius: 3, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Period:</Typography>
    <TextField
      label="From" type="date" size="small" InputLabelProps={{ shrink: true }}
      value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })}
      inputProps={{ max: value.end || undefined }}
    />
    <TextField
      label="To" type="date" size="small" InputLabelProps={{ shrink: true }}
      value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })}
      inputProps={{ min: value.start || undefined }}
    />
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {presets().map((preset) => {
        const active = preset.start === value.start && preset.end === value.end;
        return (
          <Chip
            key={preset.label}
            label={preset.label}
            size="small"
            clickable
            color={active ? 'primary' : 'default'}
            variant={active ? 'filled' : 'outlined'}
            onClick={() => onChange({ start: preset.start, end: preset.end })}
          />
        );
      })}
    </Box>
    {children}
  </Paper>
);

export default PeriodBar;
