import React from 'react';
import { Box } from '@mui/joy';
import { Dayjs } from 'dayjs';
import TodayModulesGrid from './TodayModulesGrid';

interface TodayPastProps {
  selectedDate: Dayjs;
  navigate: (path: string) => void;
  standings?: any;
  standingsLoading?: boolean;
  onOpenPropPredictions?: () => void;
}

export default function TodayPast({
  selectedDate,
  navigate,
  standings,
  standingsLoading,
  onOpenPropPredictions,
}: TodayPastProps) {
  return (
    <Box>
      <TodayModulesGrid
        dateState="past"
        selectedDate={selectedDate}
        navigate={navigate}
        standings={standings}
        standingsLoading={standingsLoading}
        onOpenPropPredictions={onOpenPropPredictions}
      />
    </Box>
  );
}
