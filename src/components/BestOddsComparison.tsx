import { Box, Card, CardContent, Stack, Typography, Chip, Grid, Divider } from '@mui/joy'
import { TrendingUp, EmojiEvents } from '@mui/icons-material'
import type { BettingGame, BettingMarket } from '../hooks/useBettingOdds'
import { formatOdds } from '../hooks/useBettingOdds'

interface BestOdd {
  type: string
  teamName: string
  odds: string
  bookName: string
  spread?: string | null
}

interface BestOddsComparisonProps {
  game: BettingGame
  oddsFormat: 'decimal' | 'american'
  homeTeamName: string
  awayTeamName: string
}

export default function BestOddsComparison({ 
  game, 
  oddsFormat,
  homeTeamName,
  awayTeamName 
}: BestOddsComparisonProps) {
  // Find best odds for each market type
  const getBestOdds = (market: BettingMarket): BestOdd[] => {
    const bestOdds: BestOdd[] = []
    
    // Track best home and away odds
    let bestHomeOdds = { odds: 0, bookName: '', spread: null as string | null }
    let bestAwayOdds = { odds: 0, bookName: '', spread: null as string | null }
    
    market.books.forEach(book => {
      book.outcomes.forEach(outcome => {
        const oddsValue = parseFloat(outcome.odds)
        
        if (outcome.type === 'home' && oddsValue > bestHomeOdds.odds) {
          bestHomeOdds = {
            odds: oddsValue,
            bookName: book.name,
            spread: outcome.spread || null
          }
        } else if (outcome.type === 'away' && oddsValue > bestAwayOdds.odds) {
          bestAwayOdds = {
            odds: oddsValue,
            bookName: book.name,
            spread: outcome.spread || null
          }
        }
      })
    })
    
    if (bestHomeOdds.odds > 0) {
      bestOdds.push({
        type: 'home',
        teamName: homeTeamName,
        odds: bestHomeOdds.odds.toString(),
        bookName: bestHomeOdds.bookName,
        spread: bestHomeOdds.spread
      })
    }
    
    if (bestAwayOdds.odds > 0) {
      bestOdds.push({
        type: 'away',
        teamName: awayTeamName,
        odds: bestAwayOdds.odds.toString(),
        bookName: bestAwayOdds.bookName,
        spread: bestAwayOdds.spread
      })
    }
    
    return bestOdds
  }
  
  const marketLabels: Record<string, string> = {
    '2way': 'Best Moneyline',
    'spread': 'Best Spread',
    'total': 'Best Over/Under'
  }
  
  return (
    <Card 
      variant="soft" 
      color="success"
      sx={{ 
        background: 'linear-gradient(135deg, #10b98115 0%, #06b6d415 100%)',
        border: '2px solid',
        borderColor: 'success.500'
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmojiEvents color="success" />
            <Typography level="title-lg" fontWeight="xl">
              Best Available Odds
            </Typography>
            <Chip size="sm" color="success" variant="solid">
              Value Finder
            </Chip>
          </Stack>
          
          <Typography level="body-sm" textColor="text.secondary">
            Compare the best odds across all sportsbooks for maximum value
          </Typography>
          
          <Divider />
          
          <Grid container spacing={2}>
            {game.markets.map((market, idx) => {
              const bestOdds = getBestOdds(market)
              const label = marketLabels[market.name] || market.name
              
              if (bestOdds.length === 0) return null
              
              return (
                <Grid key={idx} xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 'md',
                      bgcolor: 'background.surface',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Typography 
                      level="title-sm" 
                      fontWeight="lg" 
                      sx={{ mb: 2 }}
                      textAlign="center"
                    >
                      {label}
                    </Typography>
                    
                    <Stack spacing={1.5}>
                      {bestOdds.map((odd, oddIdx) => (
                        <Box
                          key={oddIdx}
                          sx={{
                            p: 1.5,
                            borderRadius: 'sm',
                            bgcolor: 'success.50',
                            border: '1px solid',
                            borderColor: 'success.200'
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack spacing={0.5}>
                              <Typography level="body-sm" fontWeight="lg">
                                {odd.type === 'home' ? '🏠' : '✈️'} {odd.teamName}
                              </Typography>
                              {odd.spread && (
                                <Chip size="sm" color="warning" variant="soft">
                                  {odd.spread}
                                </Chip>
                              )}
                            </Stack>
                            <Stack alignItems="flex-end" spacing={0.5}>
                              <Typography level="title-lg" fontWeight="xl" color="success">
                                {formatOdds(odd.odds, oddsFormat)}
                              </Typography>
                              <Typography level="body-xs" textColor="text.tertiary">
                                @ {odd.bookName}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              )
            })}
          </Grid>
          
          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <TrendingUp color="success" sx={{ fontSize: 16 }} />
              <Typography level="body-xs" fontWeight="lg" textColor="success.700">
                These odds give you the best potential return for each bet type
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

