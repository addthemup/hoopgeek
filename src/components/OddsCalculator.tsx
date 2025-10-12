import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Input,
  Select,
  Option,
  Button,
  Divider,
  Chip,
  Sheet
} from '@mui/joy'
import { Calculate, AttachMoney, TrendingUp } from '@mui/icons-material'

export default function OddsCalculator() {
  const [betAmount, setBetAmount] = useState<string>('100')
  const [oddsValue, setOddsValue] = useState<string>('150')
  const [oddsFormat, setOddsFormat] = useState<'american' | 'decimal'>('american')
  
  const calculatePayout = (): { payout: number; profit: number; roi: number } => {
    const stake = parseFloat(betAmount) || 0
    
    if (stake === 0) {
      return { payout: 0, profit: 0, roi: 0 }
    }
    
    let decimalOdds: number
    
    if (oddsFormat === 'american') {
      const americanOdds = parseFloat(oddsValue)
      if (americanOdds >= 100) {
        // Positive odds
        decimalOdds = (americanOdds / 100) + 1
      } else {
        // Negative odds
        decimalOdds = (100 / Math.abs(americanOdds)) + 1
      }
    } else {
      decimalOdds = parseFloat(oddsValue) || 0
    }
    
    const payout = stake * decimalOdds
    const profit = payout - stake
    const roi = ((profit / stake) * 100)
    
    return {
      payout: Math.round(payout * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      roi: Math.round(roi * 100) / 100
    }
  }
  
  const calculateImpliedProbability = (): number => {
    let decimalOdds: number
    
    if (oddsFormat === 'american') {
      const americanOdds = parseFloat(oddsValue)
      if (americanOdds >= 100) {
        decimalOdds = (americanOdds / 100) + 1
      } else {
        decimalOdds = (100 / Math.abs(americanOdds)) + 1
      }
    } else {
      decimalOdds = parseFloat(oddsValue) || 0
    }
    
    if (decimalOdds === 0) return 0
    
    const probability = (1 / decimalOdds) * 100
    return Math.round(probability * 100) / 100
  }
  
  const result = calculatePayout()
  const impliedProbability = calculateImpliedProbability()
  
  return (
    <Card 
      variant="outlined"
      sx={{
        background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
        border: '2px solid',
        borderColor: 'primary.300'
      }}
    >
      <CardContent>
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Calculate color="primary" />
            <Typography level="title-lg" fontWeight="xl">
              Betting Calculator
            </Typography>
            <Chip size="sm" color="primary" variant="solid">
              Free Tool
            </Chip>
          </Stack>
          
          <Typography level="body-sm" textColor="text.secondary">
            Calculate potential payouts, profits, and implied probability for your bets
          </Typography>
          
          <Divider />
          
          {/* Input Section */}
          <Stack spacing={2}>
            <Box>
              <Typography level="body-sm" fontWeight="lg" sx={{ mb: 1 }}>
                Bet Amount ($)
              </Typography>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                startDecorator={<AttachMoney />}
                placeholder="Enter bet amount"
                size="lg"
                sx={{ fontSize: '1.2rem' }}
              />
            </Box>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography level="body-sm" fontWeight="lg" sx={{ mb: 1 }}>
                  Odds Format
                </Typography>
                <Select
                  value={oddsFormat}
                  onChange={(_, value) => {
                    setOddsFormat(value as 'american' | 'decimal')
                    // Convert odds when switching formats
                    if (value === 'decimal' && oddsFormat === 'american') {
                      const americanOdds = parseFloat(oddsValue)
                      if (americanOdds >= 100) {
                        setOddsValue(((americanOdds / 100) + 1).toFixed(2))
                      } else {
                        setOddsValue(((100 / Math.abs(americanOdds)) + 1).toFixed(2))
                      }
                    } else if (value === 'american' && oddsFormat === 'decimal') {
                      const decimalOdds = parseFloat(oddsValue)
                      if (decimalOdds >= 2.0) {
                        setOddsValue(Math.round((decimalOdds - 1) * 100).toString())
                      } else {
                        setOddsValue((-Math.round(100 / (decimalOdds - 1))).toString())
                      }
                    }
                  }}
                  size="lg"
                >
                  <Option value="american">American (+/-)</Option>
                  <Option value="decimal">Decimal</Option>
                </Select>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography level="body-sm" fontWeight="lg" sx={{ mb: 1 }}>
                  Odds Value
                </Typography>
                <Input
                  type="number"
                  value={oddsValue}
                  onChange={(e) => setOddsValue(e.target.value)}
                  placeholder={oddsFormat === 'american' ? 'e.g., +150' : 'e.g., 2.50'}
                  size="lg"
                  sx={{ fontSize: '1.2rem' }}
                />
              </Box>
            </Stack>
          </Stack>
          
          <Divider />
          
          {/* Results Section */}
          <Box>
            <Typography level="title-md" fontWeight="lg" sx={{ mb: 2 }}>
              Calculation Results
            </Typography>
            
            <Stack spacing={2}>
              <Sheet
                variant="soft"
                color="success"
                sx={{ p: 2, borderRadius: 'md' }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography level="body-sm" fontWeight="lg">
                    Total Payout
                  </Typography>
                  <Typography level="h3" fontWeight="xl" color="success">
                    ${result.payout.toFixed(2)}
                  </Typography>
                </Stack>
              </Sheet>
              
              <Sheet
                variant="soft"
                color="primary"
                sx={{ p: 2, borderRadius: 'md' }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography level="body-sm" fontWeight="lg">
                    Net Profit
                  </Typography>
                  <Typography level="h4" fontWeight="xl" color="primary">
                    ${result.profit.toFixed(2)}
                  </Typography>
                </Stack>
              </Sheet>
              
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{ p: 2, borderRadius: 'md', flex: 1 }}
                >
                  <Stack spacing={0.5}>
                    <Typography level="body-xs" fontWeight="lg">
                      Return on Investment
                    </Typography>
                    <Typography level="h4" fontWeight="xl" color="warning">
                      {result.roi.toFixed(2)}%
                    </Typography>
                  </Stack>
                </Sheet>
                
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ p: 2, borderRadius: 'md', flex: 1 }}
                >
                  <Stack spacing={0.5}>
                    <Typography level="body-xs" fontWeight="lg">
                      Implied Probability
                    </Typography>
                    <Typography level="h4" fontWeight="xl">
                      {impliedProbability.toFixed(2)}%
                    </Typography>
                  </Stack>
                </Sheet>
              </Stack>
            </Stack>
          </Box>
          
          <Divider />
          
          {/* Info Section */}
          <Box sx={{ bgcolor: 'background.level1', p: 2, borderRadius: 'md' }}>
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TrendingUp sx={{ fontSize: 16, color: 'text.tertiary' }} />
                <Typography level="body-xs" fontWeight="lg">
                  How to use this calculator:
                </Typography>
              </Stack>
              <Typography level="body-xs" textColor="text.tertiary">
                1. Enter your desired bet amount
              </Typography>
              <Typography level="body-xs" textColor="text.tertiary">
                2. Select odds format (American or Decimal)
              </Typography>
              <Typography level="body-xs" textColor="text.tertiary">
                3. Enter the odds value from your sportsbook
              </Typography>
              <Typography level="body-xs" textColor="text.tertiary">
                4. View your potential payout, profit, ROI, and win probability
              </Typography>
            </Stack>
          </Box>
          
          {/* Quick Examples */}
          <Box>
            <Typography level="body-sm" fontWeight="lg" sx={{ mb: 1 }}>
              Quick Examples:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <Button
                size="sm"
                variant="outlined"
                onClick={() => {
                  setBetAmount('100')
                  setOddsValue('150')
                  setOddsFormat('american')
                }}
              >
                $100 @ +150
              </Button>
              <Button
                size="sm"
                variant="outlined"
                onClick={() => {
                  setBetAmount('50')
                  setOddsValue('-110')
                  setOddsFormat('american')
                }}
              >
                $50 @ -110
              </Button>
              <Button
                size="sm"
                variant="outlined"
                onClick={() => {
                  setBetAmount('200')
                  setOddsValue('2.50')
                  setOddsFormat('decimal')
                }}
              >
                $200 @ 2.50
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

