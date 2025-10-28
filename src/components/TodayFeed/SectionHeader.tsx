import { Box, Typography, Divider } from '@mui/joy';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
}

export default function SectionHeader({ title, subtitle, icon }: SectionHeaderProps) {
  return (
    <Box sx={{ mb: 3, px: { xs: 2, md: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        {icon && (
          <Typography sx={{ fontSize: '2rem' }}>
            {icon}
          </Typography>
        )}
        <Typography 
          level="h2" 
          sx={{ 
            fontFamily: 'serif',
            fontWeight: 900,
            fontSize: { xs: '1.75rem', md: '2rem' },
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </Typography>
      </Box>
      {subtitle && (
        <Typography 
          level="body-sm" 
          sx={{ 
            color: 'text.secondary',
            fontFamily: 'serif',
            ml: icon ? 5 : 0,
          }}
        >
          {subtitle}
        </Typography>
      )}
      <Divider 
        sx={{ 
          mt: 1.5,
          borderWidth: 2,
          borderColor: '#000',
          borderStyle: 'solid',
        }} 
      />
    </Box>
  );
}

