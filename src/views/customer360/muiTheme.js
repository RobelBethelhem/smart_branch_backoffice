import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { createTheme } from '@mui/material/styles';

// The Customer 360 settings screens use Material UI controls. This makes them follow the
// backoffice's light / dark switch and the Customer 360 green.
export const useC360Theme = () => {
  const mode = useSelector((state) => state.theme) === 'dark' ? 'dark' : 'light';
  return useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: mode === 'dark' ? '#4ccb87' : '#17804a' },
          ...(mode === 'dark' ? { background: { paper: '#1f262d', default: '#171c21' } } : {}),
        },
        shape: { borderRadius: 10 },
        typography: { fontFamily: 'inherit', button: { textTransform: 'none', fontWeight: 600 } },
      }),
    [mode],
  );
};
