import { useMemo, useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, Divider, Avatar } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { PlayerPropHistoryData } from '../../hooks/usePlayerPropsHistory';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';

interface PlayerPropsHistoryChartProps {
  data: PlayerPropHistoryData[];
  playerName: string;
  teamAbbreviation?: string;
}

// Helper to lighten a color (for actual vs line distinction)
const lightenColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const r = (num >> 16) + Math.floor((255 - (num >> 16)) * percent);
  const g = ((num >> 8) & 0x00FF) + Math.floor((255 - ((num >> 8) & 0x00FF)) * percent);
  const b = (num & 0x0000FF) + Math.floor((255 - (num & 0x0000FF)) * percent);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Category groupings
const categoryGroups = {
  'Single Stats': ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', '3PM', 'FTM'],
  'Combined Stats': ['PTS+REB', 'PTS+AST', 'REB+AST', 'PAR', 'STOCKS'],
};

// Helper function to get acronym from category name
const getCategoryAcronym = (category: string): string => {
  // If it's already short (3-4 chars), use it as is
  if (category.length <= 4) {
    return category;
  }
  
  // For combined stats like "PTS+REB", extract first letters
  if (category.includes('+')) {
    return category
      .split('+')
      .map(part => part.charAt(0))
      .join('');
  }
  
  // For words like "STOCKS", take first 2-3 letters
  if (category.length > 4) {
    return category.substring(0, 3).toUpperCase();
  }
  
  return category;
};

export default function PlayerPropsHistoryChart({ data, playerName, teamAbbreviation }: PlayerPropsHistoryChartProps) {
  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#FF6B6B';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#4ECDC4';
  
  // Detect mobile screen size
  const isMobile = useMediaQuery('(max-width: 768px)');
  const maxGames = isMobile ? 5 : 10;
  
  // State for selected categories - start with empty set, will be initialized with random stat
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Process data: Group by bet_type and create series
  const chartData = useMemo(() => {
    // Get all unique bet types (using displayName for consistency)
    const allBetTypes = [...new Set(data.map(d => d.displayName))].sort();
    
    // Filter bet types based on selected categories
    const betTypes = selectedCategories.size > 0
      ? allBetTypes.filter(bt => selectedCategories.has(bt))
      : allBetTypes;
    
    // Get all unique dates and sort
    const allDates = [...new Set(data.map(d => d.game_date))].sort();
    
    // Filter dates to only include those that have data for at least one selected bet type
    const datesWithData = allDates.filter(date => {
      // Check if this date has at least one data point (line or actualValue) for any selected bet type
      return betTypes.some(betType => {
        const propForDate = data.find(
          d => d.game_date === date && d.displayName === betType
        );
        if (!propForDate) return false;
        // Check for valid numeric values (not null, undefined, or NaN)
        const hasLine = propForDate.line !== undefined && propForDate.line !== null && !isNaN(Number(propForDate.line));
        const hasActual = propForDate.actualValue !== undefined && propForDate.actualValue !== null && !isNaN(Number(propForDate.actualValue));
        return hasLine || hasActual;
      });
    });
    
    // Limit to last N games (most recent) that have data
    const dates = datesWithData.slice(-maxGames);
    
    // Create data points for each date
    const chartPoints = dates.map(date => {
      const point: Record<string, string | number | undefined> = { date };
      
      // For each bet type, find the line value and actual value for this date
      betTypes.forEach(betType => {
        const propForDate = data.find(
          d => d.game_date === date && d.displayName === betType
        );
        
        // Only set values if they're valid numbers
        if (propForDate?.line !== undefined && propForDate.line !== null) {
          const lineNum = Number(propForDate.line);
          point[betType] = !isNaN(lineNum) ? lineNum : undefined;
        } else {
          point[betType] = undefined;
        }
        
        if (propForDate?.actualValue !== undefined && propForDate.actualValue !== null) {
          const actualNum = Number(propForDate.actualValue);
          point[`${betType}_actual`] = !isNaN(actualNum) ? actualNum : undefined;
        } else {
          point[`${betType}_actual`] = undefined;
        }
      });
      
      return point;
    });

    return { chartPoints, betTypes, dates, allBetTypes: allBetTypes };
  }, [data, selectedCategories, maxGames]);

  // Create series for each bet type - both line and actual performance
  const series = useMemo(() => {
    // Helper to convert null/NaN to undefined (which MUI charts handles better)
    const sanitizeValue = (value: number | null | undefined): number | undefined => {
      if (value === null || value === undefined || isNaN(value as number)) {
        return undefined;
      }
      return value as number;
    };

    const lineSeries = chartData.betTypes.map((betType) => {
      // Use team primary color for line
      const lineColor = primaryColor;
      
      return {
        data: chartData.chartPoints.map(point => sanitizeValue(point[betType] as number | null)),
        label: `${betType} (Line)`,
        id: `${betType.toLowerCase().replace(/[^a-z0-9]/g, '')}_line`,
        color: lineColor,
        showMarkers: false,
        connectNulls: false,
        curve: 'linear' as const,
      };
    });

    const actualSeries = chartData.betTypes.map((betType) => {
      // Use team secondary color for actual (or lightened primary if no secondary)
      const actualColor = secondaryColor || lightenColor(primaryColor, 0.3);
      
      return {
        data: chartData.chartPoints.map(point => sanitizeValue(point[`${betType}_actual`] as number | null)),
        label: `${betType} (Actual)`,
        id: `${betType.toLowerCase().replace(/[^a-z0-9]/g, '')}_actual`,
        color: actualColor,
        showMarkers: true,
        connectNulls: false,
        curve: 'linear' as const,
        strokeWidth: 2,
        area: undefined,
      };
    });

    return [...lineSeries, ...actualSeries];
  }, [chartData, primaryColor, secondaryColor]);

  // Format dates for x-axis (show as MM/DD)
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  // Toggle category selection - only allow one category at a time
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      // If clicking the same category, deselect it (show all)
      if (prev.has(category) && prev.size === 1) {
        return new Set();
      }
      // Otherwise, select only this category (deselect all others)
      return new Set([category]);
    });
  };

  // Categories to exclude from display
  const excludedCategories = ['FAN', 'FGM', 'FGA', 'FTM', 'FTA', '3PA'];
  
  // Get available categories from actual data
  const availableCategories = useMemo(() => {
    const allCategories = new Set<string>();
    chartData.allBetTypes.forEach(bt => {
      // Skip excluded categories
      if (excludedCategories.includes(bt)) {
        return;
      }
      
      // Check which category group this belongs to
      Object.entries(categoryGroups).forEach(([groupName, categories]) => {
        if (categories.includes(bt)) {
          allCategories.add(bt);
        }
      });
      // If not in any group, add it as a standalone category
      if (!Object.values(categoryGroups).flat().includes(bt)) {
        allCategories.add(bt);
      }
    });
    return Array.from(allCategories).sort();
  }, [chartData.allBetTypes]);

  // Initialize with a random stat on first load
  useEffect(() => {
    if (!isInitialized && availableCategories.length > 0 && selectedCategories.size === 0) {
      // Pick a random category
      const randomIndex = Math.floor(Math.random() * availableCategories.length);
      const randomCategory = availableCategories[randomIndex];
      setSelectedCategories(new Set([randomCategory]));
      setIsInitialized(true);
    }
  }, [availableCategories, isInitialized, selectedCategories.size]);

  if (chartData.chartPoints.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
          No prop data available to display
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Category Toolbar - Above Chart */}
      <Box
        sx={{
          mb: 2,
          bgcolor: '#1a1a1a',
          border: '1px solid #333333',
          borderRadius: '4px',
          p: 2,
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap sx={{ overflowX: 'auto', alignItems: 'center' }}>
          {/* All categories together as Avatars */}
          {availableCategories.map(category => {
            const isSelected = selectedCategories.has(category);
            const acronym = getCategoryAcronym(category);
            
            return (
              <Avatar
                key={category}
                onClick={() => toggleCategory(category)}
                title={category} // Show full name on hover
                sx={{
                  cursor: 'pointer',
                  width: { xs: 40, md: 48 },
                  height: { xs: 40, md: 48 },
                  bgcolor: isSelected ? primaryColor : '#1a1a1a',
                  color: isSelected ? '#FFFFFF' : '#CCCCCC',
                  border: '2px solid',
                  borderColor: isSelected ? primaryColor : '#444444',
                  fontSize: { xs: '0.7rem', md: '0.8rem' },
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    borderColor: primaryColor,
                    bgcolor: isSelected ? primaryColor : '#2a2a2a',
                    boxShadow: `0 0 8px ${primaryColor}40`,
                  },
                }}
              >
                {acronym}
              </Avatar>
            );
          })}

          {/* Show all button - farthest to the right */}
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              variant={selectedCategories.size === 0 ? 'solid' : 'outlined'}
              color={selectedCategories.size === 0 ? 'primary' : 'neutral'}
              onClick={() => setSelectedCategories(new Set())}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                py: 0.4,
                px: 1,
                whiteSpace: 'nowrap',
                bgcolor: selectedCategories.size === 0 ? primaryColor : 'transparent',
                color: selectedCategories.size === 0 ? '#FFFFFF' : '#CCCCCC',
                borderColor: selectedCategories.size === 0 ? primaryColor : '#444444',
                '&:hover': {
                  bgcolor: selectedCategories.size === 0 ? primaryColor : '#2a2a2a',
                  borderColor: primaryColor,
                },
              }}
            >
              Show All
            </Button>
          </Box>
        </Stack>
      </Box>

      {/* Chart Area */}
      <Box sx={{ width: '100%' }}>
        {series.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
              Select a category to view
            </Typography>
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            <LineChart
              width={undefined}
              height={400}
              series={series}
        xAxis={[{
          data: chartData.chartPoints.map((_, index) => index),
          label: 'Game Date',
          labelStyle: { fill: '#FFFFFF' },
          tickLabelStyle: { fill: '#FFFFFF', fontSize: 10 },
          valueFormatter: (value) => {
            const index = Number(value);
            if (index >= 0 && index < chartData.dates.length && !isNaN(index)) {
              return formatDate(chartData.dates[index]);
            }
            return '';
          },
          tickMinStep: 1,
        }]}
        yAxis={[{
          label: 'Value',
          labelStyle: { fill: '#FFFFFF' },
          tickLabelStyle: { fill: '#FFFFFF', fontSize: 12 },
        }]}
        sx={{
          '& .MuiChartsLegend-root': {
            display: 'none', // Hide legend
          },
          '& .MuiChartsAxis-root': {
            stroke: '#666666',
          },
          '& .MuiChartsGrid-root': {
            stroke: '#333333',
          },
        }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

