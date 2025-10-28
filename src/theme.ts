import { extendTheme } from '@mui/joy/styles';

// Late 90s/Early 2000s Newspaper Theme
export const newspaperTheme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#f5f5f0',
          100: '#e8e8dc',
          200: '#d4d4c8',
          300: '#1a1a1a',
          400: '#0d0d0d',
          500: '#000000', // Classic newspaper black
          600: '#000000',
          700: '#000000',
          800: '#000000',
          900: '#000000',
        },
        neutral: {
          50: '#fafaf8',
          100: '#f5f5f0',
          200: '#e8e8dc',
          300: '#d1d1c3',
          400: '#9a9a8a',
          500: '#6b6b5f',
          600: '#4a4a42',
          700: '#2d2d28',
          800: '#1a1a17',
          900: '#0d0d0c',
        },
        danger: {
          500: '#8B0000', // Dark red for emphasis (like newspaper headlines)
        },
        success: {
          500: '#2d5016', // Dark green
        },
        background: {
          body: '#f9f7f1', // Cream/newsprint color
          surface: '#ffffff',
          level1: '#fefdfb',
          level2: '#f5f3ed',
          level3: '#eeeae0',
        },
        text: {
          primary: '#1a1a1a',
          secondary: '#4a4a42',
          tertiary: '#6b6b5f',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          50: '#000000',
          100: '#1a1a1a',
          200: '#2d2d2d',
          300: '#e8e8e8',
          400: '#f0f0f0',
          500: '#ffffff', // White for dark mode
          600: '#ffffff',
          700: '#ffffff',
          800: '#ffffff',
          900: '#ffffff',
        },
        neutral: {
          50: '#000000',
          100: '#1a1a1a',
          200: '#000000',
          300: '#2d2d2d',
          400: '#4a4a4a',
          500: '#666666',
          600: '#808080',
          700: '#999999',
          800: '#d1d1d1',
          900: '#e8e8e8',
        },
        danger: {
          500: '#d32f2f', // Brighter red for dark mode
        },
        success: {
          500: '#4caf50', // Brighter green for dark mode
        },
        background: {
          body: '#000000', // Pure black
          surface: '#1a1a1a',
          level1: '#000000',
          level2: '#1a1a1a',
          level3: '#2d2d2d',
        },
        text: {
          primary: '#e8e6e0',
          secondary: '#b8b6b0',
          tertiary: '#9a9aa5',
        },
      },
    },
  },
  fontFamily: {
    display: '"Libre Baskerville", "Georgia", "Times New Roman", serif', // Headlines
    body: '"Crimson Text", "Georgia", "Times New Roman", serif', // Body text
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    xl2: '1.5rem',
    xl3: '1.875rem',
    xl4: '2.25rem',
  },
  fontWeight: {
    sm: 400,
    md: 500,
    lg: 600,
    xl: 700,
  },
  lineHeight: {
    sm: 1.4,
    md: 1.6,
    lg: 1.8,
  },
  letterSpacing: {
    sm: '-0.01em',
    md: '0.01em',
    lg: '0.02em',
  },
  shadow: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.2)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
    md: '0 2px 4px rgba(0, 0, 0, 0.4)',
    lg: '0 4px 6px rgba(0, 0, 0, 0.5)',
    xl: '0 8px 12px rgba(0, 0, 0, 0.6)',
  },
  components: {
    JoyButton: {
      styleOverrides: {
        root: {
          borderRadius: '2px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
          fontFamily: '"Libre Baskerville", "Georgia", serif',
        },
      },
    },
    JoyCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '0px',
          border: `2px solid ${theme.palette.mode === 'dark' ? '#000000' : '#1a1a1a'}`,
          boxShadow: 'none',
        }),
      },
    },
    JoyTypography: {
      defaultProps: {
        level: 'body-md',
      },
      styleOverrides: {
        root: {
          fontFamily: '"Crimson Text", "Georgia", serif',
        },
        h1: {
          fontFamily: '"Libre Baskerville", "Georgia", serif',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          textTransform: 'uppercase',
        },
        h2: {
          fontFamily: '"Libre Baskerville", "Georgia", serif',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
        },
        h3: {
          fontFamily: '"Libre Baskerville", "Georgia", serif',
          fontWeight: 600,
          lineHeight: 1.4,
        },
        h4: {
          fontFamily: '"Libre Baskerville", "Georgia", serif',
          fontWeight: 600,
        },
      },
    },
    JoyInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '0px',
          fontFamily: '"Crimson Text", "Georgia", serif',
          backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
          color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          '--Input-focusedHighlight': theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          '& input': {
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          },
          '& input::placeholder': {
            color: theme.palette.mode === 'dark' ? '#999999' : '#666666',
            opacity: 1,
          },
        }),
      },
    },
    JoyTextarea: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '0px',
          fontFamily: '"Crimson Text", "Georgia", serif',
          backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
          color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          '& textarea': {
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          },
          '& textarea::placeholder': {
            color: theme.palette.mode === 'dark' ? '#999999' : '#666666',
            opacity: 1,
          },
        }),
      },
    },
    JoySelect: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '0px',
          fontFamily: '"Crimson Text", "Georgia", serif',
          backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
          color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          '& select': {
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          },
        }),
      },
    },
    JoyFormLabel: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          fontFamily: '"Crimson Text", "Georgia", serif',
          fontWeight: 600,
        }),
      },
    },
    JoyOption: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontFamily: '"Crimson Text", "Georgia", serif',
          color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f0f0f0',
          },
          '&.Mui-selected': {
            backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#e0e0e0',
          },
        }),
      },
    },
    JoySheet: {
      styleOverrides: {
        root: {
          borderRadius: '0px',
        },
      },
    },
  },
});

