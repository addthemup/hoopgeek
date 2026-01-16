import { Box, Typography, Card, CardContent, Alert } from '@mui/joy';
import {
  GaugeContainer,
  GaugeValueArc,
  GaugeReferenceArc,
  useGaugeState,
} from '@mui/x-charts/Gauge';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';

interface PaceGaugeChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

const LEAGUE_PACE_AVG = 100;

// Custom pointer component for player pace (speedometer needle)
function SpeedometerNeedle({ color }: { color: string }) {
  const { valueAngle, outerRadius, cx, cy } = useGaugeState();

  if (valueAngle === null) {
    return null;
  }

  const needleLength = outerRadius * 0.85;
  const target = {
    x: cx + needleLength * Math.sin(valueAngle),
    y: cy - needleLength * Math.cos(valueAngle),
  };

  // Create a wider needle base
  const baseWidth = 4;
  const angle1 = valueAngle - Math.PI / 2;
  const angle2 = valueAngle + Math.PI / 2;
  const base1 = {
    x: cx + baseWidth * Math.cos(angle1),
    y: cy + baseWidth * Math.sin(angle1),
  };
  const base2 = {
    x: cx + baseWidth * Math.cos(angle2),
    y: cy + baseWidth * Math.sin(angle2),
  };

  return (
    <g>
      {/* Needle base circle */}
      <circle cx={cx} cy={cy} r={6} fill={color} stroke="#000000" strokeWidth={2} />
      {/* Needle triangle */}
      <path
        d={`M ${base1.x} ${base1.y} L ${target.x} ${target.y} L ${base2.x} ${base2.y} Z`}
        fill={color}
        stroke="#000000"
        strokeWidth={1}
      />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="#000000" />
    </g>
  );
}

export default function PaceGaugeChart({ playerId, seasonYear, teamAbbreviation }: PaceGaugeChartProps) {
  const { data, isLoading, error } = usePlayerGameStats(playerId, seasonYear);

  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1D428A';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#FFC72C';

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>Loading pace data...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Alert color="warning" sx={{ bgcolor: '#000000' }}>
            <Typography sx={{ color: '#FFFFFF' }}>Unable to load pace data</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const playerPace = data.seasonAverages.advanced_pace || 0;
  
  // Transform pace to speedometer scale
  // League average (100) should be at 70% of the gauge
  // Make small differences appear drastic
  // If player is 5-10% over average, it should look like going 100 in a 70
  const GAUGE_MAX = 100; // 100% of gauge
  const LEAGUE_POSITION = 70; // League average at 70% of gauge
  
  // Calculate the range: if league avg (100) is at 70%, we need to map the pace values
  // Use a non-linear scale to make differences more dramatic
  const paceDiff = playerPace - LEAGUE_PACE_AVG;
  const pacePercentDiff = (paceDiff / LEAGUE_PACE_AVG) * 100; // Percentage difference from league avg
  
  // Transform: small differences become large on the gauge
  // 5% over = +15% on gauge, 10% over = +30% on gauge
  const gaugePosition = LEAGUE_POSITION + (pacePercentDiff * 3);
  
  // Clamp to 5-95 to keep within visual boundaries (leave some margin)
  const clampedGaugePosition = Math.max(5, Math.min(95, gaugePosition));
  
  // Calculate actual pace range for display
  // We'll show a range that makes sense visually
  const PACE_DISPLAY_MIN = 80;
  const PACE_DISPLAY_MAX = 120;
  const clampedPlayerPace = Math.max(PACE_DISPLAY_MIN, Math.min(PACE_DISPLAY_MAX, playerPace));

  // Determine if player exceeds average
  const playerExceedsAverage = playerPace > LEAGUE_PACE_AVG;

  // Calculate gauge size to fit within 150px Card height
  // Card: 150px, CardContent padding: 16px (top+bottom), Typography: ~20px, available: ~98px
  // Use smaller gauge to ensure it fits with some margin
  const gaugeWidth = 220;
  const gaugeHeight = 95;

  return (
    <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', height: 150 }}>
      <CardContent sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflow: 'hidden' }}>
        <Typography level="body-sm" sx={{ mb: 0.5, fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.875rem' }}>
          Pace
        </Typography>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ position: 'relative', width: gaugeWidth, height: gaugeHeight, maxWidth: '100%', maxHeight: '100%', overflow: 'hidden' }}>
            {/* Background Gauge Arc - Horizontal speedometer (rotated 90 degrees) */}
            <GaugeContainer
              width={gaugeWidth}
              height={gaugeHeight}
              startAngle={-90}
              endAngle={90}
              value={GAUGE_MAX}
              valueMin={0}
              valueMax={GAUGE_MAX}
            >
              <GaugeReferenceArc 
                sx={{ 
                  fill: '#1a1a1a', 
                  stroke: '#333333', 
                  strokeWidth: 3,
                }} 
              />
            </GaugeContainer>
            
            {/* Render order depends on whether player exceeds average */}
            {playerExceedsAverage ? (
              <>
                {/* Player Pace Fill Arc - Rendered first (underneath) when exceeding */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
                  <GaugeContainer
                    width={gaugeWidth}
                    height={gaugeHeight}
                    startAngle={-90}
                    endAngle={90}
                    value={clampedGaugePosition}
                    valueMin={0}
                    valueMax={GAUGE_MAX}
                  >
                    <GaugeReferenceArc sx={{ fill: 'transparent' }} />
                    <GaugeValueArc 
                      sx={{ 
                        fill: primaryColor, 
                        fillOpacity: 0.8, 
                        stroke: primaryColor, 
                        strokeWidth: 3 
                      }} 
                    />
                  </GaugeContainer>
                </Box>
                
                {/* League Average Arc - Rendered second (on top) - Always white */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}>
                  <GaugeContainer
                    width={gaugeWidth}
                    height={gaugeHeight}
                    startAngle={-90}
                    endAngle={90}
                    value={LEAGUE_POSITION}
                    valueMin={0}
                    valueMax={GAUGE_MAX}
                  >
                    <GaugeReferenceArc sx={{ fill: 'transparent' }} />
                    <GaugeValueArc 
                      sx={{ 
                        fill: '#FFFFFF', 
                        fillOpacity: 0.9, 
                        stroke: '#FFFFFF', 
                        strokeWidth: 3 
                      }} 
                    />
                  </GaugeContainer>
                </Box>
              </>
            ) : (
              <>
                {/* League Average Arc - Rendered first (underneath) when player is under - Always white */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
                  <GaugeContainer
                    width={gaugeWidth}
                    height={gaugeHeight}
                    startAngle={-90}
                    endAngle={90}
                    value={LEAGUE_POSITION}
                    valueMin={0}
                    valueMax={GAUGE_MAX}
                  >
                    <GaugeReferenceArc sx={{ fill: 'transparent' }} />
                    <GaugeValueArc 
                      sx={{ 
                        fill: '#FFFFFF', 
                        fillOpacity: 0.9, 
                        stroke: '#FFFFFF', 
                        strokeWidth: 3 
                      }} 
                    />
                  </GaugeContainer>
                </Box>
                
                {/* Player Pace Fill Arc - Rendered second (on top) when under average */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}>
                  <GaugeContainer
                    width={gaugeWidth}
                    height={gaugeHeight}
                    startAngle={-90}
                    endAngle={90}
                    value={clampedGaugePosition}
                    valueMin={0}
                    valueMax={GAUGE_MAX}
                  >
                    <GaugeReferenceArc sx={{ fill: 'transparent' }} />
                    <GaugeValueArc 
                      sx={{ 
                        fill: primaryColor, 
                        fillOpacity: 0.8, 
                        stroke: primaryColor, 
                        strokeWidth: 3 
                      }} 
                    />
                  </GaugeContainer>
                </Box>
              </>
            )}
            
            {/* Speedometer Needle - Always on top */}
            <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 3 }}>
              <GaugeContainer
                width={gaugeWidth}
                height={gaugeHeight}
                startAngle={-90}
                endAngle={90}
                value={clampedGaugePosition}
                valueMin={0}
                valueMax={GAUGE_MAX}
              >
                <GaugeReferenceArc sx={{ fill: 'transparent' }} />
                <GaugeValueArc sx={{ fill: 'transparent' }} />
                <SpeedometerNeedle color={primaryColor} />
              </GaugeContainer>
            </Box>
            
            {/* Labels at bottom */}
            <Box sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4 }}>
              <Typography sx={{ color: '#FFFFFF', fontSize: '0.7rem', fontWeight: 600, mb: 0.25 }}>
                Lg: {LEAGUE_PACE_AVG.toFixed(1)}
              </Typography>
              <Typography sx={{ color: primaryColor, fontSize: '1rem', fontWeight: 700 }}>
                {clampedPlayerPace.toFixed(1)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

