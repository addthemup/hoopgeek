import React from 'react';
import { Box } from '@mui/joy';
import { Dayjs } from 'dayjs';
import TodayModulesGrid from './TodayModulesGrid';

interface TodayPresentProps {
  selectedDate: Dayjs;
  navigate: (path: string) => void;
  nbaScoreboard?: any;
  standings?: any;
  standingsLoading?: boolean;
  onOpenPropPredictions?: () => void;
}

export default function TodayPresent({
  selectedDate,
  navigate,
  nbaScoreboard,
  standings,
  standingsLoading,
  onOpenPropPredictions,
}: TodayPresentProps) {
  return (
    <Box>
      <TodayModulesGrid
        dateState="present"
        selectedDate={selectedDate}
        navigate={navigate}
        nbaScoreboard={nbaScoreboard}
        standings={standings}
        standingsLoading={standingsLoading}
        onOpenPropPredictions={onOpenPropPredictions}
      />
    </Box>
  );
}
