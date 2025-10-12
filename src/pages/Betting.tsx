import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Grid,
  Select,
  Option,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  CircularProgress,
  Sheet,
  Divider,
  Button,
  Alert,
  IconButton,
  Tooltip
} from '@mui/joy'
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Info,
  Refresh,
  OpenInNew,
  MonetizationOn
} from '@mui/icons-material'
import { useBettingOdds, formatOdds, getOddsTrendIcon } from '../hooks/useBettingOdds'
import type { BettingGame, BettingMarket, BettingBook, BettingOutcome } from '../hooks/useBettingOdds'
import BestOddsComparison from '../components/BestOddsComparison'
import OddsCalculator from '../components/OddsCalculator'

// NBA Team mappings
const NBA_TEAMS: Record<string, { name: string; abbr: string; colors: [string, string] }> = {
  '1610612737': { name: 'Atlanta Hawks', abbr: 'ATL', colors: ['#E03A3E', '#C1D32F'] },
  '1610612738': { name: 'Boston Celtics', abbr: 'BOS', colors: ['#007A33', '#BA9653'] },
  '1610612751': { name: 'Brooklyn Nets', abbr: 'BKN', colors: ['#000000', '#FFFFFF'] },
  '1610612766': { name: 'Charlotte Hornets', abbr: 'CHA', colors: ['#1D1160', '#00788C'] },
  '1610612741': { name: 'Chicago Bulls', abbr: 'CHI', colors: ['#CE1141', '#000000'] },
  '1610612739': { name: 'Cleveland Cavaliers', abbr: 'CLE', colors: ['#860038', '#FDBB30'] },
  '1610612742': { name: 'Dallas Mavericks', abbr: 'DAL', colors: ['#00538C', '#002B5E'] },
  '1610612743': { name: 'Denver Nuggets', abbr: 'DEN', colors: ['#0E2240', '#FEC524'] },
  '1610612765': { name: 'Detroit Pistons', abbr: 'DET', colors: ['#C8102E', '#1D42BA'] },
  '1610612744': { name: 'Golden State Warriors', abbr: 'GSW', colors: ['#1D428A', '#FFC72C'] },
  '1610612745': { name: 'Houston Rockets', abbr: 'HOU', colors: ['#CE1141', '#000000'] },
  '1610612754': { name: 'Indiana Pacers', abbr: 'IND', colors: ['#002D62', '#FDBB30'] },
  '1610612746': { name: 'LA Clippers', abbr: 'LAC', colors: ['#C8102E', '#1D428A'] },
  '1610612747': { name: 'Los Angeles Lakers', abbr: 'LAL', colors: ['#552583', '#FDB927'] },
  '1610612763': { name: 'Memphis Grizzlies', abbr: 'MEM', colors: ['#5D76A9', '#12173F'] },
  '1610612748': { name: 'Miami Heat', abbr: 'MIA', colors: ['#98002E', '#F9A01B'] },
  '1610612749': { name: 'Milwaukee Bucks', abbr: 'MIL', colors: ['#00471B', '#EEE1C6'] },
  '1610612750': { name: 'Minnesota Timberwolves', abbr: 'MIN', colors: ['#0C2340', '#236192'] },
  '1610612740': { name: 'New Orleans Pelicans', abbr: 'NOP', colors: ['#0C2340', '#C8102E'] },
  '1610612752': { name: 'New York Knicks', abbr: 'NYK', colors: ['#006BB6', '#F58426'] },
  '1610612760': { name: 'Oklahoma City Thunder', abbr: 'OKC', colors: ['#007AC1', '#EF3B24'] },
  '1610612753': { name: 'Orlando Magic', abbr: 'ORL', colors: ['#0077C0', '#C4CED4'] },
  '1610612755': { name: 'Philadelphia 76ers', abbr: 'PHI', colors: ['#006BB6', '#ED174C'] },
  '1610612756': { name: 'Phoenix Suns', abbr: 'PHX', colors: ['#1D1160', '#E56020'] },
  '1610612757': { name: 'Portland Trail Blazers', abbr: 'POR', colors: ['#E03A3E', '#000000'] },
  '1610612758': { name: 'Sacramento Kings', abbr: 'SAC', colors: ['#5A2D81', '#63727A'] },
  '1610612759': { name: 'San Antonio Spurs', abbr: 'SAS', colors: ['#C4CED4', '#000000'] },
  '1610612761': { name: 'Toronto Raptors', abbr: 'TOR', colors: ['#CE1141', '#000000'] },
  '1610612762': { name: 'Utah Jazz', abbr: 'UTA', colors: ['#002B5C', '#00471B'] },
  '1610612764': { name: 'Washington Wizards', abbr: 'WAS', colors: ['#002B5C', '#E31837'] },
}

const OddsTrendIcon = ({ trend }: { trend: string }) => {
  switch (trend) {
    case 'up':
      return <TrendingUp color="success" sx={{ fontSize: 16 }} />
    case 'down':
      return <TrendingDown color="danger" sx={{ fontSize: 16 }} />
    default:
      return <TrendingFlat color="neutral" sx={{ fontSize: 16 }} />
  }
}

const OutcomeCard = ({ 
  outcome, 
  type, 
  teamName,
  oddsFormat 
}: { 
  outcome: BettingOutcome
  type: string
  teamName: string
  oddsFormat: 'decimal' | 'american'
}) => {
  const isPositiveTrend = outcome.odds_trend === 'up'
  const openingDiff = (parseFloat(outcome.odds) - parseFloat(outcome.opening_odds)).toFixed(3)
  
  return (
    <Sheet
      variant="soft"
      sx={{
        p: 2,
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 'md',
        }
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography level="body-sm" fontWeight="lg">
            {type === 'home' ? '🏠' : '✈️'} {teamName}
          </Typography>
          <OddsTrendIcon trend={outcome.odds_trend} />
        </Stack>
        
        <Typography level="h3" fontWeight="xl" color="primary">
          {formatOdds(outcome.odds, oddsFormat)}
        </Typography>
        
        {outcome.spread && (
          <Chip size="sm" color="warning" variant="soft">
            Spread: {outcome.spread}
          </Chip>
        )}
        
        <Divider />
        
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography level="body-xs" textColor="text.tertiary">
            Opening: {formatOdds(outcome.opening_odds, oddsFormat)}
          </Typography>
          <Chip 
            size="sm" 
            color={parseFloat(openingDiff) > 0 ? 'success' : 'danger'}
            variant="soft"
          >
            {parseFloat(openingDiff) > 0 ? '+' : ''}{openingDiff}
          </Chip>
        </Stack>
      </Stack>
    </Sheet>
  )
}

const BookCard = ({ 
  book, 
  game,
  oddsFormat 
}: { 
  book: BettingBook
  game: BettingGame
  oddsFormat: 'decimal' | 'american'
}) => {
  const homeTeam = NBA_TEAMS[game.homeTeamId]
  const awayTeam = NBA_TEAMS[game.awayTeamId]
  
  const homeOutcome = book.outcomes.find(o => o.type === 'home')
  const awayOutcome = book.outcomes.find(o => o.type === 'away')
  
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={2}>
          {/* Sportsbook Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <MonetizationOn color="warning" />
              <Typography level="title-lg" fontWeight="lg">
                {book.name}
              </Typography>
              <Chip size="sm" variant="soft">
                {book.countryCode}
              </Chip>
            </Stack>
            {book.url && (
              <Tooltip title="Visit sportsbook">
                <IconButton 
                  size="sm" 
                  variant="soft"
                  component="a"
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNew />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          
          <Divider />
          
          {/* Outcomes Grid */}
          <Grid container spacing={2}>
            {awayOutcome && (
              <Grid xs={12} sm={6}>
                <OutcomeCard 
                  outcome={awayOutcome}
                  type="away"
                  teamName={awayTeam?.abbr || 'Away'}
                  oddsFormat={oddsFormat}
                />
              </Grid>
            )}
            {homeOutcome && (
              <Grid xs={12} sm={6}>
                <OutcomeCard 
                  outcome={homeOutcome}
                  type="home"
                  teamName={homeTeam?.abbr || 'Home'}
                  oddsFormat={oddsFormat}
                />
              </Grid>
            )}
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  )
}

const GameOddsCard = ({ 
  game, 
  oddsFormat 
}: { 
  game: BettingGame
  oddsFormat: 'decimal' | 'american'
}) => {
  const homeTeam = NBA_TEAMS[game.homeTeamId]
  const awayTeam = NBA_TEAMS[game.awayTeamId]
  const [selectedMarket, setSelectedMarket] = useState(0)
  
  if (!homeTeam || !awayTeam) {
    return null
  }
  
  const marketNames = game.markets.map(m => {
    switch (m.name) {
      case '2way':
        return 'Moneyline'
      case 'spread':
        return 'Point Spread'
      case 'total':
        return 'Over/Under'
      default:
        return m.name
    }
  })
  
  return (
    <Card 
      variant="outlined" 
      sx={{ 
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${homeTeam.colors[0]}15 0%, ${awayTeam.colors[0]}15 100%)`
      }}
    >
      <CardContent>
        <Stack spacing={3}>
          {/* Game Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Stack 
              direction="row" 
              spacing={2} 
              alignItems="center" 
              justifyContent="center"
              sx={{ mb: 2 }}
            >
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography level="h4" fontWeight="xl" sx={{ mb: 0.5 }}>
                  {awayTeam.abbr}
                </Typography>
                <Typography level="body-xs" textColor="text.secondary">
                  {awayTeam.name}
                </Typography>
              </Box>
              
              <Chip size="lg" color="primary" variant="solid">
                VS
              </Chip>
              
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography level="h4" fontWeight="xl" sx={{ mb: 0.5 }}>
                  {homeTeam.abbr}
                </Typography>
                <Typography level="body-xs" textColor="text.secondary">
                  {homeTeam.name}
                </Typography>
              </Box>
            </Stack>
            
            <Typography level="body-xs" textColor="text.tertiary">
              Game ID: {game.gameId}
            </Typography>
          </Box>
          
          {/* Best Odds Comparison */}
          <BestOddsComparison 
            game={game}
            oddsFormat={oddsFormat}
            homeTeamName={homeTeam.abbr}
            awayTeamName={awayTeam.abbr}
          />
          
          {/* Market Tabs */}
          <Tabs 
            value={selectedMarket} 
            onChange={(_, value) => setSelectedMarket(value as number)}
          >
            <TabList>
              {marketNames.map((name, idx) => (
                <Tab key={idx} value={idx}>
                  {name}
                </Tab>
              ))}
            </TabList>
            
            {game.markets.map((market, idx) => (
              <TabPanel key={idx} value={idx}>
                <Grid container spacing={2}>
                  {market.books.map((book, bookIdx) => (
                    <Grid key={bookIdx} xs={12} lg={6}>
                      <BookCard 
                        book={book} 
                        game={game}
                        oddsFormat={oddsFormat}
                      />
                    </Grid>
                  ))}
                  {market.books.length === 0 && (
                    <Grid xs={12}>
                      <Alert color="neutral">
                        No sportsbooks available for this market
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </TabPanel>
            ))}
          </Tabs>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function Betting() {
  const { data, isLoading, error, refetch } = useBettingOdds()
  const [oddsFormat, setOddsFormat] = useState<'decimal' | 'american'>('american')
  const [showCalculator, setShowCalculator] = useState(false)
  
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 4 }}>
      {/* Hero Section */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography level="h1" sx={{ mb: 2, fontSize: '3rem', fontWeight: 'bold' }}>
          💰 Live Betting Odds
        </Typography>
        <Typography level="h4" sx={{ mb: 3, color: 'text.secondary' }}>
          Real-time NBA betting lines and spreads from top sportsbooks
        </Typography>
        
        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip color="primary" variant="soft" size="lg">
            Live Odds
          </Chip>
          <Chip color="success" variant="soft" size="lg">
            Multiple Books
          </Chip>
          <Chip color="warning" variant="soft" size="lg">
            Line Movement
          </Chip>
          <Chip color="danger" variant="soft" size="lg">
            Auto-Refresh
          </Chip>
        </Stack>
      </Box>
      
      {/* Controls Bar */}
      <Sheet 
        variant="soft" 
        sx={{ 
          p: 2, 
          mb: 3, 
          borderRadius: 'md',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography level="body-sm" fontWeight="lg">
            Odds Format:
          </Typography>
          <Select
            value={oddsFormat}
            onChange={(_, value) => setOddsFormat(value as 'decimal' | 'american')}
            size="sm"
            sx={{ minWidth: 120 }}
          >
            <Option value="american">American (+/-)</Option>
            <Option value="decimal">Decimal</Option>
          </Select>
        </Stack>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography level="body-xs" textColor="text.tertiary">
            Auto-refreshing every 60s
          </Typography>
          <Button
            startDecorator={<Refresh />}
            size="sm"
            variant="soft"
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh Now
          </Button>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            onClick={() => setShowCalculator(!showCalculator)}
          >
            {showCalculator ? 'Hide' : 'Show'} Calculator
          </Button>
        </Stack>
      </Sheet>
      
      {/* Odds Calculator */}
      {showCalculator && (
        <Box sx={{ mb: 3 }}>
          <OddsCalculator />
        </Box>
      )}
      
      {/* Disclaimer */}
      <Alert 
        color="warning" 
        variant="soft" 
        sx={{ mb: 3 }}
        startDecorator={<Info />}
      >
        <Stack spacing={1}>
          <Typography level="title-sm">
            Responsible Gambling Disclaimer
          </Typography>
          <Typography level="body-sm">
            This information is for entertainment purposes only. Always gamble responsibly. 
            If you have a gambling problem, please seek help. Must be 21+ to gamble.
          </Typography>
        </Stack>
      </Alert>
      
      {/* Loading State */}
      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size="lg" />
          <Typography level="body-sm" sx={{ mt: 2 }}>
            Loading betting odds...
          </Typography>
        </Box>
      )}
      
      {/* Error State */}
      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          <Typography level="title-sm">Error loading odds</Typography>
          <Typography level="body-sm">
            {error.message || 'Failed to fetch betting odds. Please try again later.'}
          </Typography>
        </Alert>
      )}
      
      {/* Games List */}
      {data && data.games && data.games.length > 0 ? (
        <Stack spacing={3}>
          {data.games.map((game) => (
            <GameOddsCard 
              key={game.gameId} 
              game={game}
              oddsFormat={oddsFormat}
            />
          ))}
        </Stack>
      ) : (
        !isLoading && (
          <Card variant="outlined" sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                🏀 No games with betting odds today
              </Typography>
              <Typography level="body-lg" textColor="text.secondary">
                Check back later for updated betting lines and odds
              </Typography>
            </CardContent>
          </Card>
        )
      )}
      
      {/* Footer Info */}
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography level="body-xs" textColor="text.tertiary">
          Odds data provided by NBA.com • Updated in real-time from various sportsbooks
        </Typography>
        <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 1 }}>
          🎲 Trends indicate line movement: 📈 = odds increasing, 📉 = odds decreasing
        </Typography>
      </Box>
    </Box>
  )
}

