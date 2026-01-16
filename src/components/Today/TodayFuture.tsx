import React from 'react';
import { Box } from '@mui/joy';
import { Dayjs } from 'dayjs';
import TodayModulesGrid from './TodayModulesGrid';

interface TodayFutureProps {
  selectedDate: Dayjs;
  navigate: (path: string) => void;
  standings?: any;
  standingsLoading?: boolean;
  onOpenPropPredictions?: () => void;
}

export default function TodayFuture({
  selectedDate,
  navigate,
  standings,
  standingsLoading,
  onOpenPropPredictions,
}: TodayFutureProps) {
  return (
    <Box>
      <TodayModulesGrid
        dateState="future"
        selectedDate={selectedDate}
        navigate={navigate}
        standings={standings}
        standingsLoading={standingsLoading}
        onOpenPropPredictions={onOpenPropPredictions}
      />
    </Box>
  );
}
