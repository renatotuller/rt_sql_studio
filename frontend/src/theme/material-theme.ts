import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Material Design 3 Color System - Melhorado com cores mais vibrantes e menos branco
const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#1976D2' : '#90CAF9', // Azul Material Design
      light: mode === 'light' ? '#42A5F5' : '#BBDEFB',
      dark: mode === 'light' ? '#1565C0' : '#64B5F6',
      contrastText: mode === 'light' ? '#FFFFFF' : '#0D47A1',
    },
    secondary: {
      main: mode === 'light' ? '#0288D1' : '#4FC3F7', // Azul secundário
      light: mode === 'light' ? '#03A9F4' : '#81D4FA',
      dark: mode === 'light' ? '#0277BD' : '#0288D1',
      contrastText: mode === 'light' ? '#FFFFFF' : '#01579B',
    },
    error: {
      main: mode === 'light' ? '#BA1A1A' : '#F2B8B5',
      light: mode === 'light' ? '#DE3730' : '#F5DAD9',
      dark: mode === 'light' ? '#93000A' : '#CD2C2C',
    },
    warning: {
      main: mode === 'light' ? '#7D5700' : '#FFD54F',
      light: mode === 'light' ? '#A37500' : '#FFE082',
      dark: mode === 'light' ? '#5C3F00' : '#FFB300',
    },
    info: {
      main: mode === 'light' ? '#006874' : '#61D4FF',
      light: mode === 'light' ? '#008F9C' : '#9BE7FF',
      dark: mode === 'light' ? '#004F58' : '#00A8CC',
    },
    success: {
      main: mode === 'light' ? '#006E1C' : '#79DD72',
      light: mode === 'light' ? '#00A32A' : '#A8F5A3',
      dark: mode === 'light' ? '#005014' : '#4CAF50',
    },
    background: {
      default: mode === 'light' ? '#F5F5F6' : '#121212', // Menos branco, mais suave
      paper: mode === 'light' ? '#FFFFFF' : '#1E1E1E', // Mais contraste no dark mode
    },
    text: {
      primary: mode === 'light' ? '#1C1B1F' : '#E6E1E5',
      secondary: mode === 'light' ? '#49454F' : '#CAC4D0',
    },
    divider: mode === 'light' ? 'rgba(28, 27, 31, 0.12)' : 'rgba(230, 225, 229, 0.12)',
    // Adicionar cores customizadas para melhorar visual
    action: {
      active: mode === 'light' ? 'rgba(28, 27, 31, 0.54)' : 'rgba(230, 225, 229, 0.54)',
      hover: mode === 'light' ? 'rgba(28, 27, 31, 0.08)' : 'rgba(230, 225, 229, 0.08)',
      selected: mode === 'light' ? 'rgba(28, 27, 31, 0.12)' : 'rgba(230, 225, 229, 0.12)',
      disabled: mode === 'light' ? 'rgba(28, 27, 31, 0.26)' : 'rgba(230, 225, 229, 0.26)',
    },
  },
  shape: {
    borderRadius: 12, // Material Design 3 uses 12px as default
  },
  typography: {
    fontFamily: [
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 400,
      lineHeight: 1.3,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.6,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      letterSpacing: '0.01071em',
    },
    button: {
      textTransform: 'none', // Material Design 3 doesn't use uppercase
      fontWeight: 500,
      letterSpacing: '0.02857em',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20, // Material Design 3 uses more rounded buttons
          padding: '10px 24px',
          fontSize: '0.875rem',
          fontWeight: 500,
          boxShadow: 'none',
          textTransform: 'none',
          '&:hover': {
            boxShadow: mode === 'light' 
              ? '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)'
              : '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
          },
          '&.MuiButton-contained': {
            boxShadow: mode === 'light'
              ? '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)'
              : '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
          },
        },
        sizeSmall: {
          padding: '6px 16px',
          fontSize: '0.75rem',
          borderRadius: 16,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: mode === 'light'
            ? '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)'
            : '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
          border: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
        },
        elevation1: {
          boxShadow: mode === 'light'
            ? '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)'
            : '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 32,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
          borderBottom: `1px solid ${mode === 'light' ? 'rgba(28, 27, 31, 0.12)' : 'rgba(230, 225, 229, 0.12)'}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: 40,
          fontSize: '0.75rem',
          fontWeight: 500,
        },
      },
    },
  },
});

// Create theme function
export const createMaterialTheme = (mode: PaletteMode) => {
  return createTheme(getDesignTokens(mode));
};

// Default export for light theme
export default createMaterialTheme('light');

