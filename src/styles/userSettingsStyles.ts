/**
 * Shared styles for UserSettings page and all tabs
 * Consistent newspaper-style design across Profile, Wallet, Content, Blog, DFS, and Analytics
 */

export const userSettingsStyles = {
  // Page Container
  pageContainer: {
    bgcolor: '#f8f9fa',
    minHeight: '100vh',
    width: '100%',
  },

  // Navigation Bar
  navBar: {
    bgcolor: '#ffffff',
    borderBottom: '3px solid #000',
    boxShadow: '0 4px 0px #000',
    zIndex: 1050,
  },

  navContainer: {
    maxWidth: { xs: '100%', sm: 805, md: 1035 },
    minWidth: { xs: '100%', sm: 805, md: 1035 },
    mx: 'auto',
    px: { xs: 1, md: 2 },
  },

  // Tabs
  tabList: {
    bgcolor: '#ffffff',
    '--List-padding': '0px',
    '--List-radius': '0px',
    '--ListItem-minHeight': '56px',
    overflowX: 'auto',
    flexWrap: 'nowrap',
    '&::-webkit-scrollbar': {
      display: 'none'
    }
  },

  tab: {
    fontFamily: 'serif',
    fontSize: '0.875rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#000',
    minHeight: '56px',
    borderRight: '2px solid #000',
    borderRadius: 0,
    '&:last-child': {
      borderRight: 'none',
    },
    '&.Mui-selected': {
      bgcolor: '#000',
      color: '#fff',
      borderBottom: 'none',
    },
    '&:hover': {
      bgcolor: '#f0f0f0',
      color: '#000',
    },
  },

  // Main Content Area
  contentContainer: {
    maxWidth: { xs: '100%', sm: 805, md: 1035 },
    mx: 'auto',
    px: { xs: 2, md: 2 },
    pt: 3,
    pb: 4,
    bgcolor: '#f8f9fa',
  },

  // Card Styles
  card: {
    bgcolor: '#ffffff',
    border: '3px solid #000',
    borderRadius: 0,
    boxShadow: '4px 4px 0px #000',
    overflow: 'hidden',
    mb: 3,
  },

  cardHeader: {
    bgcolor: '#000',
    color: '#fff',
    px: 3,
    py: 2,
    borderBottom: '3px solid #000',
  },

  cardHeaderTitle: {
    fontFamily: 'serif',
    fontWeight: 900,
    fontSize: '1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#fff',
  },

  cardHeaderSubtitle: {
    fontFamily: 'serif',
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
    mt: 0.5,
  },

  cardBody: {
    p: 3,
    bgcolor: '#ffffff',
  },

  // Admin Tab Headers (Gold)
  adminCardHeader: {
    bgcolor: '#FFC72C',
    color: '#000',
    px: 3,
    py: 2,
    borderBottom: '3px solid #000',
  },

  // Analytics Tab Header (Green)
  analyticsCardHeader: {
    bgcolor: '#16A34A',
    color: '#fff',
    px: 3,
    py: 2,
    borderBottom: '3px solid #000',
  },

  // Form Controls
  formControl: {
    mb: 3,
  },

  formLabel: {
    fontFamily: 'serif',
    fontWeight: 700,
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#000',
    mb: 1,
  },

  input: {
    fontFamily: 'serif',
    border: '2px solid #000',
    borderRadius: 0,
    bgcolor: '#ffffff',
    color: '#000',
    '& input': {
      color: '#000',
    },
    '& input::placeholder': {
      color: '#666',
      opacity: 1,
    },
    '&:hover': {
      borderColor: '#000',
    },
    '&:focus-within': {
      borderColor: '#000',
      outline: '2px solid #000',
      outlineOffset: '2px',
    },
    '&.Mui-disabled': {
      bgcolor: '#f5f5f5',
      color: '#666',
      borderColor: '#ccc',
      '& input': {
        color: '#666',
      },
    },
  },

  textarea: {
    fontFamily: 'serif',
    border: '2px solid #000',
    borderRadius: 0,
    bgcolor: '#ffffff',
    color: '#000',
    '& textarea': {
      color: '#000',
    },
    '& textarea::placeholder': {
      color: '#666',
      opacity: 1,
    },
    '&:hover': {
      borderColor: '#000',
    },
    '&:focus-within': {
      borderColor: '#000',
      outline: '2px solid #000',
      outlineOffset: '2px',
    },
    '&.Mui-disabled': {
      bgcolor: '#f5f5f5',
      color: '#666',
      borderColor: '#ccc',
      '& textarea': {
        color: '#666',
      },
    },
  },

  select: {
    fontFamily: 'serif',
    border: '2px solid #000',
    borderRadius: 0,
    bgcolor: '#ffffff',
    color: '#000',
    '&:hover': {
      borderColor: '#000',
    },
    '&:focus-within': {
      borderColor: '#000',
      outline: '2px solid #000',
      outlineOffset: '2px',
    },
  },

  // Buttons
  primaryButton: {
    fontFamily: 'serif',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    bgcolor: '#000',
    color: '#fff',
    border: '2px solid #000',
    borderRadius: 0,
    px: 3,
    py: 1,
    '&:hover': {
      bgcolor: '#333',
      transform: 'translate(-2px, -2px)',
      boxShadow: '4px 4px 0px #000',
    },
  },

  secondaryButton: {
    fontFamily: 'serif',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    bgcolor: '#fff',
    color: '#000',
    border: '2px solid #000',
    borderRadius: 0,
    px: 3,
    py: 1,
    '&:hover': {
      bgcolor: '#f0f0f0',
      transform: 'translate(-2px, -2px)',
      boxShadow: '4px 4px 0px #000',
    },
  },

  successButton: {
    fontFamily: 'serif',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    bgcolor: '#16A34A',
    color: '#fff',
    border: '2px solid #000',
    borderRadius: 0,
    px: 3,
    py: 1,
    '&:hover': {
      bgcolor: '#15803d',
      transform: 'translate(-2px, -2px)',
      boxShadow: '4px 4px 0px #000',
    },
  },

  dangerButton: {
    fontFamily: 'serif',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    bgcolor: '#ef4444',
    color: '#fff',
    border: '2px solid #000',
    borderRadius: 0,
    px: 3,
    py: 1,
    '&:hover': {
      bgcolor: '#dc2626',
      transform: 'translate(-2px, -2px)',
      boxShadow: '4px 4px 0px #000',
    },
  },

  // Tables
  table: {
    '& thead th': {
      bgcolor: '#000',
      color: '#fff',
      fontFamily: 'serif',
      fontWeight: 900,
      fontSize: '0.85rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      py: 1.5,
      borderBottom: '2px solid #000',
      borderRight: '2px solid #fff',
      '&:last-child': {
        borderRight: 'none',
      },
    },
    '& tbody td': {
      fontFamily: 'serif',
      color: '#000',
      py: 1.5,
      fontSize: '0.875rem',
      borderBottom: '2px solid #000',
      borderRight: '2px solid #000',
      '&:last-child': {
        borderRight: 'none',
      },
    },
    '& tbody tr:hover': {
      bgcolor: '#f0f0f0',
      cursor: 'pointer',
    },
  },

  // Section Headers
  sectionHeader: {
    fontFamily: 'serif',
    fontWeight: 900,
    fontSize: '1.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#000',
    mb: 2,
    pb: 1,
    borderBottom: '3px double #000',
  },

  // Empty State
  emptyState: {
    textAlign: 'center',
    py: 4,
    color: '#666',
    fontFamily: 'serif',
    fontStyle: 'italic',
  },

  // Loading State
  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    py: 4,
  },

  // Chip/Badge
  chip: {
    fontFamily: 'serif',
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: 0,
    border: '2px solid #000',
  },

  adminChip: {
    bgcolor: '#FFC72C',
    color: '#000',
    border: '2px solid #000',
  },
};







