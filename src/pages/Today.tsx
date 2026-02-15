import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  Sheet,
  Avatar,
  Card,
  CardContent,
  CardActions,
  CardOverflow,
  Grid,
  IconButton,
  Chip,
  Tooltip,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Divider,
  CircularProgress,
  Alert,
  AspectRatio,
  Tabs,
  TabList,
  Tab,
  FormControl,
  FormLabel,
  Select,
  Option,
} from '@mui/joy';
import { NavigateBefore, NavigateNext, NavigateNext as NavigateNextIcon, Info, CalendarToday, PlayArrow, Queue, PlaylistPlay, CheckCircle, Favorite, Star, Add, FavoriteBorder, Search, EmojiEvents, BarChart, TrendingUp, CalendarMonth, Close, ArrowBack, Analytics, Check, KeyboardArrowRight, Share } from '@mui/icons-material';
import { FaBasketballBall, FaFilter, FaSort, FaChartBar } from 'react-icons/fa';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useMediaQuery } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { supabase } from '../utils/supabase';
import { useStandings } from '../hooks/useStandings';
import { useTodayModuleVisibility } from '../hooks/useTodayModuleVisibility';
import { useQuery } from '@tanstack/react-query';
import { useQueryWithPreviousData } from '../hooks/useQueryWithPreviousData';
import { getTeamColors, getTeamPrimaryColor, getTeamSecondaryColor } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import GameDetailView from '../components/GameDetailView';
import LoadingAvatar from '../components/LoadingAvatar';
import PlayerJersey from '../components/PlayerJersey';
import { useUserProfile, useFavoriteTeams, useToggleFavoriteTeam } from '../hooks/useUserSettings';
import { usePlayerFavorites, useAddToFavorites, useRemoveFromFavorites } from '../hooks/usePlayerFavorites';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { DayCalendarSkeleton } from '@mui/x-date-pickers/DayCalendarSkeleton';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useGamesByDate } from '../hooks/useGamesByDate';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import dayjs, { Dayjs } from 'dayjs';
import { FeedPost } from '../utils/feedAlgorithm';
import { matchPlayerNames } from '../utils/playerNameMatcher';
import TodayPast from '../components/Today/TodayPast';
import TodayPresent from '../components/Today/TodayPresent';
import TodayFuture from '../components/Today/TodayFuture';
import TodayWeekly from '../components/Today/TodayWeekly';
import { usePlayerSearch, SearchResult } from '../hooks/usePlayerSearch';
import { getTodayEST as getTodayESTUtil, utcToESTDate, formatESTTime, isDateInEST } from '../utils/nbaDateUtils';
import { matchPropsGamesToNbaGames, getNbaGameIdForPropsGame } from '../utils/matchPropsGamesToNbaGames';
import { cleanPlayerProps, filterGamePropsOnly, type CleanedPlayerProp } from '../utils/cleanPlayerProps';

interface NightPlayer {
  player_id: string | null;
  nba_player_id: number;
  player_name: string;
  team: string;
  player_position: string;
  jersey_number: string;
  salary: number;
  fantasy_points: number;
  games_played: number;
  lineup_order?: number;
  lineup_unit?: string;
  unit_position?: number;
  weighted_points?: number;
}

interface WeekPlayer {
  player_id: string | null;
  nba_player_id: number;
  player_name: string;
  team: string;
  player_position: string;
  jersey_number: string;
  salary: number;
  avg_fantasy_points: number;
  games_played: number;
  lineup_order?: number;
  lineup_unit?: string;
  unit_position?: number;
  weighted_points?: number;
}

interface Leader {
  id: string;
  player_id: string;
  nba_player_id: number;
  team_id: number | null;
  category: string;
  value: number;
  rank: number;
  season: string;
  games_played: number;
  player_name?: string;
  team_abbreviation?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'PTS': 'Points',
  'REB': 'Rebounds',
  'AST': 'Assists',
  'STL': 'Steals',
  'BLK': 'Blocks',
  'FG_PCT': 'FG%',
  'FG3_PCT': '3P%',
  'FT_PCT': 'FT%',
};

// Helper function to get today's date in EST
// Use the utility function from nbaDateUtils
const getTodayEST = getTodayESTUtil;

export default function Today() {
  const [showPropPredictions, setShowPropPredictions] = useState(false);
  const [propPredictionsData, setPropPredictionsData] = useState<{
    pastProps?: any[];
    futureProps?: any[];
    isLoading: boolean;
    activeTab: 'hottest' | 'coldest';
  } | null>(null);
  const { user } = useAuth();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGameIdFromUrl = searchParams.get('gameId');
  const dateFromUrl = searchParams.get('date');
  
  // Ensure scroll is enabled when on Today page (cleanup from other pages)
  // Use useLayoutEffect to run synchronously before paint, ensuring it runs before other effects
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    
    // Force reset any styles that might have been set by other pages (like Highlights)
    const cleanup = () => {
      // Reset html styles - allow natural document scrolling
      html.style.overflow = '';
      html.style.height = '';
      html.style.position = '';
      html.style.width = '';
      html.style.top = '';
      html.style.left = '';
      html.style.touchAction = '';
      html.style.overflowY = '';
      html.style.overflowX = '';
      
      // Reset body styles - allow natural document scrolling
      body.style.overflow = '';
      body.style.height = '';
      body.style.position = '';
      body.style.width = '';
      body.style.top = '';
      body.style.left = '';
      body.style.touchAction = '';
      body.style.overflowY = '';
      body.style.overflowX = '';
      
      // Reset root element if it exists
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
        root.style.position = '';
        root.style.overflowY = '';
        root.style.overflowX = '';
        root.style.touchAction = '';
      }
      
      // Force enable scrolling by ensuring body can scroll
      // Double-check that position is not fixed
      if (body.style.position === 'fixed' || html.style.position === 'fixed') {
        body.style.position = '';
        html.style.position = '';
      }
      
      // Ensure body has proper overflow for scrolling
      if (!body.style.overflow || body.style.overflow === 'hidden') {
        body.style.overflow = '';
      }
      if (!html.style.overflow || html.style.overflow === 'hidden') {
        html.style.overflow = '';
      }
    };
    
    // Global wheel handler to manually scroll window when elements can't scroll
    const handleGlobalWheel = (e: WheelEvent) => {
      // Only handle vertical scrolling
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
        return; // Ignore primarily horizontal scrolls
      }
      
      const target = e.target as HTMLElement;
      if (!target) return;
      
      // Check if the target or any parent is a scrollable container that can actually scroll
      let element: HTMLElement | null = target;
      let foundScrollable = false;
      
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        const overflow = style.overflow;
        
        // Check if this element is scrollable
        if (overflowY === 'auto' || overflowY === 'scroll' || overflow === 'auto' || overflow === 'scroll') {
          const { scrollTop, scrollHeight, clientHeight } = element;
          const canScrollUp = scrollTop > 0;
          const canScrollDown = scrollTop < scrollHeight - clientHeight - 1;
          
          // If element can scroll in the direction of the wheel, let it handle it
          if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
            foundScrollable = true;
            break; // Let the element handle the scroll
          }
        }
        
        element = element.parentElement;
      }
      
      // If no scrollable container can handle this scroll, manually scroll the window
      if (!foundScrollable) {
        window.scrollBy({
          top: e.deltaY,
          left: 0,
          behavior: 'auto'
        });
      }
    };
    
    // Run immediately and synchronously
    cleanup();
    
    // Also run after a microtask to catch anything that runs after layout
    Promise.resolve().then(cleanup);
    
    // Run multiple times to catch any late-running effects from other pages
    const timeoutId = setTimeout(cleanup, 0);
    const timeoutId2 = setTimeout(cleanup, 50);
    const timeoutId3 = setTimeout(cleanup, 100);
    const timeoutId4 = setTimeout(cleanup, 200);
    
    // Add global wheel listener to handle scrolling when elements can't scroll
    window.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
      cleanup();
    };
  }, []);
  
  // Games calendar state - use dayjs, start with today in EST or date from URL
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => {
    // If date is in URL, use it (for shareable links)
    if (dateFromUrl) {
      const parsedDate = dayjs(dateFromUrl);
      if (parsedDate.isValid()) {
        return parsedDate;
      }
    }
    // Otherwise default to today
    const todayEST = getTodayEST();
    return dayjs(todayEST);
  });
  
  // Track if we're updating from URL to avoid loops
  const isUpdatingFromUrlRef = useRef(false);
  // Track the current URL date to avoid unnecessary updates
  const currentUrlDateRef = useRef<string | null>(dateFromUrl);
  
  // Week summary insert page state
  // When true, we're showing a week summary page between weeks
  const [isWeekSummary, setIsWeekSummary] = useState(false);
  const [weekSummaryWeekNumber, setWeekSummaryWeekNumber] = useState<number | null>(null);

  // Fetch scoreboard for the selected date (not always today)
  const selectedDateString = selectedDate.format('YYYY-MM-DD');
  
  // Sync selectedDate to URL query parameter (for shareable links)
  useEffect(() => {
    // Don't update URL if we're currently updating from URL (avoid loops)
    if (isUpdatingFromUrlRef.current) {
      return;
    }
    
    const todayEST = getTodayEST();
    const isToday = selectedDateString === todayEST;
    const currentUrlDate = searchParams.get('date');
    
    // Check if URL already matches what we want
    if (!isToday && currentUrlDate === selectedDateString) {
      currentUrlDateRef.current = selectedDateString;
      return; // URL already correct, no update needed
    }
    
    if (isToday && !currentUrlDate) {
      currentUrlDateRef.current = null;
      return; // URL already correct (no date param for today), no update needed
    }
    
    // Only update URL if date is different from today (today doesn't need ?date param)
    if (!isToday) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('date', selectedDateString);
      currentUrlDateRef.current = selectedDateString;
      setSearchParams(newParams, { replace: true });
    } else {
      // If viewing today, remove date param if it exists
      if (searchParams.has('date')) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('date');
        currentUrlDateRef.current = null;
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [selectedDateString, setSearchParams]); // Removed searchParams from deps to prevent loops
  
  // Handle URL date parameter changes (e.g., browser back/forward, direct link)
  useEffect(() => {
    // Don't process if we're the ones updating the URL
    if (isUpdatingFromUrlRef.current) {
      return;
    }
    
    const urlDate = searchParams.get('date');
    
    // If URL date changed externally (browser nav, direct link)
    if (urlDate !== currentUrlDateRef.current) {
      currentUrlDateRef.current = urlDate;
      
      if (urlDate) {
        const parsedDate = dayjs(urlDate);
        if (parsedDate.isValid() && parsedDate.format('YYYY-MM-DD') !== selectedDateString) {
          isUpdatingFromUrlRef.current = true;
          setSelectedDate(parsedDate);
          // Reset flag after state update
          setTimeout(() => {
            isUpdatingFromUrlRef.current = false;
          }, 0);
        }
      } else {
        // URL has no date param - if we're not viewing today, we could reset
        // But we'll let the user navigate manually to avoid unexpected jumps
        const todayEST = getTodayEST();
        if (selectedDateString !== todayEST) {
          // URL says "today" but we're viewing a different date
          // This could be from browser back button - we'll keep current date
          // User can manually navigate if they want
        }
      }
    }
  }, [searchParams]); // Only depend on searchParams, not selectedDateString
  
  // Reset week summary state when date changes via date picker (not navigation buttons)
  // We track the previous date to detect when it changes externally
  const prevSelectedDateRef = useRef<string>('');
  
  useEffect(() => {
    // Initialize on first render
    if (prevSelectedDateRef.current === '') {
      prevSelectedDateRef.current = selectedDateString;
      return;
    }
    // If date changed and we're in week summary mode, exit week summary mode
    // (This handles date picker changes, but navigation buttons handle their own state)
    if (prevSelectedDateRef.current !== selectedDateString && isWeekSummary) {
      console.log('📅 Date changed externally, exiting week summary mode');
      setIsWeekSummary(false);
      setWeekSummaryWeekNumber(null);
    }
    prevSelectedDateRef.current = selectedDateString;
  }, [selectedDateString, isWeekSummary]);
  
  // Debug: Log when isWeekSummary changes (commented out to reduce console noise)
  // useEffect(() => {
  //   console.log('🔄 isWeekSummary changed:', isWeekSummary, 'weekSummaryWeekNumber:', weekSummaryWeekNumber, 'selectedDate:', selectedDateString);
  // }, [isWeekSummary, weekSummaryWeekNumber, selectedDateString]);
  
  // Auto-update selected date when the actual date changes in EST
  // This ensures that when the date rolls over in EST, the app shows games for the new date
  // BUT: Only if user is viewing "today" (not a specific past/future date from URL)
  const prevTodayESTRef = useRef<string>(getTodayEST());
  
  useEffect(() => {
    const checkDateChange = () => {
      const currentTodayEST = getTodayEST();
      const currentSelectedDateString = selectedDate.format('YYYY-MM-DD');
      const urlDate = searchParams.get('date');
      
      // Only auto-update if:
      // 1. EST date has changed
      // 2. User is viewing "today" (selected date matches previous today)
      // 3. There's no date in URL (user is on default "today" view, not a shared link)
      if (
        currentTodayEST !== prevTodayESTRef.current && 
        currentSelectedDateString === prevTodayESTRef.current &&
        !urlDate // Don't auto-update if user has a specific date in URL
      ) {
        console.log('📅 EST date changed from', prevTodayESTRef.current, 'to', currentTodayEST, '- updating selected date');
        isUpdatingFromUrlRef.current = true;
        setSelectedDate(dayjs(currentTodayEST));
        setTimeout(() => {
          isUpdatingFromUrlRef.current = false;
        }, 0);
        prevTodayESTRef.current = currentTodayEST;
      } else if (currentTodayEST !== prevTodayESTRef.current) {
        // Update the ref even if we're not viewing today
        prevTodayESTRef.current = currentTodayEST;
      }
    };
    
    // Check immediately
    checkDateChange();
    
    // Check every minute to catch date changes
    const interval = setInterval(checkDateChange, 60000);
    
    return () => clearInterval(interval);
  }, [selectedDate, searchParams]);
  
  const todayEST = getTodayEST();
  const isSelectedDateToday = selectedDateString === todayEST;
  
  // Hardcoded NBA 2025-26 season weeks as fallback (from official NBA schedule)
  const NBA_SEASON_WEEKS_2026 = useMemo(() => [
    { week_number: 1, week_name: 'Week 1', start_date: '2025-10-21', end_date: '2025-10-26' },
    { week_number: 2, week_name: 'Week 2', start_date: '2025-10-27', end_date: '2025-11-02' },
    { week_number: 3, week_name: 'Week 3', start_date: '2025-11-03', end_date: '2025-11-09' },
    { week_number: 4, week_name: 'Week 4', start_date: '2025-11-10', end_date: '2025-11-16' },
    { week_number: 5, week_name: 'Week 5', start_date: '2025-11-17', end_date: '2025-11-23' },
    { week_number: 6, week_name: 'Week 6', start_date: '2025-11-24', end_date: '2025-11-30' },
    { week_number: 7, week_name: 'Week 7', start_date: '2025-12-01', end_date: '2025-12-07' },
    { week_number: 8, week_name: 'Week 8', start_date: '2025-12-08', end_date: '2025-12-14' },
    { week_number: 9, week_name: 'Week 9', start_date: '2025-12-15', end_date: '2025-12-21' },
    { week_number: 10, week_name: 'Week 10', start_date: '2025-12-22', end_date: '2025-12-28' },
    { week_number: 11, week_name: 'Week 11', start_date: '2025-12-29', end_date: '2026-01-04' },
    { week_number: 12, week_name: 'Week 12', start_date: '2026-01-05', end_date: '2026-01-11' },
    { week_number: 13, week_name: 'Week 13', start_date: '2026-01-12', end_date: '2026-01-18' },
    { week_number: 14, week_name: 'Week 14', start_date: '2026-01-19', end_date: '2026-01-25' },
    { week_number: 15, week_name: 'Week 15', start_date: '2026-01-26', end_date: '2026-02-01' },
    { week_number: 16, week_name: 'Week 16', start_date: '2026-02-02', end_date: '2026-02-08' },
    { week_number: 17, week_name: 'Week 17', start_date: '2026-02-09', end_date: '2026-02-15' },
    { week_number: 18, week_name: 'Week 18', start_date: '2026-02-16', end_date: '2026-02-22' },
    { week_number: 19, week_name: 'Week 19', start_date: '2026-02-23', end_date: '2026-03-01' },
    { week_number: 20, week_name: 'Week 20', start_date: '2026-03-02', end_date: '2026-03-08' },
    { week_number: 21, week_name: 'Week 21', start_date: '2026-03-09', end_date: '2026-03-15' },
    { week_number: 22, week_name: 'Week 22', start_date: '2026-03-16', end_date: '2026-03-22' },
    { week_number: 23, week_name: 'Week 23', start_date: '2026-03-23', end_date: '2026-03-29' },
    { week_number: 24, week_name: 'Week 24', start_date: '2026-03-30', end_date: '2026-04-05' },
    { week_number: 25, week_name: 'Week 25', start_date: '2026-04-06', end_date: '2026-04-12' },
    { week_number: 26, week_name: 'Week 26', start_date: '2026-04-13', end_date: '2026-04-19' },
  ], []);
  
  // Check if selected date is the first day of a week
  const { data: weekForDate, isLoading: weekLoading } = useQuery({
    queryKey: ['nba-season-week-for-date', selectedDateString],
    queryFn: async () => {
      const date = dayjs(selectedDateString);
      const year = date.year();
      const month = date.month() + 1;
      // NBA season 2025-2026 has season_year=2026
      // October+ is the start of new season (e.g., Oct 2025 = season 2026)
      // Jan-Sep is part of previous season (e.g., Jan 2026 = season 2026)
      const seasonYear = month >= 10 ? year + 1 : year;
      
      let allWeeks: any[] = [];
      
      // Try to fetch from database first
      const { data: dbWeeks, error } = await supabase
        .from('nba_season_weeks')
        .select('*')
        .eq('league_id', 0)
        .eq('season_year', seasonYear)
        .order('week_number', { ascending: true });
      
      if (error || !dbWeeks || dbWeeks.length === 0) {
        // Use hardcoded fallback for 2025-26 season
        console.log('📅 Using hardcoded season weeks fallback for season:', seasonYear);
        allWeeks = NBA_SEASON_WEEKS_2026.map((w, i) => ({
          ...w,
          id: i + 1,
          league_id: 0,
          season_year: 2026,
        }));
      } else {
        allWeeks = dbWeeks;
      }
      
      // Find the week that contains the selected date
      for (const w of allWeeks) {
        const start = dayjs(w.start_date);
        const end = dayjs(w.end_date);
        const isFirstDay = date.format('YYYY-MM-DD') === start.format('YYYY-MM-DD');
        const isLastDay = date.format('YYYY-MM-DD') === end.format('YYYY-MM-DD');
        const isInRange = (date.isAfter(start, 'day') || date.isSame(start, 'day')) && (date.isBefore(end, 'day') || date.isSame(end, 'day'));
        
        if (isInRange) {
          console.log('📅 Found week for date:', date.format('YYYY-MM-DD'), {
            week_number: w.week_number,
            week_name: w.week_name,
            start_date: w.start_date,
            end_date: w.end_date,
            isFirstDay,
            isLastDay,
          });
          
          return {
            ...w,
            isFirstDay, // Check if selected date is the first day
            isLastDay, // Check if selected date is the last day
            allWeeks: allWeeks, // Include all weeks for navigation
          };
        }
      }
      
      console.log('⚠️ No week found for date:', date.format('YYYY-MM-DD'), 'seasonYear:', seasonYear);
      return null;
    },
    staleTime: 60 * 60 * 1000,
  });
  
  // Fetch week data for the week summary page
  const { data: weekSummaryData, isLoading: weekSummaryLoading } = useQuery({
    queryKey: ['nba-season-week-summary', weekSummaryWeekNumber],
    queryFn: async () => {
      console.log('🔍 weekSummaryData query running for week:', weekSummaryWeekNumber);
      if (weekSummaryWeekNumber === null) {
        console.log('❌ weekSummaryWeekNumber is null, returning null');
        return null;
      }
      
      // First, try to find the week directly to get its dates, then use those dates to determine season year
      // This ensures we get the correct season year even if selectedDate is from a different week
      let allWeeks: any[] = [];
      
      // Try to fetch from database first - try both 2026 and 2025 season years to be safe
      // We'll determine the correct season year from the week we find
      const { data: dbWeeks2026, error: error2026 } = await supabase
        .from('nba_season_weeks')
        .select('*')
        .eq('league_id', 0)
        .eq('season_year', 2026)
        .order('week_number', { ascending: true });
      
      if (!error2026 && dbWeeks2026 && dbWeeks2026.length > 0) {
        allWeeks = dbWeeks2026;
      } else {
        // Use hardcoded fallback for 2025-26 season
        console.log('📅 Using hardcoded fallback for week summary');
        allWeeks = NBA_SEASON_WEEKS_2026.map((w, i) => ({
          ...w,
          id: i + 1,
          league_id: 0,
          season_year: 2026,
        }));
      }
      
      const week = allWeeks.find((w: any) => w.week_number === weekSummaryWeekNumber);
      if (!week) {
        console.log('❌ Week not found for week_number:', weekSummaryWeekNumber, 'Available weeks:', allWeeks.map(w => w.week_number));
        return null;
      }
      
      console.log('✅ Found week summary data:', week.week_name, week.start_date, week.end_date);
      return {
        ...week,
        allWeeks: allWeeks,
      };
    },
    enabled: isWeekSummary && weekSummaryWeekNumber !== null,
    staleTime: 60 * 60 * 1000,
  });

  // Show week view when on the week summary insert page
  const isWeekView = isWeekSummary;

  // Function to navigate to previous week's last day (when on first day of current week)
  const navigateToPreviousWeekLastDay = useMemo(() => {
    if (!weekForDate?.allWeeks || !weekForDate.isFirstDay) return null;
    
    const currentWeekIndex = weekForDate.allWeeks.findIndex((w: any) => w.id === weekForDate.id);
    if (currentWeekIndex > 0) {
      const previousWeek = weekForDate.allWeeks[currentWeekIndex - 1];
      return dayjs(previousWeek.end_date); // Last day of previous week
    }
    return null;
  }, [weekForDate]);

  // Function to navigate to first day of NEXT week (when on week summary, pressing RIGHT)
  // The summary page is the insert page BEFORE the next week, so clicking RIGHT goes to next week's first day
  const navigateToNextWeekFirstDay = useMemo(() => {
    if (!isWeekSummary || !weekSummaryData?.allWeeks || weekSummaryWeekNumber === null) return null;
    
    const nextWeekIndex = weekSummaryData.allWeeks.findIndex((w: any) => w.week_number === weekSummaryWeekNumber + 1);
    if (nextWeekIndex >= 0) {
      const nextWeek = weekSummaryData.allWeeks[nextWeekIndex];
      return dayjs(nextWeek.start_date); // First day of next week
    }
    return null;
  }, [isWeekSummary, weekSummaryData, weekSummaryWeekNumber]);

  // Function to navigate to previous week's last day (when on week summary, pressing LEFT)
  const navigateToPreviousWeekLastDayFromSummary = useMemo(() => {
    if (!isWeekSummary || !weekSummaryData?.allWeeks) return null;
    
    const currentWeekIndex = weekSummaryData.allWeeks.findIndex((w: any) => w.week_number === weekSummaryWeekNumber);
    if (currentWeekIndex > 0) {
      const previousWeek = weekSummaryData.allWeeks[currentWeekIndex - 1];
      return dayjs(previousWeek.end_date); // Last day of previous week
    }
    return null;
  }, [isWeekSummary, weekSummaryData, weekSummaryWeekNumber]);

  // Function to get the next week number for navigation (when on last day of current week, pressing RIGHT)
  const getNextWeekNumber = useMemo(() => {
    if (!weekForDate?.allWeeks || !weekForDate.isLastDay) return null;
    
    const currentWeekIndex = weekForDate.allWeeks.findIndex((w: any) => w.id === weekForDate.id);
    if (currentWeekIndex < weekForDate.allWeeks.length - 1) {
      const nextWeek = weekForDate.allWeeks[currentWeekIndex + 1];
      return nextWeek.week_number;
    }
    return null;
  }, [weekForDate]);
  
  // Determine date state: past, present (today), or future
  const dateState = useMemo(() => {
    const selected = dayjs(selectedDateString);
    const today = dayjs(todayEST);
    
    if (selected.isBefore(today, 'day')) {
      return 'past';
    } else if (selected.isAfter(today, 'day')) {
      return 'future';
    } else {
      return 'present';
    }
  }, [selectedDateString, todayEST]);

  // Determine week state: past, present (current week), or future
  const weekState = useMemo(() => {
    if (!weekForDate) return null;
    
    const today = dayjs(todayEST);
    const weekStart = dayjs(weekForDate.start_date);
    const weekEnd = dayjs(weekForDate.end_date);
    
    if (weekEnd.isBefore(today, 'day')) {
      return 'past';
    } else if (weekStart.isAfter(today, 'day')) {
      return 'future';
    } else {
      return 'present';
    }
  }, [weekForDate, todayEST]);

  // Determine if we should show week summary for a given week
  // Week summary should ONLY show BEFORE a week starts (future weeks)
  const shouldShowWeekSummary = useMemo(() => {
    if (!weekSummaryData) return false;
    
    const today = dayjs(todayEST);
    const weekStart = dayjs(weekSummaryData.start_date);
    
    // Only show week summary if the week hasn't started yet (future)
    return weekStart.isAfter(today, 'day');
  }, [weekSummaryData, todayEST]);

  // Auto-navigate away from week summary if week has started
  useEffect(() => {
    if (isWeekSummary && weekSummaryData && !shouldShowWeekSummary) {
      // Week has started, navigate to first day of the week
      const weekStart = dayjs(weekSummaryData.start_date);
      setIsWeekSummary(false);
      setWeekSummaryWeekNumber(null);
      setSelectedDate(weekStart);
    }
  }, [isWeekSummary, weekSummaryData, shouldShowWeekSummary]);
  
  // Only use live scoreboard for today (with refetch interval)
  // For past dates, use static games data (no refetch)
  const { data: nbaScoreboard, isLoading: scoreboardLoading } = useNBAScoreboard(
    isSelectedDateToday ? selectedDateString : undefined
  );
  const { data: gamesByDate, isLoading: gamesByDateLoading } = useGamesByDate(
    isSelectedDateToday ? null : selectedDateString
  );
  
  const { data: standings, isLoading: standingsLoading } = useStandings();
  const [favoriteTeamAbbreviations, setFavoriteTeamAbbreviations] = useState<Set<string>>(new Set());
  
  // Fetch module visibility settings
  const { data: moduleVisibility, isLoading: moduleVisibilityLoading } = useTodayModuleVisibility();

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    };

    if (datePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [datePickerOpen]);
  const [favoritePlayerIds, setFavoritePlayerIds] = useState<Set<number>>(new Set());

  // User dashboard data (only fetch if logged in)
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: favoritePlayers } = usePlayerFavorites();

  // Detect landscape mobile orientation to adjust padding
  const isMobile = useMediaQuery('(max-width: 900px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isLandscapeMobile = isMobile && isLandscape

  // Fetch user favorites
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user?.id) {
        setFavoriteTeamAbbreviations(new Set())
        setFavoritePlayerIds(new Set())
        return
      }

      try {
        const { data: favoritePlayers } = await supabase
          .from('player_favorites')
          .select(`
            player_id,
            nba_players (
              nba_player_id
            )
          `)
          .eq('user_id', user.id)
        
        const playerIds = new Set<number>()
        if (favoritePlayers) {
          favoritePlayers.forEach((fp: any) => {
            const nbaPlayerId = fp.nba_players?.nba_player_id
            if (nbaPlayerId && typeof nbaPlayerId === 'number') {
              playerIds.add(nbaPlayerId)
            }
          })
        }
        setFavoritePlayerIds(playerIds)
        
        const { data: favoriteTeams } = await supabase
          .from('user_favorite_teams')
          .select(`
            team_id,
            nba_teams (
              abbreviation
            )
          `)
          .eq('user_id', user.id)
        
        const teamAbbreviations = new Set<string>()
        if (favoriteTeams) {
          favoriteTeams.forEach((ft: any) => {
            const abbreviation = ft.nba_teams?.abbreviation
            if (abbreviation) {
              teamAbbreviations.add(abbreviation)
            }
          })
        }
        setFavoriteTeamAbbreviations(teamAbbreviations)
      } catch (error) {
        console.error('Error fetching favorites:', error)
      }
    }
    
    fetchFavorites()
  }, [user?.id])

  // Transform GameByDate to NBAGame format for avatar bar
  const transformedGames = useMemo(() => {
    if (isSelectedDateToday) {
      // Filter scoreboard games to ensure they're actually on the selected EST date
      // This prevents showing games from yesterday that might still be "live"
      if (!nbaScoreboard?.games) return [];
      
      return nbaScoreboard.games.filter((game: any) => {
        // Check if the game's date matches the selected date in EST
        // game.gameDate is a YYYY-MM-DD string from UTC timestamp, need to convert to EST
        const gameDate = game.gameDate || game.game_date;
        if (!gameDate) return false;
        
        // gameDate might be a UTC date string (YYYY-MM-DD) or a full timestamp
        // Convert to EST date and check if it matches selectedDateString
        try {
          // If it's just a date string (YYYY-MM-DD), treat it as UTC midnight and convert to EST
          // If it's a full timestamp, use isDateInEST directly
          if (gameDate.includes('T') || gameDate.includes(' ')) {
            // Full timestamp - use isDateInEST
            return isDateInEST(gameDate, selectedDateString);
          } else {
            // Date string only - treat as UTC midnight and convert to EST
            const utcDate = new Date(gameDate + 'T00:00:00Z');
            const estDateString = utcToESTDate(utcDate);
            return estDateString === selectedDateString;
          }
        } catch (e) {
          console.warn('Error filtering game date:', gameDate, e);
          return false;
        }
      });
    }
    
    // Transform gamesByDate to NBAGame format
    if (!gamesByDate || gamesByDate.length === 0) return [];
    
    return gamesByDate.map((game): any => {
      // Map game_status_text to gameStatus number
      let gameStatus = 1; // Scheduled
      if (game.game_status_text === 'Live' || game.game_status_text === 'In Progress') {
        gameStatus = 2; // Live
      } else if (game.game_status_text === 'Final') {
        gameStatus = 3; // Final
      }
      
      return {
        gameId: game.game_id,
        gameDate: game.game_date,
        gameStatus,
        gameStatusText: game.game_status_text,
        homeTeam: {
          id: 0, // We don't have team IDs from this query
          abbreviation: game.home_team_tricode,
          city: '',
          name: game.home_team_name,
          wins: 0,
          losses: 0,
          points: game.home_team_score,
          quarters: [],
        },
        awayTeam: {
          id: 0,
          abbreviation: game.away_team_tricode,
          city: '',
          name: game.away_team_name,
          wins: 0,
          losses: 0,
          points: game.away_team_score,
          quarters: [],
        },
        arena: '',
        nationalTV: undefined,
      };
    });
  }, [isSelectedDateToday, nbaScoreboard?.games, gamesByDate, selectedDateString]);

  // Sort games
  const sortedGames = useMemo(() => {
    if (!transformedGames || transformedGames.length === 0) return [];
    
    const games = [...transformedGames];
    
    if (favoriteTeamAbbreviations.size > 0 || favoritePlayerIds.size > 0) {
      return games.sort((a, b) => {
        const aHasFavoriteTeam = favoriteTeamAbbreviations.has(a.awayTeam.abbreviation) || 
                                  favoriteTeamAbbreviations.has(a.homeTeam.abbreviation);
        const bHasFavoriteTeam = favoriteTeamAbbreviations.has(b.awayTeam.abbreviation) || 
                                  favoriteTeamAbbreviations.has(b.homeTeam.abbreviation);
        
        if (aHasFavoriteTeam && !bHasFavoriteTeam) return -1;
        if (!aHasFavoriteTeam && bHasFavoriteTeam) return 1;
        
        if (a.gameStatus === 2 && b.gameStatus !== 2) return -1;
        if (a.gameStatus !== 2 && b.gameStatus === 2) return 1;
        if (a.gameStatus === 3 && b.gameStatus !== 3) return 1;
        if (a.gameStatus !== 3 && b.gameStatus === 3) return -1;
        
        return 0;
      });
    }
    
    return games.sort((a, b) => {
      if (a.gameStatus === 2 && b.gameStatus !== 2) return -1;
      if (a.gameStatus !== 2 && b.gameStatus === 2) return 1;
      if (a.gameStatus === 3 && b.gameStatus !== 3) return 1;
      if (a.gameStatus !== 3 && b.gameStatus === 3) return -1;
      return 0;
    });
  }, [transformedGames, favoriteTeamAbbreviations, favoritePlayerIds]);
  
  // Determine loading state
  const avatarBarLoading = isSelectedDateToday ? scoreboardLoading : gamesByDateLoading;

  // Handle game avatar click - navigate to game page
  const handleGameClick = (gameId: string) => {
    navigate(`/game/${gameId}`);
  };

  // Calculate allGames for prop predictions (similar to PropPredictionsModule)
  // Need to ensure games have game_id field
  const allGames = useMemo(() => {
    if (isSelectedDateToday && nbaScoreboard?.games) {
      const filteredScoreboardGames = nbaScoreboard.games.filter((game: any) => {
        const gameDate = game.gameDate || game.game_date;
        if (!gameDate) return false;
        
        try {
          if (gameDate.includes('T') || gameDate.includes(' ')) {
            return isDateInEST(gameDate, selectedDateString);
          } else {
            const utcDate = new Date(gameDate + 'T00:00:00Z');
            const estDateString = utcToESTDate(utcDate);
            return estDateString === selectedDateString;
          }
        } catch (e) {
          return false;
        }
      });
      
      // Transform scoreboard games to have game_id
      const transformedScoreboardGames = filteredScoreboardGames.map((game: any) => ({
        ...game,
        game_id: game.gameId || game.game_id,
      }));
      
      if (transformedScoreboardGames.length > 0) {
        return transformedScoreboardGames;
      }
    }
    
    // Return gamesByDate which already has game_id
    return gamesByDate || [];
  }, [isSelectedDateToday, nbaScoreboard, gamesByDate, selectedDateString]);

  // Handle wheel events on the main container to ensure scroll works everywhere
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const handleMainWheel = (e: React.WheelEvent) => {
    // For vertical scrolling, manually scroll the window
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // This is primarily a vertical scroll - scroll the window directly
      window.scrollBy({
        top: e.deltaY,
        left: 0,
        behavior: 'auto'
      });
      // Don't prevent default to allow natural scrolling too
    }
  };

  // Main Today page - scrollable with all content
  return (
    <Box 
      ref={mainContainerRef}
      onWheel={handleMainWheel}
      sx={{ 
        bgcolor: '#000000',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}
    >
      <Box 
        onWheel={handleMainWheel}
        sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          pt: isLandscapeMobile 
            ? '12px'
            : { xs: '12px', md: '80px' },
          pb: { xs: 0, sm: 4, md: 4 },
          px: { xs: 0, sm: 2, md: 2 },
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Stack 
          spacing={4}
          onWheel={handleMainWheel}
        >
          {/* Games Carousel - Header Section (like player page header) */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 1.5,
            mb: 2,
            px: { xs: 2, sm: 0 },
          }}>
            {/* Date Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row' }}>
              {/* Date Navigation - Left side */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  onClick={() => {
                    console.log('⬅️ LEFT CLICK - weekForDate:', weekForDate, 'isWeekSummary:', isWeekSummary, 'selectedDate:', selectedDate.format('YYYY-MM-DD'), 'weekState:', weekState);
                    // If on week summary page, navigate to last day of previous week
                    if (isWeekSummary && navigateToPreviousWeekLastDayFromSummary) {
                      console.log('⬅️ Going to previous week last day from summary');
                      setIsWeekSummary(false);
                      setWeekSummaryWeekNumber(null);
                      setSelectedDate(navigateToPreviousWeekLastDayFromSummary);
                    }
                    // If on first day of a week, go to week summary for PREVIOUS week (only if previous week is future/hasn't started)
                    else if (!weekLoading && weekForDate?.isFirstDay === true && weekForDate?.week_number && weekForDate.week_number > 1) {
                      const prevWeekNumber = weekForDate.week_number - 1;
                      // Check if previous week is future (hasn't started)
                      const prevWeek = weekForDate.allWeeks?.find((w: any) => w.week_number === prevWeekNumber);
                      if (prevWeek) {
                        const today = dayjs(todayEST);
                        const prevWeekStart = dayjs(prevWeek.start_date);
                        // Only show week summary if previous week hasn't started yet
                        if (prevWeekStart.isAfter(today, 'day')) {
                          console.log('⬅️ First day of week detected! Current week:', weekForDate.week_number, 'Going to week summary for week:', prevWeekNumber);
                          setIsWeekSummary(true);
                          setWeekSummaryWeekNumber(prevWeekNumber);
                          return;
                        }
                      }
                    }
                    // Otherwise, navigate day by day
                    console.log('⬅️ Regular day navigation - weekForDate?.isFirstDay:', weekForDate?.isFirstDay, 'weekForDate?.week_number:', weekForDate?.week_number, 'weekState:', weekState);
                    const newDate = selectedDate.subtract(1, 'day');
                    setSelectedDate(newDate);
                  }}
                  sx={{
                    borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  <NavigateBefore />
                </IconButton>
                
                <Typography 
                  level="title-md" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: '#FFFFFF',
                    minWidth: { xs: '120px', sm: '150px' },
                    textAlign: 'center',
                  }}
                >
                  {isWeekSummary && weekSummaryData ? weekSummaryData.week_name : selectedDate.format('MMM D, YYYY')}
                </Typography>
                
                <IconButton
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  onClick={() => {
                    // If on week summary page, navigate to first day of NEXT week
                    if (isWeekSummary && navigateToNextWeekFirstDay) {
                      setIsWeekSummary(false);
                      setWeekSummaryWeekNumber(null);
                      setSelectedDate(navigateToNextWeekFirstDay);
                    }
                    // If on last day of a week AND next week is future (hasn't started), go to week summary for next week
                    else if (weekForDate?.isLastDay && weekForDate.week_number) {
                      const nextWeekNumber = weekForDate.week_number + 1;
                      const nextWeek = weekForDate.allWeeks?.find((w: any) => w.week_number === nextWeekNumber);
                      if (nextWeek) {
                        const today = dayjs(todayEST);
                        const nextWeekStart = dayjs(nextWeek.start_date);
                        // Only show week summary if next week hasn't started yet
                        if (nextWeekStart.isAfter(today, 'day')) {
                          setIsWeekSummary(true);
                          setWeekSummaryWeekNumber(nextWeekNumber);
                          return;
                        }
                      }
                    }
                    // Otherwise, navigate day by day
                    const newDate = selectedDate.add(1, 'day');
                    setSelectedDate(newDate);
                  }}
                  sx={{
                    borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  <NavigateNext />
                </IconButton>
                
                {/* Week and Game Count - Right of date */}
                <WeekAndGameCount selectedDate={selectedDate} />
              </Box>
              
              {/* Date Picker - Right side */}
              <Box ref={datePickerRef} sx={{ position: 'relative' }}>
                <IconButton
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  sx={{
                    borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  <CalendarToday />
                </IconButton>
                {datePickerOpen && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      zIndex: 1000,
                      bgcolor: '#1a1a1a',
                      border: '1px solid #333333',
                      borderRadius: '8px',
                      mt: 1,
                      p: 2,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <ThemeProvider theme={createTheme({
                        palette: {
                          mode: 'dark',
                          primary: {
                            main: '#FFD700',
                          },
                          background: {
                            default: '#1a1a1a',
                            paper: '#1a1a1a',
                          },
                        },
                      })}>
                        <DateCalendar
                          value={selectedDate}
                          onChange={(newValue) => {
                            if (newValue) {
                              setSelectedDate(newValue);
                              setDatePickerOpen(false);
                            }
                          }}
                          minDate={dayjs('2025-01-01')}
                          maxDate={dayjs('2026-12-31')}
                          sx={{
                            width: '100%',
                            '& .MuiPickersDay-root': {
                              color: '#FFFFFF',
                              '&.Mui-selected': {
                                backgroundColor: '#FFD700',
                                color: '#000',
                              },
                            },
                            '& .MuiPickersCalendarHeader-root': {
                              color: '#FFFFFF',
                            },
                            '& .MuiPickersCalendarHeader-label': {
                              color: '#FFFFFF',
                            },
                          }}
                        />
                      </ThemeProvider>
                    </LocalizationProvider>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Games Carousel - In Header Space (only show for daily view, not week view) */}
            {!isWeekView && !moduleVisibilityLoading && moduleVisibility?.games_carousel?.is_visible === true && (
              <GamesCarouselHeader
                selectedDate={selectedDate}
                navigate={navigate}
              />
            )}
          </Box>

          {/* Main Content Area - Split Layout when on week summary page */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Week Summary View - Full width when on week summary insert page */}
            {(() => {
              console.log('🎯 Week Summary Render Check:', {
                isWeekSummary,
                hasWeekSummaryData: !!weekSummaryData,
                weekSummaryLoading,
                weekSummaryWeekNumber,
              });
              return null;
            })()}
            {isWeekSummary && weekSummaryData && !weekSummaryLoading && shouldShowWeekSummary && (
              <Box sx={{ 
                width: '100%',
              }}>
                <TodayWeekly 
                  week={weekSummaryData}
                  navigate={navigate}
                  onNavigateToWeek={(weekNumber) => {
                    setIsWeekSummary(true);
                    setWeekSummaryWeekNumber(weekNumber);
                  }}
                />
              </Box>
            )}
            {isWeekSummary && weekSummaryData && !weekSummaryLoading && !shouldShowWeekSummary && (
              <Box sx={{ width: '100%', p: 4, textAlign: 'center', color: '#FFFFFF' }}>
                <Typography>This week has already started. Navigating to first day of week...</Typography>
              </Box>
            )}
            {isWeekSummary && !weekSummaryData && !weekSummaryLoading && (
              <Box sx={{ width: '100%', p: 4, textAlign: 'center', color: '#FFFFFF' }}>
                <Typography>Loading week summary...</Typography>
                <Typography level="body-sm">Week: {weekSummaryWeekNumber}</Typography>
              </Box>
            )}

            {/* Dashboard Modules - Grid Layout (only show when NOT on week summary page) */}
            {!isWeekSummary && (
              <>
                {showPropPredictions ? (
                  <PropPredictionsFullView
                    selectedDate={selectedDate}
                    navigate={navigate}
                    onClose={() => setShowPropPredictions(false)}
                    allGames={allGames}
                    propsData={propPredictionsData}
                  />
                ) : (
                  <>
                    {dateState === 'past' && (
                      <TodayPast
                        selectedDate={selectedDate}
                        navigate={navigate}
                        standings={standings}
                        standingsLoading={standingsLoading}
                        onOpenPropPredictions={(propsData) => {
                          setPropPredictionsData(propsData);
                          setShowPropPredictions(true);
                        }}
                      />
                    )}
                    {dateState === 'present' && (
                      <TodayPresent
                        selectedDate={selectedDate}
                        navigate={navigate}
                        nbaScoreboard={nbaScoreboard}
                        standings={standings}
                        standingsLoading={standingsLoading}
                        onOpenPropPredictions={(propsData) => {
                          setPropPredictionsData(propsData);
                          setShowPropPredictions(true);
                        }}
                      />
                    )}
                    {dateState === 'future' && (
                      <TodayFuture
                        selectedDate={selectedDate}
                        navigate={navigate}
                        standings={standings}
                        standingsLoading={standingsLoading}
                        onOpenPropPredictions={(propsData) => {
                          setPropPredictionsData(propsData);
                          setShowPropPredictions(true);
                        }}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

// Week View Sidebar Component - Shows on left when on first day of a week
function WeekViewSidebar({ 
  week, 
  selectedDate, 
  navigate,
  dateState 
}: { 
  week: any; 
  selectedDate: Dayjs; 
  navigate: (path: string) => void;
  dateState: 'past' | 'present' | 'future';
}) {
  const weekStart = dayjs(week.start_date);
  const weekEnd = dayjs(week.end_date);
  const isPast = dateState === 'past';
  const isFuture = dateState === 'future';
  
  // Fetch all games for the week
  const { data: weekGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['week-games', week.start_date, week.end_date],
    queryFn: async () => {
      const { data: games, error } = await supabase
        .from('nba_games')
        .select('*')
        .gte('game_date', week.start_date)
        .lte('game_date', week.end_date)
        .order('game_date', { ascending: true })
        .order('game_time_et', { ascending: true });
      
      if (error) {
        console.error('Error fetching week games:', error);
        return [];
      }
      
      return games || [];
    },
  });

  // Fetch prop hit rates for the week (if past)
  const { data: weekPropHitRates, isLoading: propsLoading } = useQuery({
    queryKey: ['week-prop-hit-rates', week.start_date, week.end_date],
    queryFn: async () => {
      if (!isPast) return null;
      
      // Fetch all props for the week
      const { data: props, error } = await supabase
        .from('player_props')
        .select(`
          *,
          player_props_games (
            nba_game_id
          )
        `)
        .gte('game_date', week.start_date)
        .lte('game_date', week.end_date);
      
      if (error || !props || props.length === 0) return null;
      
      // Filter out invalid props
      const filteredProps = props.filter((p: any) => {
        if (p.bet_type?.toLowerCase().includes('point') && p.line < 5.5) {
          return false;
        }
        return p.player_name && p.bet_type && p.line !== null && p.nba_player_id;
      });
      
      // Get unique players
      const playerIds = [...new Set(filteredProps.map((p: any) => p.nba_player_id).filter(Boolean))];
      
      // Fetch boxscores for all players in the week
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, game_id, game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
        .in('nba_player_id', playerIds)
        .gte('game_date', week.start_date)
        .lte('game_date', week.end_date);
      
      if (boxscoreError || !boxscores) return null;
      
      // Create boxscore map
      const boxscoreMap = new Map<string, any>();
      boxscores.forEach((bs: any) => {
        const key = `${bs.nba_player_id}-${bs.game_id}`;
        boxscoreMap.set(key, bs);
      });
      
      // Calculate hit rates per player
      const { calculatePropResult } = await import('../utils/playerPropsCalculator');
      const playerHitRates = new Map<number, { hits: number; total: number; playerName: string; nbaPlayerId: number }>();
      
      filteredProps.forEach((prop: any) => {
        const gameId = prop.player_props_games?.nba_game_id;
        if (!gameId) return;
        
        const key = `${prop.nba_player_id}-${gameId}`;
        const boxscore = boxscoreMap.get(key);
        if (!boxscore) return;
        
        const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
        if (!result) return;
        
        const isOver = prop.bet_type_id?.includes('-over') || prop.bet_type_id?.endsWith('over');
        const isUnder = prop.bet_type_id?.includes('-under') || prop.bet_type_id?.endsWith('under');
        
        const hit = (isOver && result.result === 'over') || (isUnder && result.result === 'under');
        
        if (!playerHitRates.has(prop.nba_player_id)) {
          playerHitRates.set(prop.nba_player_id, {
            hits: 0,
            total: 0,
            playerName: prop.player_name,
            nbaPlayerId: prop.nba_player_id,
          });
        }
        
        const playerData = playerHitRates.get(prop.nba_player_id)!;
        playerData.total++;
        if (hit) playerData.hits++;
      });
      
      return Array.from(playerHitRates.values())
        .map(p => ({
          ...p,
          hitRate: p.total > 0 ? (p.hits / p.total) * 100 : 0,
        }))
        .sort((a, b) => b.hitRate - a.hitRate);
    },
    enabled: isPast,
  });

  // Fetch trending stats (players with biggest improvements this week)
  const { data: trendingStats, isLoading: trendingLoading } = useQuery({
    queryKey: ['week-trending-stats', week.start_date, week.end_date],
    queryFn: async () => {
      if (!isPast) return null;
      
      // This would compare week stats to previous week
      // For now, return empty - can be enhanced later
      return null;
    },
    enabled: isPast,
  });

  // Handle wheel events to allow scroll propagation when at boundaries
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handleSidebarWheel = (e: React.WheelEvent) => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    
    const { scrollTop, scrollHeight, clientHeight } = sidebar;
    const isAtTop = scrollTop <= 0 && e.deltaY < 0;
    const isAtBottom = scrollTop >= scrollHeight - clientHeight - 1 && e.deltaY > 0;
    
    // If at boundary and trying to scroll further, allow scroll to propagate to parent
    if (isAtTop || isAtBottom) {
      // Don't stop propagation - let it bubble up to document
      return;
    }
    
    // Otherwise, stop propagation to keep scroll within sidebar
    e.stopPropagation();
  };

  return (
    <Stack 
      ref={sidebarRef}
      onWheel={handleSidebarWheel}
      spacing={2} 
      sx={{ 
        position: 'sticky', 
        top: { xs: 0, md: 80 }, 
        maxHeight: { md: 'calc(100vh - 100px)' }, 
        overflowY: 'auto',
        // Allow touch scrolling on mobile
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Week Header */}
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          <Box sx={{ mb: 1 }}>
            <Typography level="h3" sx={{ color: '#FFFFFF', fontWeight: 'bold', mb: 0.5 }}>
              {week.week_name}
            </Typography>
            <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 1 }}>
              {weekStart.format('MMM D')} - {weekEnd.format('MMM D, YYYY')}
            </Typography>
            <Chip 
              size="sm"
              variant="soft" 
              color={isPast ? 'neutral' : isFuture ? 'primary' : 'success'}
              sx={{ fontWeight: 600 }}
            >
              {isPast ? 'Past Week' : isFuture ? 'Upcoming Week' : 'Current Week'}
            </Chip>
          </Box>
        </CardContent>
      </Card>

      {/* Best Matchups (Future) */}
      {isFuture && weekGames && weekGames.length > 0 && (
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 'bold', mb: 2 }}>
              Best Matchups
            </Typography>
            {gamesLoading ? (
              <CircularProgress size="sm" />
            ) : (
              <Stack spacing={1.5}>
                {weekGames.slice(0, 5).map((game: any) => (
                  <Card 
                    key={game.game_id}
                    variant="outlined"
                    sx={{ 
                      bgcolor: '#0a0a0a', 
                      borderColor: '#333333',
                      cursor: 'pointer',
                      '&:hover': { borderColor: '#FFC72C' }
                    }}
                    onClick={() => navigate(`/game/${game.game_id}`)}
                  >
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600, mb: 0.5 }}>
                        {game.away_team_tricode} @ {game.home_team_tricode}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#B0B0B0' }}>
                        {dayjs(game.game_date).format('MMM D')} {game.game_time_et || ''}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prop Hit Rates (Past) */}
      {isPast && weekPropHitRates && weekPropHitRates.length > 0 && (
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 'bold', mb: 2 }}>
              Week Prop Performance
            </Typography>
            {propsLoading ? (
              <CircularProgress size="sm" />
            ) : (
              <Table hoverRow size="sm" sx={{ '& tbody tr': { cursor: 'pointer' } }}>
                <thead>
                  <tr>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', padding: '4px' }}>Player</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', padding: '4px' }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {weekPropHitRates.slice(0, 8).map((player: any, index: number) => (
                    <tr 
                      key={player.nbaPlayerId || index}
                      onClick={() => {
                        // Navigate to player page
                        console.log('Navigate to player:', player.nbaPlayerId);
                      }}
                    >
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Avatar 
                            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nbaPlayerId}.png`}
                            alt={player.playerName}
                            sx={{ width: 20, height: 20 }}
                          />
                          <Typography level="body-xs" sx={{ color: '#FFFFFF', fontWeight: 500 }}>
                            {player.playerName?.split(' ').pop() || 'N/A'}
                          </Typography>
                        </Box>
                      </td>
                      <td>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: player.hitRate >= 70 ? '#10B981' : player.hitRate >= 50 ? '#FFC72C' : '#CCCCCC',
                            fontWeight: 600,
                          }}
                        >
                          {player.hitRate.toFixed(0)}%
                        </Typography>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team of the Week - Compact Version */}
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 'bold', mb: 2 }}>
            Team of the Week
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                // Scroll to Team of Week module or navigate
                const element = document.getElementById('team-of-week-module');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              sx={{
                borderColor: '#FFC72C',
                color: '#FFC72C',
                '&:hover': {
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  borderColor: '#FFD700',
                },
              }}
            >
              View Full Team
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

// Week Summary Page Component - Shows when navigating between weeks
// Displays Team of the Week for past weeks, Best Matchups for future weeks

// Games Section Component - Horizontal Scrollable
function GamesSection({
  games,
  isLoading,
  onGameClick
}: {
  games: any[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: '8px' } }}>
        {[...Array(5)].map((_, i) => (
          <Card key={i} variant="outlined" sx={{ minWidth: 200, bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <CardContent>
              <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading...</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (!games || games.length === 0) {
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      overflowX: 'auto', 
      pb: 1,
      '&::-webkit-scrollbar': { 
        height: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: '#1a1a1a',
      },
      '&::-webkit-scrollbar-thumb': {
        background: '#333333',
        borderRadius: '4px',
        '&:hover': {
          background: '#444444',
        },
      },
    }}>
      {games.map((game) => {
        const isFinal = game.gameStatus === 3;
        const isLive = game.gameStatus === 2;
        const hasScore = game.awayTeam.points > 0 || game.homeTeam.points > 0;

        return (
          <Card
            key={game.gameId}
            variant="outlined"
            onClick={() => onGameClick(game.gameId)}
            sx={{
              minWidth: 200,
              bgcolor: '#1a1a1a',
              borderColor: isFinal 
                ? '#333333' 
                : isLive 
                  ? '#FFC72C' 
                  : '#333333',
              borderWidth: isLive ? '2px' : '1px',
              borderStyle: isFinal ? 'dashed' : 'solid',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#FFC72C',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                {/* Away Team */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: getTeamPrimaryColor(game.awayTeam.abbreviation),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={getTeamLogoUrl(game.awayTeam.abbreviation)}
                      alt={game.awayTeam.abbreviation}
                      sx={{
                        width: 24,
                        height: 24,
                        objectFit: 'contain',
                        zIndex: 1,
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </Box>
                  <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600, flex: 1 }}>
                    {game.awayTeam.abbreviation}
                  </Typography>
                  {hasScore && (
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 'bold', minWidth: 30, textAlign: 'right' }}>
                      {game.awayTeam.points}
                    </Typography>
                  )}
                </Box>

                {/* Home Team */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: getTeamPrimaryColor(game.homeTeam.abbreviation),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={getTeamLogoUrl(game.homeTeam.abbreviation)}
                      alt={game.homeTeam.abbreviation}
                      sx={{
                        width: 24,
                        height: 24,
                        objectFit: 'contain',
                        zIndex: 1,
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </Box>
                  <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600, flex: 1 }}>
                    {game.homeTeam.abbreviation}
                  </Typography>
                  {hasScore && (
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 'bold', minWidth: 30, textAlign: 'right' }}>
                      {game.homeTeam.points}
                    </Typography>
                  )}
                </Box>

                {/* Status */}
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={
                      isFinal 
                        ? 'success' 
                        : isLive 
                          ? 'danger'
                          : 'neutral'
                    }
                    sx={{ fontSize: '0.65rem' }}
                  >
                    {game.gameStatusText || (hasScore ? 'Final' : 'Scheduled')}
                  </Chip>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}

// Favorite Player Row Component
function FavoritePlayerRow({
  player,
  onRemove,
  onNavigate,
  isPlayingToday = false
}: {
  player: any;
  onRemove: () => void;
  onNavigate: () => void;
  isPlayingToday?: boolean;
}) {
  // Fetch player season stats
  const { data: seasonStats } = useQuery({
    queryKey: ['player-season-stats-2025-26', player.player_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('pts, reb, ast')
        .eq('player_id', player.player_id)
        .eq('season_year', '2025-26')
        .gte('game_date', '2025-10-21')
        .lte('game_date', '2026-04-12')
        .gt('min', 0);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { ppg: 0, rpg: 0, apg: 0 };
      }

      const totals = data.reduce(
        (acc, game) => {
          acc.pts += game.pts || 0;
          acc.reb += game.reb || 0;
          acc.ast += game.ast || 0;
          acc.games += 1;
          return acc;
        },
        { pts: 0, reb: 0, ast: 0, games: 0 }
      );

      const ppg = totals.games > 0 ? totals.pts / totals.games : 0;
      const rpg = totals.games > 0 ? totals.reb / totals.games : 0;
      const apg = totals.games > 0 ? totals.ast / totals.games : 0;

      return { ppg, rpg, apg };
    },
    enabled: !!player.player_id,
  });

  return (
    <tr
      onClick={onNavigate}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid #333333',
        backgroundColor: isPlayingToday ? 'rgba(255, 199, 44, 0.15)' : 'transparent',
        borderLeft: isPlayingToday ? '3px solid #FFC72C' : 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isPlayingToday 
          ? 'rgba(255, 199, 44, 0.25)' 
          : 'rgba(255, 199, 44, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isPlayingToday 
          ? 'rgba(255, 199, 44, 0.15)' 
          : 'transparent';
      }}
    >
      <td style={{ color: '#FFFFFF', padding: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_players?.nba_player_id}.png`}
            alt={player.nba_players?.name}
            sx={{ width: 32, height: 32 }}
          />
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: isPlayingToday ? 700 : 500 }}>
                {player.nba_players?.name || 'Unknown'}
              </Typography>
              {isPlayingToday && (
                <Chip 
                  size="sm" 
                  variant="solid" 
                  color="primary"
                  sx={{ 
                    fontSize: '0.6rem',
                    height: '18px',
                    bgcolor: '#FFC72C',
                    color: '#000000',
                    fontWeight: 'bold'
                  }}
                >
                  PLAYING TODAY
                </Chip>
              )}
            </Box>
            {player.nba_players?.position && (
              <Typography sx={{ color: '#CCCCCC', fontSize: '0.7rem' }}>
                {player.nba_players.position}
              </Typography>
            )}
          </Box>
        </Box>
      </td>
      <td style={{ color: '#FFC72C', padding: '12px', textAlign: 'right', fontWeight: 600 }}>
        {seasonStats ? seasonStats.ppg.toFixed(1) : 'N/A'}
      </td>
      <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right' }}>
        {seasonStats ? seasonStats.rpg.toFixed(1) : 'N/A'}
      </td>
      <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right' }}>
        {seasonStats ? seasonStats.apg.toFixed(1) : 'N/A'}
      </td>
      <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right' }}>
        {player.nba_players?.team_abbreviation || 'FA'}
      </td>
      <td style={{ padding: '12px', textAlign: 'right' }}>
        <IconButton
          size="sm"
          variant="plain"
          color="danger"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          sx={{
            '&:hover': {
              bgcolor: 'rgba(239, 68, 68, 0.2)',
            },
          }}
        >
          <Close />
        </IconButton>
      </td>
    </tr>
  );
}

// Favorite Search Results Component
function FavoriteSearchResults({
  searchQuery,
  user,
  onClose,
  compact = false
}: {
  searchQuery: string;
  user: any;
  onClose: () => void;
  compact?: boolean;
}) {
  const { data: searchResults, isLoading } = usePlayerSearch(searchQuery);
  const addToFavoritesMutation = useAddToFavorites();
  const toggleFavoriteTeamMutation = useToggleFavoriteTeam();
  const { data: favoritePlayers } = usePlayerFavorites();
  const { data: favoriteTeams } = useFavoriteTeams(user?.id);

  const favoritePlayerIds = new Set(
    favoritePlayers?.map((fp: any) => fp.nba_players?.nba_player_id) || []
  );
  const favoriteTeamIds = new Set(
    favoriteTeams?.map((ft: any) => ft.team_id) || []
  );

  const handleAddPlayer = async (playerId: string, nbaPlayerId: number) => {
    if (!user?.id) return;
    
    try {
      // Find the player_id from nba_player_id
      const { data: playerData } = await supabase
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', nbaPlayerId)
        .single();

      if (playerData?.id) {
        await addToFavoritesMutation.mutateAsync({ playerId: playerData.id });
      }
    } catch (error) {
      console.error('Error adding player to favorites:', error);
    }
  };

  const handleAddTeam = async (teamId: number) => {
    if (!user?.id) return;
    
    try {
      await toggleFavoriteTeamMutation.mutateAsync({ userId: user.id, teamId });
    } catch (error) {
      console.error('Error adding team to favorites:', error);
    }
  };

  if (!searchQuery || searchQuery.length < 2) {
    if (compact) return null;
    return (
      <Typography level="body-sm" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
        Type at least 2 characters to search
      </Typography>
    );
  }

  if (isLoading) {
    if (compact) return null;
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size="sm" />
      </Box>
    );
  }

  if (!searchResults || searchResults.length === 0) {
    if (compact) return null;
    return (
      <Typography level="body-sm" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
        No results found
      </Typography>
    );
  }

  return (
    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
      {searchResults.map((result) => {
        if (result.type === 'player') {
          const isFavorited = favoritePlayerIds.has(result.nba_player_id);
          return (
            <ListItem key={result.id}>
              <ListItemButton
                onClick={() => {
                  if (!isFavorited) {
                    handleAddPlayer(result.id, result.nba_player_id);
                    if (compact) {
                      onClose();
                    }
                  }
                }}
              >
                <ListItemContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LoadingAvatar
                      nbaPlayerId={result.nba_player_id}
                      playerName={result.name}
                      size={32}
                      teamColors={getTeamColors(result.team_abbreviation || '')}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-sm">{result.name}</Typography>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {result.position} • {result.team_abbreviation}
                      </Typography>
                    </Box>
                    <IconButton
                      size="sm"
                      variant={isFavorited ? "solid" : "outlined"}
                      color={isFavorited ? "primary" : "neutral"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFavorited) {
                          handleAddPlayer(result.id, result.nba_player_id);
                        }
                      }}
                    >
                      {isFavorited ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                  </Box>
                </ListItemContent>
              </ListItemButton>
            </ListItem>
          );
        } else {
          const isFavorited = favoriteTeamIds.has(result.team_id);
          return (
            <ListItem key={result.id}>
              <ListItemButton
                onClick={() => {
                  if (!isFavorited) {
                    handleAddTeam(result.team_id);
                  }
                }}
              >
                <ListItemContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      src={getTeamLogoUrl(result.abbreviation)}
                      alt={result.abbreviation}
                      sx={{ width: 32, height: 32 }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-sm">
                        {result.city} {result.nickname}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {result.abbreviation}
                      </Typography>
                    </Box>
                    <IconButton
                      size="sm"
                      variant={isFavorited ? "solid" : "outlined"}
                      color={isFavorited ? "primary" : "neutral"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFavorited) {
                          handleAddTeam(result.team_id);
                        }
                      }}
                    >
                      {isFavorited ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                  </Box>
                </ListItemContent>
              </ListItemButton>
            </ListItem>
          );
        }
      })}
    </List>
  );
}

// Games Carousel Component - Horizontal Scrolling
function GamesCarousel({ 
  games, 
  isLoading, 
  onGameClick,
  selectedDate 
}: { 
  games: any[]; 
  isLoading: boolean; 
  onGameClick: (gameId: string) => void;
  selectedDate: Dayjs;
}) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const dateString = selectedDate.format('YYYY-MM-DD');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayEST = getTodayEST();
  const isPastDate = selectedDate.isBefore(dayjs(todayEST), 'day');

  // Fetch props for all games
  const { data: allGameProps } = useQuery({
    queryKey: ['game-props-batch', games.map(g => g.game_id), dateString],
    queryFn: async () => {
      if (!games || games.length === 0) return new Map();
      
      const gameIds = games.map(g => g.game_id).filter(Boolean);
      if (gameIds.length === 0) return new Map();

      // Get team codes and names from games for fallback matching
      const gameTeamMap = new Map<string, { 
        homeTricode: string | null; 
        awayTricode: string | null;
        homeName: string | null;
        awayName: string | null;
      }>();
      games.forEach(g => {
        if (g.game_id) {
          gameTeamMap.set(g.game_id, {
            homeTricode: g.home_team_tricode || null,
            awayTricode: g.away_team_tricode || null,
            homeName: g.home_team_name || null,
            awayName: g.away_team_name || null,
          });
        }
      });

      // Try to find props games first by nba_game_id
      // Props are stored with the game's date, which is often the next day in EST
      const nextDay = dayjs(dateString).add(1, 'day').format('YYYY-MM-DD');
      let propsGames: any[] = [];
      const { data: propsGamesByNbaId } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, event_id, home_team_tricode, away_team_tricode, home_team, away_team')
        .in('nba_game_id', gameIds)
        .in('game_date', [dateString, nextDay]);

      if (propsGamesByNbaId && propsGamesByNbaId.length > 0) {
        propsGames = propsGamesByNbaId;
      } else {
        // Fallback: Match by team codes/names and date
        const { data: allPropsGamesForDate } = await supabase
          .from('player_props_games')
          .select('id, nba_game_id, event_id, home_team_tricode, away_team_tricode, home_team, away_team')
          .in('game_date', [dateString, nextDay]);

        if (allPropsGamesForDate) {
          // Filter to match team combinations
          // Try matching by tricodes first, then fall back to full team names
          propsGames = allPropsGamesForDate.filter(pg => {
            return Array.from(gameTeamMap.values()).some(gameTeams => {
              // Strategy 1: Match by tricodes (if both have them)
              if (pg.home_team_tricode && pg.away_team_tricode && 
                  gameTeams.homeTricode && gameTeams.awayTricode) {
                return (
                  (pg.home_team_tricode === gameTeams.homeTricode && pg.away_team_tricode === gameTeams.awayTricode) ||
                  (pg.home_team_tricode === gameTeams.awayTricode && pg.away_team_tricode === gameTeams.homeTricode)
                );
              }
              
              // Strategy 2: Match by full team names (if tricodes are missing)
              if (pg.home_team && pg.away_team && 
                  gameTeams.homeName && gameTeams.awayName) {
                // Normalize team names for comparison (case-insensitive, handle variations)
                const normalizeName = (name: string) => name.toLowerCase().trim();
                const pgHome = normalizeName(pg.home_team);
                const pgAway = normalizeName(pg.away_team);
                const gameHome = normalizeName(gameTeams.homeName);
                const gameAway = normalizeName(gameTeams.awayName);
                
                return (
                  (pgHome === gameHome && pgAway === gameAway) ||
                  (pgHome === gameAway && pgAway === gameHome)
                );
              }
              
              return false;
            });
          });
        }
      }

      const propsGameIds = propsGames?.map(pg => pg.id).filter(Boolean) || [];
      const gameIdToEventId = new Map(
        propsGames?.map(pg => [pg.nba_game_id, pg.event_id]).filter(([gid]) => gid) || []
      );

      // Fetch props for all games
      let propsQuery = supabase
        .from('player_props')
        .select(`
          *,
          player_props_games!inner (
            id,
            event_id,
            game_date,
            home_team_tricode,
            away_team_tricode,
            nba_game_id
          )
        `)
        .in('game_date', [dateString, nextDayForProps]);

      if (propsGameIds.length > 0) {
        propsQuery = propsQuery.in('game_id', propsGameIds);
      } else {
        // No props games found even with fallback
        return new Map();
      }

      const { data: propsData, error } = await propsQuery
        .order('line', { ascending: true })
        .limit(500);

      if (error || !propsData) return new Map();

      // Group props by nba_game_id
      const propsMap = new Map<string, any[]>();
      propsData.forEach((prop: any) => {
        const propsGame = prop.player_props_games;
        if (!propsGame) return;
        
        // Find the nba_game_id for this prop
        for (const [nbaGameId, eventId] of gameIdToEventId) {
          if (propsGame.event_id === eventId || propsGame.nba_game_id === nbaGameId) {
            if (!propsMap.has(nbaGameId)) {
              propsMap.set(nbaGameId, []);
            }
            propsMap.get(nbaGameId)?.push(prop);
            break;
          }
        }
      });

      return propsMap;
    },
    enabled: games.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch standings for all teams in games
  const { data: standingsMap } = useQuery({
    queryKey: ['standings-for-games', games.map(g => `${g.home_team_tricode}-${g.away_team_tricode}`)],
    queryFn: async () => {
      if (!games || games.length === 0) return new Map();
      
      const teamTricodes = new Set<string>();
      games.forEach(game => {
        if (game.home_team_tricode) teamTricodes.add(game.home_team_tricode);
        if (game.away_team_tricode) teamTricodes.add(game.away_team_tricode);
      });

      // Get current season
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10 
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      // Fetch standings for these teams
      const { data: standings } = await supabase
        .from('nba_standings')
        .select('team_abbreviation, wins, losses')
        .eq('season', season)
        .in('team_abbreviation', Array.from(teamTricodes));

      if (!standings) return new Map();

      // Create map of abbreviation to record
      const standingsMap = new Map<string, { wins: number; losses: number }>();
      standings.forEach(team => {
        standingsMap.set(team.team_abbreviation, {
          wins: team.wins || 0,
          losses: team.losses || 0,
        });
      });

      return standingsMap;
    },
    enabled: games.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch team stats and key players for all games
  const { data: teamDataMap } = useQuery({
    queryKey: ['team-data-batch', games.map(g => `${g.home_team_tricode}-${g.away_team_tricode}`)],
    queryFn: async () => {
      if (!games || games.length === 0) return new Map();
      
      const teamTricodes = new Set<string>();
      games.forEach(game => {
        if (game.home_team_tricode) teamTricodes.add(game.home_team_tricode);
        if (game.away_team_tricode) teamTricodes.add(game.away_team_tricode);
      });

      // Get team IDs
      const { data: teams } = await supabase
        .from('nba_teams')
        .select('team_id, abbreviation')
        .in('abbreviation', Array.from(teamTricodes));

      if (!teams) return new Map();

      const teamIdMap = new Map(teams.map(t => [t.abbreviation, t.team_id]));
      const teamData = new Map<string, any>();

      // Process each team
      for (const [abbrev, teamId] of teamIdMap) {
        // Get recent games for this team (last 10 for better stats)
        const { data: recentGames } = await supabase
          .from('nba_games')
          .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_status')
          .or(`home_team_tricode.eq.${abbrev},away_team_tricode.eq.${abbrev}`)
          .eq('game_status', 3) // 3 = Final
          .order('game_date', { ascending: false })
          .limit(10);

        let ppg = 0;
        let wins = 0;
        let losses = 0;
        const recentForm: string[] = [];
        
        if (recentGames && recentGames.length > 0) {
          const totalPoints = recentGames.reduce((sum, game) => {
            const teamScore = game.home_team_tricode === abbrev 
              ? (game.home_team_score || 0)
              : (game.away_team_score || 0);
            return sum + teamScore;
          }, 0);
          ppg = totalPoints / recentGames.length;

          // Calculate wins/losses and recent form
          recentGames.slice(0, 5).forEach(game => {
            const isHome = game.home_team_tricode === abbrev;
            const teamScore = isHome ? game.home_team_score : game.away_team_score;
            const opponentScore = isHome ? game.away_team_score : game.home_team_score;
            
            if (teamScore > opponentScore) {
              wins++;
              recentForm.push('W');
            } else if (teamScore < opponentScore) {
              losses++;
              recentForm.push('L');
            }
          });
        }

        // Get top 3 players by PPG for this team (season stats)
        const { data: topPlayers } = await supabase
          .from('nba_players')
          .select('id, name, nba_player_id, position')
          .eq('team_abbreviation', abbrev)
          .eq('is_active', true)
          .limit(10);

        if (topPlayers && topPlayers.length > 0) {
          const nbaPlayerIds = topPlayers.map(p => p.nba_player_id).filter(Boolean);
          
          // Get season averages for these players
          const { data: boxscores } = await supabase
            .from('nba_boxscores')
            .select('nba_player_id, pts, reb, ast')
            .in('nba_player_id', nbaPlayerIds)
            .gte('game_date', '2025-10-21')
            .gt('min', 0);

          if (boxscores) {
            const playerStats = new Map<number, { pts: number; reb: number; ast: number; games: number }>();
            
            boxscores.forEach(box => {
              const existing = playerStats.get(box.nba_player_id) || { pts: 0, reb: 0, ast: 0, games: 0 };
              existing.pts += box.pts || 0;
              existing.reb += box.reb || 0;
              existing.ast += box.ast || 0;
              existing.games += 1;
              playerStats.set(box.nba_player_id, existing);
            });

            // Calculate averages and get top 3 by PPG
            const playersWithAverages = topPlayers
              .map(player => {
                const stats = playerStats.get(player.nba_player_id);
                if (!stats || stats.games === 0) return null;
                return {
                  ...player,
                  ppg: stats.pts / stats.games,
                  rpg: stats.reb / stats.games,
                  apg: stats.ast / stats.games,
                };
              })
              .filter(Boolean)
              .sort((a: any, b: any) => b.ppg - a.ppg)
              .slice(0, 3);

            teamData.set(abbrev, { 
              ppg, 
              games: recentGames?.length || 0, 
              topPlayers: playersWithAverages,
              wins,
              losses,
              recentForm: recentForm.join(''),
            });
          } else {
            teamData.set(abbrev, { 
              ppg, 
              games: recentGames?.length || 0, 
              topPlayers: [],
              wins,
              losses,
              recentForm: recentForm.join(''),
            });
          }
        } else {
          teamData.set(abbrev, { 
            ppg, 
            games: recentGames?.length || 0, 
            topPlayers: [],
            wins,
            losses,
            recentForm: recentForm.join(''),
          });
        }
      }

      return teamData;
    },
    enabled: games.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!games || games.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
          No games scheduled
        </Typography>
      </Box>
    );
  }

  // Handle wheel events to allow vertical scrolling to propagate when horizontal scroll is at boundary
  const handleWheel = (e: React.WheelEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // If scrolling primarily vertically, always allow it to propagate to parent (don't capture it)
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // Vertical scroll - don't prevent default, let it propagate
      e.stopPropagation();
      return;
    }
    
    // Horizontal scroll - check if we're at the boundary
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const isAtLeft = scrollLeft <= 0 && e.deltaX < 0;
    const isAtRight = scrollLeft >= scrollWidth - clientWidth - 1 && e.deltaX > 0;
    
    // If at boundary, allow vertical scroll component to propagate
    if ((isAtLeft || isAtRight) && Math.abs(e.deltaY) > 0) {
      // Allow the vertical scroll to propagate to parent
      e.stopPropagation();
      return;
    }
    
    // Otherwise, this is a horizontal scroll within bounds - let the container handle it
    // Don't prevent default or stop propagation, let the browser handle horizontal scrolling
  };

  return (
    <Box
      ref={scrollContainerRef}
      onWheel={handleWheel}
      sx={{
        width: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        pb: 2,
        touchAction: 'pan-x pan-y', // Allow both horizontal and vertical panning
        WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        '&::-webkit-scrollbar': {
          height: '8px',
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: '#1a1a1a',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: '#FFC72C',
          borderRadius: '4px',
          '&:hover': {
            bgcolor: '#FFD700',
          },
        },
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 1.25, sm: 1.5 }}
        sx={{
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {games.map((game) => {
          const awayTricode = game.away_team_tricode || 'TBD';
          const homeTricode = game.home_team_tricode || 'TBD';
          const hasScore = game.home_team_score > 0 || game.away_team_score > 0;
          const gameProps = allGameProps?.get(game.game_id) || [];
          const topProps = gameProps.slice(0, 2);
          const awayData = teamDataMap?.get(awayTricode);
          const homeData = teamDataMap?.get(homeTricode);
          const awayColors = getTeamColors(awayTricode);
          const homeColors = getTeamColors(homeTricode);
          const gameStatus = game.game_status_text || (hasScore ? 'Final' : 'Upcoming');
          // Game is final if: status text says Final, game_status is 3, OR (past date AND has scores)
          const isFinal = gameStatus === 'Final' || 
                         game.game_status === 3 || 
                         (isPastDate && hasScore);

          return (
            <Card
              key={game.game_id}
              orientation="horizontal"
              variant="outlined"
              onClick={() => onGameClick(game.game_id)}
              sx={{
                width: { xs: 260, sm: 300 },
                minWidth: { xs: 260, sm: 300 },
                bgcolor: '#0f0f0f',
                borderColor: '#2a2a2a',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  borderColor: '#FFC72C',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(255, 199, 44, 0.4)',
                  '&::before': {
                    opacity: 1,
                  },
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${awayColors.primary} 0%, ${homeColors.primary} 100%)`,
                  opacity: 0.7,
                  transition: 'opacity 0.3s ease',
                },
              }}
            >
              <CardOverflow>
                <Box
                  sx={{
                    width: { xs: 66, sm: 77 },
                    height: { xs: 66, sm: 77 },
                    minWidth: { xs: 66, sm: 77 },
                    position: 'relative',
                    borderRadius: '50%',
                    border: '3px solid',
                    borderColor: gameStatus === 'Final' 
                      ? '#666666'
                      : gameStatus === 'Live' || gameStatus === 'In Progress'
                      ? '#FFC72C'
                      : '#FFFFFF',
                    bgcolor: 'background.level1',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {/* Split background with team colors */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      bgcolor: getTeamPrimaryColor(awayTricode),
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      bgcolor: getTeamPrimaryColor(homeTricode),
                    }}
                  />
                  
                  {/* Away team logo */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <Box
                      component="img"
                      src={getTeamLogoUrl(awayTricode)}
                      alt={awayTricode}
                      sx={{
                        width: { xs: 26, sm: 31 },
                        height: { xs: 26, sm: 31 },
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </Box>
                  
                  {/* Home team logo */}
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <Box
                      component="img"
                      src={getTeamLogoUrl(homeTricode)}
                      alt={homeTricode}
                      sx={{
                        width: { xs: 26, sm: 31 },
                        height: { xs: 26, sm: 31 },
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </Box>

                  {/* Vertical divider line */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: '10%',
                      bottom: '10%',
                      width: '1px',
                      bgcolor: 'rgba(0, 0, 0, 0.3)',
                      transform: 'translateX(-50%)',
                      zIndex: 1,
                    }}
                  />
                </Box>
              </CardOverflow>
              <CardContent sx={{ flex: 1, minWidth: 0, p: { xs: 0.75, sm: 1 }, py: { xs: 0.75, sm: 1 } }}>
                <Box sx={{ mb: { xs: 0.5, sm: 0.625 } }}>
                  {/* Away Team Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: { xs: 0.125, sm: 0.25 } }}>
                    <Typography
                      level="title-sm"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '1.094rem',
                      }}
                    >
                      {awayTricode}
                    </Typography>
                    {standingsMap?.get(awayTricode) && (
                      <Typography
                        level="body-xs"
                        sx={{
                          color: '#B0B0B0',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}
                      >
                        ({standingsMap.get(awayTricode)!.wins}-{standingsMap.get(awayTricode)!.losses})
                      </Typography>
                    )}
                    <Typography
                      level="body-xs"
                      sx={{
                        color: '#B0B0B0',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      @
                    </Typography>
                    {/* Display score if available */}
                    {hasScore && (
                      <Typography
                        level="title-md"
                        sx={{
                          color: '#FFC72C',
                          fontWeight: 900,
                          fontSize: '1.25rem',
                          ml: 'auto',
                        }}
                      >
                        {game.away_team_score || 0}
                      </Typography>
                    )}
                  </Box>
                  {/* Home Team Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: { xs: 0.125, sm: 0.25 } }}>
                    <Typography
                      level="title-sm"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '1.094rem',
                      }}
                    >
                      {homeTricode}
                    </Typography>
                    {standingsMap?.get(homeTricode) && (
                      <Typography
                        level="body-xs"
                        sx={{
                          color: '#B0B0B0',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}
                      >
                        ({standingsMap.get(homeTricode)!.wins}-{standingsMap.get(homeTricode)!.losses})
                      </Typography>
                    )}
                    {/* Display score if available */}
                    {hasScore && (
                      <Typography
                        level="title-md"
                        sx={{
                          color: '#FFC72C',
                          fontWeight: 900,
                          fontSize: '1.25rem',
                          ml: 'auto',
                        }}
                      >
                        {game.home_team_score || 0}
                      </Typography>
                    )}
                  </Box>
                  {game.arena_name && (
                    <Typography
                      level="body-xs"
                      sx={{
                        color: '#B0B0B0',
                        fontSize: '0.875rem',
                        mt: { xs: 0.125, sm: 0.25 },
                        mb: { xs: 0.125, sm: 0.25 },
                      }}
                    >
                      {game.arena_name}
                    </Typography>
                  )}
                  {/* Display Spread and O/U if available */}
                  {(() => {
                    // Calculate spread display text
                    const getSpreadText = () => {
                      const homeSpread = game.home_spread;
                      const awaySpread = game.away_spread;
                      
                      // Use home_spread if available (primary source)
                      if (homeSpread !== null && homeSpread !== undefined) {
                        if (homeSpread < 0) {
                          // Home is favored: "LAL -5.5"
                          return `${homeTricode} ${homeSpread}`;
                        } else if (homeSpread > 0) {
                          // Away is favored: "BOS -5.5" (home gets +5.5)
                          return `${awayTricode} -${homeSpread}`;
                        } else {
                          // Pick'em
                          return `PK`;
                        }
                      } 
                      // Fallback to away_spread if home_spread not available
                      else if (awaySpread !== null && awaySpread !== undefined) {
                        if (awaySpread > 0) {
                          // Away is underdog: "BOS +5.5"
                          return `${awayTricode} +${awaySpread}`;
                        } else if (awaySpread < 0) {
                          // Home is underdog: "LAL +5.5" (away is favored)
                          return `${homeTricode} +${Math.abs(awaySpread)}`;
                        } else {
                          return `PK`;
                        }
                      }
                      return null;
                    };

                    const spreadText = getSpreadText();
                    const hasOverUnder = game.over_under !== null && game.over_under !== undefined;

                    // Only show container if we have at least one valid value
                    if (!spreadText && !hasOverUnder) {
                      return null;
                    }

                    return (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: { xs: 0.125, sm: 0.25 }, flexWrap: 'wrap' }}>
                        {spreadText && (
                          <Chip
                            size="sm"
                            variant="outlined"
                            sx={{
                              borderColor: '#FFC72C',
                              color: '#FFC72C',
                              fontSize: '0.813rem',
                              height: { xs: '20px', sm: '22.5px' },
                              fontWeight: 600,
                            }}
                          >
                            {spreadText}
                          </Chip>
                        )}
                        {hasOverUnder && (
                          <Chip
                            size="sm"
                            variant="outlined"
                            sx={{
                              borderColor: '#B0B0B0',
                              color: '#B0B0B0',
                              fontSize: '0.813rem',
                              height: { xs: '20px', sm: '22.5px' },
                              fontWeight: 600,
                            }}
                          >
                            O/U {game.over_under}
                          </Chip>
                        )}
                      </Box>
                    );
                  })()}
                </Box>

                {/* Top Props */}
                {topProps.length > 0 && (
                  <Box sx={{ mt: { xs: 0.25, sm: 0.375 } }}>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        mb: { xs: 0.25, sm: 0.375 },
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Top Props
                    </Typography>
                    {topProps.slice(0, 2).map((prop: any, idx: number) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: { xs: 0.25, sm: 0.375 },
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            level="body-xs"
                            sx={{
                              color: '#FFFFFF',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {prop.player_name}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{
                              color: '#B0B0B0',
                              fontSize: '0.813rem',
                            }}
                          >
                            {prop.bet_type
                              .replace(/_/g, ' ')
                              .replace(/([A-Z])/g, ' $1')
                              .trim()}
                          </Typography>
                        </Box>
                        <Chip
                          size="sm"
                          variant="solid"
                          sx={{
                            bgcolor: '#FFC72C',
                            color: '#000000',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            minWidth: '40px',
                            height: { xs: '22px', sm: '25px' },
                          }}
                        >
                          {(() => {
                            const lineValue = prop.currentLine || prop.line;
                            if (lineValue == null) return 'N/A';
                            const numValue = typeof lineValue === 'string' ? parseFloat(lineValue) : lineValue;
                            return isNaN(numValue) ? 'N/A' : numValue.toFixed(1);
                          })()}
                        </Chip>
                      </Box>
                    ))}
                    {gameProps.length > 2 && (
                      <Typography
                        level="body-xs"
                        sx={{
                          color: '#FFC72C',
                          fontSize: '0.813rem',
                          mt: { xs: 0.25, sm: 0.375 },
                        }}
                      >
                        +{gameProps.length - 2} more
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
              <CardOverflow
                variant="soft"
                sx={{
                  px: { xs: 0.15, sm: 0.2 },
                  writingMode: 'vertical-rl',
                  justifyContent: 'center',
                  fontSize: { xs: '0.813rem', sm: '0.938rem' },
                  fontWeight: 'xl',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                  bgcolor: gameStatus === 'Final'
                    ? 'rgba(0, 200, 83, 0.1)'
                    : gameStatus === 'Live' || gameStatus === 'In Progress'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(255, 199, 44, 0.1)',
                  color: gameStatus === 'Final'
                    ? '#00c853'
                    : gameStatus === 'Live' || gameStatus === 'In Progress'
                    ? '#ef4444'
                    : '#FFC72C',
                }}
              >
                {isFinal ? 'FINAL' : (!hasScore ? formatESTTime(game.game_date, 'time') : gameStatus)}
              </CardOverflow>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}

// Week and Game Count Component
function WeekAndGameCount({ selectedDate }: { selectedDate: Dayjs }) {
  const dateString = selectedDate.format('YYYY-MM-DD');
  const [shareSuccess, setShareSuccess] = useState(false);
  
  // Fetch week for selected date from nba_season_weeks
  const { data: week, isLoading: weekLoading } = useQuery({
    queryKey: ['nba-season-week', dateString],
    queryFn: async () => {
      // Use selectedDate to determine season year, not current date
      const date = dayjs(dateString);
      const year = date.year();
      const month = date.month() + 1;
      const seasonYear = month >= 10 ? year + 1 : year;
      
      // Fetch all weeks for this season
      const { data: allWeeks, error } = await supabase
        .from('nba_season_weeks')
        .select('*')
        .eq('league_id', 0)
        .eq('season_year', seasonYear)
        .order('week_number', { ascending: true });
      
      if (error || !allWeeks || allWeeks.length === 0) {
        console.log('⚠️ No weeks found for season:', seasonYear, 'date:', dateString);
        return null;
      }
      
      // Find the week that contains the selected date
      for (const w of allWeeks) {
        const start = dayjs(w.start_date);
        const end = dayjs(w.end_date);
        if (date.isSameOrAfter(start, 'day') && date.isSameOrBefore(end, 'day')) {
          return w;
        }
      }
      
      // If no week contains the date, return the closest week
      // (either the most recent past week or the first upcoming week)
      let foundWeek = null;
      for (const w of allWeeks) {
        const start = dayjs(w.start_date);
        const end = dayjs(w.end_date);
        if (date.isAfter(end)) {
          foundWeek = w; // Keep track of most recent past week
        } else if (date.isBefore(start) && !foundWeek) {
          return w; // First upcoming week
        }
      }
      
      return foundWeek;
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });
  
  // Get games count for selected date
  const todayEST = getTodayEST();
  const isToday = dateString === todayEST;
  // Always fetch database games as fallback, even for today
  const { data: games } = useGamesByDate(dateString);
  const { data: nbaScoreboard } = useNBAScoreboard(isToday ? dateString : undefined);
  
  const gamesCount = useMemo(() => {
    if (isToday && nbaScoreboard?.games) {
      // Filter scoreboard games to ensure they're actually on the selected EST date
      const filteredGames = nbaScoreboard.games.filter((game: any) => {
        const gameDate = game.gameDate || game.game_date;
        if (!gameDate) return false;
        
        try {
          // If it's a full timestamp, use isDateInEST directly
          if (gameDate.includes('T') || gameDate.includes(' ')) {
            return isDateInEST(gameDate, dateString);
          } else {
            // Date string only - treat as UTC midnight and convert to EST
            const utcDate = new Date(gameDate + 'T00:00:00Z');
            const estDateString = utcToESTDate(utcDate);
            return estDateString === dateString;
          }
        } catch (e) {
          return false;
        }
      });
      
      // If we have filtered scoreboard games, use that count
      // Otherwise fall back to database games count
      if (filteredGames.length > 0) {
        return filteredGames.length;
      }
    }
    // For past/future dates, or if scoreboard is empty, use database games
    return games?.length || 0;
  }, [isToday, nbaScoreboard, games, dateString]);
  
  // Share function
  const handleShare = async () => {
    try {
      const url = new URL(window.location.href);
      // Ensure date parameter is set
      if (!isToday) {
        url.searchParams.set('date', dateString);
      } else {
        url.searchParams.delete('date');
      }
      const shareUrl = url.toString();
      
      // Try native share API first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: `NBA Games - ${selectedDate.format('MMM D, YYYY')}`,
          text: `Check out ${gamesCount} ${gamesCount === 1 ? 'game' : 'games'} on ${selectedDate.format('MMM D, YYYY')}`,
          url: shareUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      // User cancelled share or clipboard failed - silently fail
      console.log('Share cancelled or failed:', error);
    }
  };
  
  if (weekLoading) {
    return (
      <Typography level="body-sm" sx={{ color: '#B0B0B0', ml: 2 }}>
        Loading...
      </Typography>
    );
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 2 }}>
      {week && (
        <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
          {week.week_name}
        </Typography>
      )}
      <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
        {gamesCount} {gamesCount === 1 ? 'game' : 'games'}
      </Typography>
      <IconButton
        size="sm"
        variant="plain"
        color="neutral"
        onClick={handleShare}
        sx={{
          color: shareSuccess ? '#00c853' : '#B0B0B0',
          '&:hover': {
            color: '#FFC72C',
            bgcolor: 'rgba(255, 199, 44, 0.1)',
          },
          transition: 'color 0.2s',
        }}
        title={shareSuccess ? 'Link copied!' : 'Share this day'}
      >
        {shareSuccess ? <Check sx={{ fontSize: '1rem' }} /> : <Share sx={{ fontSize: '1rem' }} />}
      </IconButton>
    </Box>
  );
}

// Games Carousel Header Component - Positioned like player page header
function GamesCarouselHeader({
  selectedDate,
  navigate
}: {
  selectedDate: Dayjs;
  navigate: (path: string) => void;
}) {
  const dateString = selectedDate.format('YYYY-MM-DD');
  const todayEST = getTodayEST();
  const isToday = dateString === todayEST;
  
  // Always fetch database games as fallback, even for today
  const { data: games, isLoading } = useGamesByDate(dateString);
  const { data: nbaScoreboard } = useNBAScoreboard(isToday ? dateString : undefined);

  // Merge live scoreboard data with games from database for today
  const mergedGames = useMemo(() => {
    if (!isToday) return games || [];
    
    // For today, merge live scoreboard with database games
    // Always use database games as base - they're already filtered by EST date
    // If no scoreboard games or all filtered out, return database games
    if (!nbaScoreboard?.games || nbaScoreboard.games.length === 0) {
      return games || [];
    }
    
    // Filter scoreboard games to ensure they're actually on today's EST date
    // This prevents showing games from yesterday that might still be "live"
    const filteredScoreboardGames = nbaScoreboard.games.filter((game: any) => {
      const gameDate = game.gameDate || game.game_date;
      if (!gameDate) return false;
      
      try {
        // If it's just a date string (YYYY-MM-DD), treat it as UTC midnight and convert to EST
        // If it's a full timestamp, use isDateInEST directly
        if (gameDate.includes('T') || gameDate.includes(' ')) {
          // Full timestamp - use isDateInEST
          return isDateInEST(gameDate, dateString);
        } else {
          // Date string only - treat as UTC midnight and convert to EST
          const utcDate = new Date(gameDate + 'T00:00:00Z');
          const estDateString = utcToESTDate(utcDate);
          return estDateString === dateString;
        }
      } catch (e) {
        console.warn('Error filtering game date in carousel:', gameDate, e);
        return false;
      }
    });
    
    // Create a map of game_id -> live game data (only for games on today's date)
    const liveGamesMap = new Map<string, any>();
    filteredScoreboardGames.forEach((liveGame: any) => {
      liveGamesMap.set(liveGame.gameId, liveGame);
    });
    
    // Start with database games, then merge in live data
    const merged: any[] = [];
    const processedGameIds = new Set<string>();
    
    // First, add/update games from database with live data
    if (games) {
      games.forEach((dbGame: any) => {
        const liveGame = liveGamesMap.get(dbGame.game_id);
        if (liveGame) {
          // Merge: use live scores if available, otherwise use DB scores
          merged.push({
            ...dbGame,
            home_team_score: liveGame.homeTeam.points || dbGame.home_team_score || 0,
            away_team_score: liveGame.awayTeam.points || dbGame.away_team_score || 0,
            game_status_text: liveGame.gameStatusText || dbGame.game_status_text || 'Scheduled',
            // Add live game data
            liveGame,
          });
          processedGameIds.add(dbGame.game_id);
        } else {
          // No live data, use DB data
          merged.push(dbGame);
          processedGameIds.add(dbGame.game_id);
        }
      });
    }
    
    // Add any live games not in database (already filtered to today's date)
    filteredScoreboardGames.forEach((liveGame: any) => {
      if (!processedGameIds.has(liveGame.gameId)) {
        // Convert live game to database format
        merged.push({
          game_id: liveGame.gameId,
          game_date: liveGame.gameDate,
          home_team_tricode: liveGame.homeTeam.abbreviation,
          away_team_tricode: liveGame.awayTeam.abbreviation,
          home_team_name: liveGame.homeTeam.name,
          away_team_name: liveGame.awayTeam.name,
          home_team_score: liveGame.homeTeam.points || 0,
          away_team_score: liveGame.awayTeam.points || 0,
          game_status_text: liveGame.gameStatusText || 'Scheduled',
          liveGame,
        });
      }
    });
    
    return merged;
  }, [isToday, games, nbaScoreboard?.games, dateString]);

  // Filter games - remove invalid games
  const filteredGames = useMemo(() => {
    if (!mergedGames) return [];
    
    return mergedGames.filter(game => {
      if (!game.home_team_tricode || !game.away_team_tricode) return false;
      if (game.home_team_tricode === game.away_team_tricode) return false;
      if (game.home_team_tricode.trim() === '' || game.away_team_tricode.trim() === '') return false;
      return true;
    });
  }, [mergedGames]);

  const handleGameClick = (gameId: string) => {
    navigate(`/game/${gameId}`, {
      state: {
        returnPath: '/today',
        returnDate: dateString,
      }
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!filteredGames || filteredGames.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
          No games scheduled
        </Typography>
      </Box>
    );
  }

  return (
    <GamesCarousel
      games={filteredGames}
      isLoading={isLoading}
      onGameClick={handleGameClick}
      selectedDate={selectedDate}
    />
  );
}

// Games Table Section Component (Left Column - 2/3 width)
function GamesTableSection({ 
  selectedDate, 
  setSelectedDate,
  navigate,
  standings,
  standingsLoading
}: { 
  selectedDate: Dayjs;
  setSelectedDate: (date: Dayjs) => void;
  navigate: (path: string) => void;
  standings: any;
  standingsLoading: boolean;
}) {
  const { user } = useAuth();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Convert selected date to EST string
  const dateString = selectedDate.format('YYYY-MM-DD');
  const { data: games, isLoading } = useGamesByDate(dateString);
  const todayEST = getTodayEST();
  const isToday = dateString === todayEST;
  const isFutureDate = dayjs(dateString).isAfter(dayjs(todayEST));
  const isPastDate = dayjs(dateString).isBefore(dayjs(todayEST));

  // Reset pagination when date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateString]);

  // Fetch favorite players and teams
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user?.id) {
        setFavoritePlayerIds(new Set());
        setFavoriteTeamAbbreviations(new Set());
        return;
      }

      try {
        const { data: favoritePlayers } = await supabase
          .from('player_favorites')
          .select(`
            player_id,
            nba_players (
              nba_player_id
            )
          `)
          .eq('user_id', user.id);
        
        const playerIds = new Set<number>();
        if (favoritePlayers) {
          favoritePlayers.forEach((fp: any) => {
            const nbaPlayerId = fp.nba_players?.nba_player_id;
            if (nbaPlayerId && typeof nbaPlayerId === 'number') {
              playerIds.add(nbaPlayerId);
            }
          });
        }
        setFavoritePlayerIds(playerIds);
        
        const { data: favoriteTeams } = await supabase
          .from('user_favorite_teams')
          .select(`
            team_id,
            nba_teams (
              abbreviation
            )
          `)
          .eq('user_id', user.id);
        
        const teamAbbreviations = new Set<string>();
        if (favoriteTeams) {
          favoriteTeams.forEach((ft: any) => {
            const abbreviation = ft.nba_teams?.abbreviation;
            if (abbreviation) {
              teamAbbreviations.add(abbreviation);
            }
          });
        }
        setFavoriteTeamAbbreviations(teamAbbreviations);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      }
    };
    
    fetchFavorites();
  }, [user?.id]);


  // Handle game click - use URL query params for seamless transition
  const handleGameClick = (gameId: string) => {
    navigate(`/game/${gameId}`, {
      state: {
        returnPath: '/today',
        returnDate: dateString,
      }
    });
  };


  // Handle date picker click
  const handleDateClick = () => {
    setDatePickerOpen(!datePickerOpen);
  };

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    };

    if (datePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [datePickerOpen]);

  // Filter games - remove invalid games
  const filteredGames = useMemo(() => {
    if (!games) return [];
    
    // Filter out invalid games (same team for both, missing tricodes, etc.)
    return games.filter(game => {
      // Check if both teams have valid tricodes
      if (!game.home_team_tricode || !game.away_team_tricode) {
        console.warn('Game missing team tricodes:', game.game_id, game);
        return false;
      }
      // Check if teams are different
      if (game.home_team_tricode === game.away_team_tricode) {
        console.warn('Game has same team for both home and away:', game.game_id, game);
        return false;
      }
      // Check if tricodes are valid (not empty strings)
      if (game.home_team_tricode.trim() === '' || game.away_team_tricode.trim() === '') {
        console.warn('Game has empty team tricodes:', game.game_id, game);
        return false;
      }
      return true;
    });
  }, [games]);

  // Pagination for games
  const paginatedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredGames.slice(startIndex, endIndex);
  }, [filteredGames, currentPage, pageSize]);

  const totalGamePages = Math.ceil(filteredGames.length / pageSize);

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.level1', border: '1px solid rgba(255, 255, 255, 0.1)', position: 'relative', width: '100%', m: { xs: 0, sm: 0, md: 0 }, overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 0, sm: 2, md: 2 }, bgcolor: '#000000', width: '100%', overflowX: 'hidden' }}>
        {/* Header with Date Navigation */}
        <Box sx={{ mb: { xs: 1, sm: 2 }, position: 'relative', px: { xs: 1, sm: 0, md: 0 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row' }}>
            {/* Date Navigation - Left side */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={() => {
                  const newDate = selectedDate.subtract(1, 'day');
                  setSelectedDate(newDate);
                }}
                sx={{
                    borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                <NavigateBefore />
                </IconButton>
              
              <Typography 
                level="title-md" 
                  sx={{
                  fontWeight: 'bold', 
                    color: '#FFFFFF',
                  minWidth: { xs: '120px', sm: '150px' },
                  textAlign: 'center',
                }}
                >
                  {selectedDate.format('MMM D, YYYY')}
                </Typography>
              
                <IconButton
                  size="sm"
                variant="outlined"
                  color="neutral"
                  onClick={() => {
                  const newDate = selectedDate.add(1, 'day');
                  setSelectedDate(newDate);
                  }}
                  sx={{
                  borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
              >
                <NavigateNext />
                </IconButton>
              </Box>
            
            {/* Date Picker - Right side */}
            <Box ref={datePickerRef} sx={{ position: 'relative' }}>
                <IconButton
                  size="sm"
                variant="outlined"
                  color="neutral"
                  onClick={handleDateClick}
                  sx={{
                  borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
              >
                <CalendarToday />
                </IconButton>
              </Box>
          </Box>

          {/* Remove old tab-based header content */}

          {/* Date Picker Popup */}
          {datePickerOpen && (
            <Box
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                bgcolor: '#1a1a1a',
                border: '1px solid #333333',
                borderRadius: '0 0 8px 8px',
                mt: 1,
                p: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              }}
            >
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ThemeProvider theme={createTheme({
                  palette: {
                    mode: 'dark',
                    primary: {
                      main: '#FFD700',
                    },
                    background: {
                      default: '#1a1a1a',
                      paper: '#1a1a1a',
                    },
                  },
                })}>
                  <DateCalendar
                    value={selectedDate}
                    onChange={(newValue) => {
                      if (newValue) {
                        setSelectedDate(newValue);
                        setDatePickerOpen(false);
                      }
                    }}
                    minDate={dayjs('2025-01-01')}
                    maxDate={dayjs('2026-12-31')}
                    sx={{
                      width: '100%',
                      '& .MuiPickersDay-root': {
                        color: '#FFFFFF',
                        '&.Mui-selected': {
                          backgroundColor: '#FFD700',
                          color: '#000',
                        },
                      },
                      '& .MuiPickersCalendarHeader-root': {
                        color: '#FFFFFF',
                      },
                      '& .MuiPickersCalendarHeader-label': {
                        color: '#FFFFFF',
                      },
                    }}
                  />
                </ThemeProvider>
              </LocalizationProvider>
            </Box>
          )}
        </Box>

        {/* Games Table Content */}
        {isFutureDate || isToday ? (
          // Future dates or today - show games
          (isLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading games...</Typography>
            </Box>
          ) : filteredGames && filteredGames.length > 0 ? (
            <GamesCarousel
              games={filteredGames}
              isLoading={isLoading}
              onGameClick={handleGameClick}
              selectedDate={selectedDate}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                No games scheduled
              </Typography>
            </Box>
          ))
        ) : isPastDate ? (
          // Past dates - show games calendar
          <GamesCalendarSection
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            navigate={navigate}
                user={user}
              />
        ) : null}
      </CardContent>
    </Card>
  );
}

// Games Calendar Section Component (Right Column - 1/3 width)
function GamesCalendarSection({ 
  selectedDate, 
  setSelectedDate, 
  navigate,
  user 
}: { 
  selectedDate: Dayjs;
  setSelectedDate: (date: Dayjs) => void;
  navigate: (path: string) => void;
  user: any;
}) {
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const [isLoading, setIsLoading] = useState(false);
  const [daysWithGames, setDaysWithGames] = useState<number[]>([]);

  // Fetch games for the current month to highlight days
  useEffect(() => {
    const fetchMonthGames = async () => {
      setIsLoading(true);
      const startDate = currentMonth.startOf('month');
      const endDate = currentMonth.endOf('month');

      try {
        const { data: games, error } = await supabase
          .from('nba_games')
          .select('game_date')
          .gte('game_date', startDate.toISOString())
          .lte('game_date', endDate.toISOString());

        if (error) {
          console.error('Error fetching month games:', error);
          setIsLoading(false);
          return;
        }

        // Extract unique days that have games
        const daysSet = new Set<number>();
        (games || []).forEach((game) => {
          const gameDate = dayjs(game.game_date);
          if (gameDate.month() === currentMonth.month()) {
            daysSet.add(gameDate.date());
          }
        });

        setDaysWithGames(Array.from(daysSet));
        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchMonthGames:', error);
        setIsLoading(false);
      }
    };

    fetchMonthGames();
  }, [currentMonth]);

  const handleMonthChange = (date: Dayjs) => {
    setCurrentMonth(date);
  };

  const handleDateChange = (newValue: Dayjs | null) => {
    if (newValue) {
      setSelectedDate(newValue);
    }
  };

  // Custom day component that shows indicator for days with games
  function ServerDay(props: any) {
    const { highlightedDays = [], day, outsideCurrentMonth, ...other } = props;
    const isSelected = !outsideCurrentMonth && highlightedDays.indexOf(day.date()) >= 0;

    return (
      <Box sx={{ position: 'relative' }}>
        <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />
        {isSelected && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: '#FFD700',
            }}
          />
        )}
      </Box>
    );
  }

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        bgcolor: '#1a1a1a', 
        borderColor: '#333333', 
        position: { xs: 'relative', md: 'sticky' }, 
        top: { md: '100px' },
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderLeft: 'none',
        ml: 0,
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={0}>
          {/* Header with Tooltip - Positioned absolutely to not affect layout */}
          {!user && (
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
              <Tooltip title="Log in for more detailed viewing information" arrow>
                <IconButton size="sm" variant="plain" sx={{ color: 'text.secondary' }}>
                  <Info sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Date Calendar */}
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ThemeProvider theme={createTheme({
              palette: {
                mode: 'dark',
                primary: {
                  main: '#FFD700',
                },
                background: {
                  default: '#1a1a1a',
                  paper: '#1a1a1a',
                },
              },
              shape: {
                borderRadius: 8,
              },
            })}>
              <DateCalendar
                value={selectedDate}
                onChange={handleDateChange}
                onMonthChange={handleMonthChange}
                minDate={dayjs('2025-01-01')}
                maxDate={dayjs('2026-12-31')}
                loading={isLoading}
                renderLoading={() => <DayCalendarSkeleton />}
                slots={{
                  day: ServerDay,
                }}
                slotProps={{
                  day: {
                    highlightedDays: daysWithGames,
                  } as any,
                }}
                sx={{
                  width: '100%',
                  mt: -1.5,
                  mb: -1.5,
                  '& .MuiPickersCalendarHeader-root': {
                    color: '#FFFFFF',
                    paddingTop: '0px',
                    paddingBottom: '0px',
                    minHeight: '40px',
                  },
                  '& .MuiPickersCalendarHeader-labelContainer': {
                    paddingTop: 0,
                    paddingBottom: 0,
                  },
                  '& .MuiDayCalendar-root': {
                    paddingTop: '4px',
                    paddingBottom: '0px',
                  },
                  '& .MuiPickersDay-root': {
                    color: '#FFFFFF',
                    '&.Mui-selected': {
                      backgroundColor: '#FFD700',
                      color: '#000',
                      '&:hover': {
                        backgroundColor: '#FFD700',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    },
                  },
                  '& .MuiDayCalendar-weekContainer': {
                    color: '#FFFFFF',
                  },
                  '& .MuiPickersCalendarHeader-label': {
                    color: '#FFFFFF',
                  },
                }}
              />
            </ThemeProvider>
          </LocalizationProvider>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Standings Section Component
function StandingsSection({ 
  standings, 
  isLoading, 
  navigate,
  conferenceIndex,
  setConferenceIndex,
  hideHeader
}: { 
  standings: any;
  isLoading: boolean;
  navigate: (path: string) => void;
  conferenceIndex?: number;
  setConferenceIndex?: (index: number | ((prev: number) => number)) => void;
  hideHeader?: boolean;
}) {
  const handleTeamClick = async (team: any) => {
    try {
      const { data: teamData } = await supabase
        .from('nba_teams')
        .select('id')
        .eq('team_id', team.team_id)
        .single();
      
      if (teamData?.id) {
        navigate(`/team/${teamData.id}`);
      }
    } catch (error) {
      console.error('Error handling team click:', error);
    }
  };

  const [internalConferenceIndex, setInternalConferenceIndex] = useState(0);
  const activeConferenceIndex = conferenceIndex !== undefined ? conferenceIndex : internalConferenceIndex;
  const setActiveConferenceIndex = setConferenceIndex || setInternalConferenceIndex;
  const conferences = ['east', 'west'];
  const conferenceLabels = ['Eastern Conference', 'Western Conference'];

  const renderStandingsTable = (teams: any[]) => {
    return (
      <Table sx={{ bgcolor: '#000000' }}>
        <thead>
          <tr>
            <th style={{ width: '40px', color: '#FFFFFF' }}>Rank</th>
            <th style={{ color: '#FFFFFF' }}>Team</th>
            <th style={{ textAlign: 'right', color: '#FFFFFF' }}>W-L</th>
            <th style={{ textAlign: 'right', color: '#FFFFFF' }}>GB</th>
          </tr>
        </thead>
        <tbody>
          {teams.slice(0, 15).map((team: any, index: number) => (
            <tr
              key={team.id}
              onClick={() => handleTeamClick(team)}
              style={{
                cursor: 'pointer',
                borderBottom: '1px solid #333333',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <td style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                {team.conference_rank || index + 1}
              </td>
              <td>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={getTeamLogoUrl(team.team_abbreviation)}
                    alt={team.team_abbreviation}
                    sx={{ width: 32, height: 32 }}
                  >
                    {team.team_abbreviation.charAt(0)}
                  </Avatar>
                  <Typography sx={{ color: '#FFFFFF' }}>
                    {team.team_abbreviation}
                  </Typography>
                </Box>
              </td>
              <td style={{ textAlign: 'right', color: '#FFFFFF' }}>
                {team.wins}-{team.losses}
              </td>
              <td style={{ textAlign: 'right', color: '#CCCCCC' }}>
                {team.games_behind === 0 ? '—' : `${team.games_behind.toFixed(1)} GB`}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <Box sx={{ bgcolor: '#000000', p: 2 }}>
      {isLoading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ color: '#FFFFFF' }}>Loading...</Typography>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          {!hideHeader && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <IconButton
                variant="outlined"
                size="sm"
                onClick={() => setActiveConferenceIndex((prev) => (prev === 0 ? conferences.length - 1 : prev - 1))}
                sx={{
                  color: '#FFFFFF',
                  borderColor: '#333333',
                  '&:hover': {
                    borderColor: '#FFC72C',
                    bgcolor: 'rgba(255, 199, 44, 0.1)',
                  },
                }}
              >
                <NavigateBefore />
              </IconButton>
              
              <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                {conferenceLabels[activeConferenceIndex]}
              </Typography>
              
              <IconButton
                variant="outlined"
                size="sm"
                onClick={() => setActiveConferenceIndex((prev) => (prev === conferences.length - 1 ? 0 : prev + 1))}
                sx={{
                  color: '#FFFFFF',
                  borderColor: '#333333',
                  '&:hover': {
                    borderColor: '#FFC72C',
                    bgcolor: 'rgba(255, 199, 44, 0.1)',
                  },
                }}
              >
                <NavigateNext />
              </IconButton>
            </Box>
          )}
          
          {/* Carousel Content */}
          <Box>
            {activeConferenceIndex === 0 && renderStandingsTable(standings?.east || [])}
            {activeConferenceIndex === 1 && renderStandingsTable(standings?.west || [])}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Leaders Section Component
function LeadersSection({ 
  navigate,
  categoryIndex,
  setCategoryIndex,
  hideHeader
}: { 
  navigate: (path: string) => void;
  categoryIndex?: number;
  setCategoryIndex?: (index: number | ((prev: number) => number)) => void;
  hideHeader?: boolean;
}) {
  const availableCategories = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT'];
  const [internalCategoryIndex, setInternalCategoryIndex] = useState(0);
  const activeCategoryIndex = categoryIndex !== undefined ? categoryIndex : internalCategoryIndex;
  const setActiveCategoryIndex = setCategoryIndex || setInternalCategoryIndex;
  const activeCategory = availableCategories[activeCategoryIndex];

  const { data: leaders, isLoading } = useQuery<Leader[]>({
    queryKey: ['nba-leaders-full', activeCategory],
    queryFn: async () => {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10 
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      const { data: leadersData, error: leadersError } = await supabase
        .from('nba_leaders')
        .select('*')
        .eq('season', season)
        .eq('category', activeCategory)
        .order('rank', { ascending: true })
        .limit(15);

      if (leadersError) return [];

      const playerIds = leadersData.map(l => l.player_id);
      const { data: playersData } = await supabase
        .from('nba_players')
        .select('id, name, team_abbreviation, nba_player_id')
        .in('id', playerIds);

      if (!playersData) return [];

      const playersMap = new Map(playersData.map(p => [p.id, p]));

      return leadersData.map(leader => ({
        ...leader,
        player_name: playersMap.get(leader.player_id)?.name,
        team_abbreviation: playersMap.get(leader.player_id)?.team_abbreviation,
        nba_player_id: playersMap.get(leader.player_id)?.nba_player_id || 0,
      }));
    },
    staleTime: 60 * 60 * 1000,
  });

  const renderLeadersTable = (leadersData: Leader[]) => {
    return (
      <Table sx={{ bgcolor: '#000000' }}>
        <thead>
          <tr>
            <th style={{ width: '40px', color: '#FFFFFF' }}>Rank</th>
            <th style={{ color: '#FFFFFF' }}>Player</th>
            <th style={{ textAlign: 'right', color: '#FFFFFF' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {leadersData.map((leader) => {
            const teamColors = leader.team_abbreviation 
              ? getTeamColors(leader.team_abbreviation)
              : { primary: '#666666', secondary: '#999999' };
            const valueText = activeCategory.includes('PCT') 
              ? (leader.value * 100).toFixed(1) + '%'
              : leader.value.toFixed(1);

            return (
              <tr
                key={leader.id}
                onClick={() => navigate(`/player/${leader.player_id}`)}
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid #333333',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                  {leader.rank}
                </td>
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LoadingAvatar
                      nbaPlayerId={leader.nba_player_id}
                      playerName={leader.player_name}
                      size={32}
                      teamColors={teamColors}
                    />
                    <Typography sx={{ color: '#FFFFFF' }}>
                      {leader.player_name?.split(' ').pop() || 'N/A'}
                    </Typography>
                    <Typography sx={{ color: '#CCCCCC', fontSize: '0.875rem' }}>
                      {leader.team_abbreviation}
                    </Typography>
                  </Box>
                </td>
                <td style={{ textAlign: 'right', color: '#FFFFFF', fontWeight: 'bold' }}>
                  {valueText}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  return (
    <Box sx={{ bgcolor: '#000000', p: 2 }}>
      {isLoading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ color: '#FFFFFF' }}>Loading...</Typography>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          {!hideHeader && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <IconButton
                variant="outlined"
                size="sm"
                onClick={() => setActiveCategoryIndex((prev) => (prev === 0 ? availableCategories.length - 1 : prev - 1))}
                sx={{
                  color: '#FFFFFF',
                  borderColor: '#333333',
                  '&:hover': {
                    borderColor: '#FFC72C',
                    bgcolor: 'rgba(255, 199, 44, 0.1)',
                  },
                }}
              >
                <NavigateBefore />
              </IconButton>
              
              <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                {CATEGORY_LABELS[availableCategories[activeCategoryIndex]] || availableCategories[activeCategoryIndex]}
              </Typography>
              
              <IconButton
                variant="outlined"
                size="sm"
                onClick={() => setActiveCategoryIndex((prev) => (prev === availableCategories.length - 1 ? 0 : prev + 1))}
                sx={{
                  color: '#FFFFFF',
                  borderColor: '#333333',
                  '&:hover': {
                    borderColor: '#FFC72C',
                    bgcolor: 'rgba(255, 199, 44, 0.1)',
                  },
                }}
              >
                <NavigateNext />
              </IconButton>
            </Box>
          )}
          
          {/* Carousel Content */}
          <Box>
            {renderLeadersTable(leaders || [])}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Players of the Night Section Component
export function PlayersOfNightSection({ navigate, selectedDate, hideHeader, customPlayers, compact = false }: { navigate: (path: string) => void; selectedDate?: Dayjs; hideHeader?: boolean; customPlayers?: NightPlayer[]; compact?: boolean }) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Use selectedDate if provided, otherwise use yesterday
  const targetDate = selectedDate ? selectedDate.toDate() : (() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  })();
  const dateString = `${(targetDate.getMonth() + 1).toString().padStart(2, '0')}/${targetDate.getDate().toString().padStart(2, '0')}`;

  // Use selectedDate for query key if provided (should be a past date)
  const dateKey = selectedDate ? selectedDate.format('YYYY-MM-DD') : 'yesterday';
  const { data: nightPlayers, isLoading } = useQueryWithPreviousData<NightPlayer[]>({
    queryKey: ['optimal-lineup-of-the-night', dateKey],
    queryFn: async () => {
      // If customPlayers provided, return them (for live team of the night)
      if (customPlayers) return customPlayers;
      
      if (!selectedDate) return [];
      
      const targetDate = selectedDate.format('YYYY-MM-DD');
      
      // Fetch boxscores for the selected date
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('*')
        .eq('game_date', targetDate)
        .gt('min', 0);
      
      if (boxscoreError || !boxscores || boxscores.length === 0) {
        return [];
      }
      
      // Get unique player IDs
      const playerIds = [...new Set(boxscores.map(b => b.nba_player_id))];
      
      // Fetch player info and salaries
      const { data: players, error: playersError } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation, position, jersey_number')
        .in('nba_player_id', playerIds)
        .eq('is_active', true);
      
      if (playersError || !players) {
        return [];
      }
      
      // Fetch salaries
      const playerDbIds = players.map(p => p.id);
      const { data: salaries } = await supabase
        .from('nba_hoopshype_salaries')
        .select('player_id, salary_2025_26')
        .in('player_id', playerDbIds);
      
      const salaryMap = new Map(salaries?.map(s => [s.player_id, s.salary_2025_26]) || []);
      const defaultSalary = 1157153; // Minimum salary
      
      // Calculate fantasy points for each player (using SQL formula: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV)
      const playerPerformance = boxscores.map(boxscore => {
        const player = players.find(p => p.nba_player_id === boxscore.nba_player_id);
        if (!player) return null;
        
        const salary = salaryMap.get(player.id) || defaultSalary;
        if (salary <= 0) return null;
        
        const fantasyPoints = 
          (boxscore.pts || 0) + 
          ((boxscore.reb || 0) * 1.2) + 
          ((boxscore.ast || 0) * 1.5) + 
          ((boxscore.stl || 0) * 3) + 
          ((boxscore.blk || 0) * 3) - 
          (boxscore.tov || 0);
        
        const pointsPerDollar = salary > 0 ? fantasyPoints / salary : 0;
        
        return {
          player_id: player.id,
          nba_player_id: player.nba_player_id,
          player_name: player.name,
          team: player.team_abbreviation,
          player_position: player.position,
          jersey_number: player.jersey_number?.toString() || '0',
          salary: salary,
          fantasy_points: fantasyPoints,
          games_played: 1,
          points_per_dollar: pointsPerDollar,
          selection_score: (fantasyPoints * 0.8) + (pointsPerDollar * 1000000 * 0.2),
        };
      }).filter(Boolean) as any[];
      
      // Greedy algorithm to build optimal lineup (12 players, $208M cap)
      const salaryCap = 208000000;
      const maxPlayers = 12;
      
      // Sort by selection score (80% fantasy points, 20% value)
      playerPerformance.sort((a, b) => b.selection_score - a.selection_score);
      
      const lineup: any[] = [];
      let usedSalary = 0;
      let lineupOrder = 1;
      
      // First pass: Add players that fit individually
      for (const player of playerPerformance) {
        if (lineup.length >= maxPlayers) break;
        if (usedSalary + player.salary <= salaryCap) {
          lineup.push({
            ...player,
            lineup_order: lineupOrder++,
            lineup_unit: lineupOrder <= 5 ? 'starters' : lineupOrder <= 10 ? 'rotation' : 'bench',
            unit_position: lineupOrder <= 5 ? lineupOrder : lineupOrder <= 10 ? lineupOrder - 5 : lineupOrder - 10,
            weighted_points: player.fantasy_points * (lineupOrder <= 5 ? 1.0 : lineupOrder <= 10 ? 0.75 : 0.5),
          });
          usedSalary += player.salary;
        }
      }
      
      // Second pass: Try to fill remaining slots with best value players
      const remainingSlots = maxPlayers - lineup.length;
      const remainingCap = salaryCap - usedSalary;
      const usedPlayerIds = new Set(lineup.map(p => p.player_id));
      
      if (remainingSlots > 0 && remainingCap > 0) {
        // Sort by points per dollar for value
        const availablePlayers = playerPerformance
          .filter(p => !usedPlayerIds.has(p.player_id) && p.salary <= remainingCap)
          .sort((a, b) => b.points_per_dollar - a.points_per_dollar);
        
        for (const player of availablePlayers) {
          if (lineup.length >= maxPlayers) break;
          if (usedSalary + player.salary <= salaryCap) {
            lineup.push({
              ...player,
              lineup_order: lineupOrder++,
              lineup_unit: lineupOrder <= 5 ? 'starters' : lineupOrder <= 10 ? 'rotation' : 'bench',
              unit_position: lineupOrder <= 5 ? lineupOrder : lineupOrder <= 10 ? lineupOrder - 5 : lineupOrder - 10,
              weighted_points: player.fantasy_points * (lineupOrder <= 5 ? 1.0 : lineupOrder <= 10 ? 0.75 : 0.5),
            });
            usedSalary += player.salary;
          }
        }
      }
      
      return lineup;
    },
    enabled: !!selectedDate && !customPlayers, // Only run if we have a selected date and no custom players
    staleTime: 5 * 60 * 1000,
  });
  
  // Use customPlayers if provided, otherwise use fetched data
  const displayPlayers = customPlayers || nightPlayers;

  const getPositionPriority = (pos: string | null | undefined): number => {
    if (!pos) return 4; // Default to lowest priority for null/undefined positions
    const upperPos = pos.toUpperCase();
    if (upperPos.includes('C') || upperPos === 'CENTER') return 1;
    if (upperPos.includes('F') || upperPos.includes('FORWARD')) return 2;
    if (upperPos.includes('G') || upperPos.includes('GUARD')) return 3;
    return 4;
  };

  const abbreviatePosition = (pos: string | null | undefined): string => {
    if (!pos) return ''; // Return empty string for null/undefined positions
    const upperPos = pos.toUpperCase();
    if (upperPos.includes('CENTER') || upperPos === 'C') return 'C';
    if (upperPos.includes('FORWARD') || upperPos === 'F') return 'F';
    if (upperPos.includes('GUARD') || upperPos === 'G') return 'G';
    return pos; // Return original if can't match
  };

  // Flatten and sort players
  const sortedPlayers = useMemo(() => {
    if (!displayPlayers) return [];
    
    // Flatten all players from all units
    const allPlayers = displayPlayers;
    
    // Sort based on selected column
    if (sortColumn) {
      return [...allPlayers].sort((a, b) => {
        let aValue: any = a[sortColumn as keyof NightPlayer];
        let bValue: any = b[sortColumn as keyof NightPlayer];
        
        // Handle null/undefined
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // For player_name, sort alphabetically
        if (sortColumn === 'player_name') {
          const comparison = String(aValue).localeCompare(String(bValue));
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        
        // For numeric values
        const aNum = typeof aValue === 'number' ? aValue : parseFloat(aValue) || 0;
        const bNum = typeof bValue === 'number' ? bValue : parseFloat(bValue) || 0;
        const diff = aNum - bNum;
        return sortDirection === 'asc' ? diff : -diff;
      });
    }
    
    // Default: group by lineup_order (starters first 5, then bench) and sort by position
    const grouped = allPlayers.reduce((acc, player) => {
      // Use lineup_order if available, otherwise use lineup_unit
      const order = player.lineup_order !== undefined && player.lineup_order !== null 
        ? (player.lineup_order <= 5 ? 'starters' : 'bench')
        : (player.lineup_unit || 'bench');
      if (!acc[order]) acc[order] = [];
      acc[order].push(player);
      return acc;
    }, {} as Record<string, NightPlayer[]>);

    // Sort each group by position priority, then by fantasy points
    Object.keys(grouped).forEach(group => {
      grouped[group].sort((a, b) => {
        const posA = getPositionPriority(a.player_position);
        const posB = getPositionPriority(b.player_position);
        if (posA !== posB) return posA - posB;
        return (b.fantasy_points || 0) - (a.fantasy_points || 0);
      });
    });

    // Return starters first, then bench
    const starters = grouped['starters'] || [];
    const bench = grouped['bench'] || [];
    return [...starters, ...bench];
  }, [nightPlayers, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const renderSortableHeader = (label: string, column: string) => {
    const isActive = sortColumn === column;
    const sortIndicator = isActive ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
    
    return (
      <th 
        onClick={() => handleSort(column)}
        style={{ 
          color: '#FFFFFF', 
          fontSize: '0.75rem',
          textAlign: 'right',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isActive ? 'rgba(255, 199, 44, 0.2)' : 'transparent',
          padding: '8px 12px',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {label}{sortIndicator}
      </th>
    );
  };

  // Separate starters and bench
  const starters = sortedPlayers.filter(p => p.lineup_order !== undefined && p.lineup_order !== null && p.lineup_order <= 5);
  const bench = sortedPlayers.filter(p => !p.lineup_order || p.lineup_order > 5);

  return (
    <Box sx={{ bgcolor: '#000000' }}>
      {isLoading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {!hideHeader && (
            <Typography 
              level="title-lg" 
              sx={{ 
                color: '#FFFFFF', 
                fontWeight: 800, 
                mb: 3,
                fontSize: '1.25rem',
              }}
            >
              Team of the Night - {dateString}
            </Typography>
          )}
          
          {/* Starters Section */}
          {starters.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography 
                level="title-sm" 
                sx={{ 
                  color: '#FFC72C', 
                  fontWeight: 700,
                  mb: 2,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Starters
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(auto-fill, minmax(100px, 1fr))',
                    sm: 'repeat(auto-fill, minmax(120px, 1fr))',
                    md: 'repeat(5, 1fr)',
                  },
                  gap: 2,
                }}
              >
                {starters.map((player) => {
                const playerKey = player.player_id || player.nba_player_id;
                return (
                    <Card
                      key={playerKey}
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (player.player_id) navigate(`/player/${player.player_id}`);
                      }}
                      sx={{
                        bgcolor: '#0f0f0f',
                        borderColor: '#2a2a2a',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        p: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: '#FFC72C',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 24px rgba(255, 199, 44, 0.3)',
                        },
                      }}
                    >
                      <PlayerJersey
                        playerName={player.player_name}
                        jerseyNumber={player.jersey_number}
                        nbaTeam={player.team}
                        position={abbreviatePosition(player.player_position)}
                        size="small"
                        textColor="#FFFFFF"
                      />
                      <Box sx={{ mt: 1.5, width: '100%', textAlign: 'center' }}>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            color: '#FFC72C', 
                            fontWeight: 800,
                            fontSize: '1rem',
                            mb: 0.5,
                          }}
                        >
                          {player.fantasy_points.toFixed(1)} FP
                        </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#B0B0B0',
                            fontSize: '0.75rem',
                          }}
                        >
                          ${(player.salary / 1000000).toFixed(2)}M
                        </Typography>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Bench Section - Only show if not compact */}
          {!compact && bench.length > 0 && (
            <Box>
              <Typography 
                level="title-sm" 
                sx={{ 
                  color: '#FFC72C', 
                  fontWeight: 700,
                  mb: 2,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Bench
                            </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(auto-fill, minmax(100px, 1fr))',
                    sm: 'repeat(auto-fill, minmax(120px, 1fr))',
                    md: 'repeat(auto-fill, minmax(120px, 1fr))',
                  },
                  gap: 2,
                }}
              >
                {bench.map((player) => {
                  const playerKey = player.player_id || player.nba_player_id;
                  return (
                    <Card
                      key={playerKey}
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (player.player_id) navigate(`/player/${player.player_id}`);
                      }}
                      sx={{
                        bgcolor: '#0f0f0f',
                        borderColor: '#2a2a2a',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        p: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: '#FFC72C',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 24px rgba(255, 199, 44, 0.3)',
                        },
                      }}
                    >
                      <PlayerJersey
                        playerName={player.player_name}
                        jerseyNumber={player.jersey_number}
                        nbaTeam={player.team}
                        position={abbreviatePosition(player.player_position)}
                        size="small"
                        textColor="#FFFFFF"
                      />
                      <Box sx={{ mt: 1.5, width: '100%', textAlign: 'center' }}>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            color: '#FFC72C', 
                            fontWeight: 800,
                            fontSize: '1rem',
                            mb: 0.5,
                          }}
                        >
                          {player.fantasy_points.toFixed(1)} FP
                        </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#B0B0B0',
                            fontSize: '0.75rem',
                          }}
                        >
                          ${(player.salary / 1000000).toFixed(2)}M
                        </Typography>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// Team of the Week Section Component
export function TeamOfWeekSection({ 
  navigate, 
  hideHeader,
  weekStartDate,
  weekEndDate,
  weekNumber,
  weekName
}: { 
  navigate: (path: string) => void; 
  hideHeader?: boolean;
  weekStartDate?: string;
  weekEndDate?: string;
  weekNumber?: number;
  weekName?: string;
}) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // If week dates are provided, use them; otherwise fetch previous week
  const { data: previousWeek } = useQuery({
    queryKey: ['previous-week-for-totw', weekStartDate, weekEndDate],
    queryFn: async () => {
      // If week dates are provided, use them
      if (weekStartDate && weekEndDate && weekNumber) {
        return {
          week_number: weekNumber,
          start_date: weekStartDate,
          end_date: weekEndDate,
        };
      }
      
      // Otherwise, fetch the previous week
      try {
        // Get current season year
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const seasonYear = month >= 10 ? year + 1 : year;
        
        const { data, error } = await supabase
          .from('nba_season_weeks')
          .select('week_number, start_date, end_date')
          .eq('season_year', seasonYear)
          .eq('league_id', 0)
          .lt('end_date', currentDate.toISOString().split('T')[0])
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.warn('Error fetching previous week:', error);
          return null;
        }
        
        return data || null;
      } catch (err) {
        console.warn('Error in previous week query:', err);
        return null;
      }
    },
    staleTime: 60 * 60 * 1000,
  });

  const weekString = weekName || (previousWeek 
    ? `Week ${previousWeek.week_number}`
    : 'Last Week');

  // Use different RPC function based on whether week dates are provided
  const { data: weekPlayers, isLoading } = useQueryWithPreviousData<WeekPlayer[]>({
    queryKey: ['optimal-lineup-of-the-week', weekStartDate, weekEndDate],
    queryFn: async () => {
      // If week dates are provided, use get_dfs_team_of_week with dates
      if (weekStartDate && weekEndDate) {
        const { data, error } = await supabase.rpc('get_dfs_team_of_week', {
          target_start_date: weekStartDate,
          target_end_date: weekEndDate,
        });
        if (error) {
          console.error('Error fetching team of week with dates:', error);
          // Fallback to get_optimal_lineup_of_the_week
          const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_optimal_lineup_of_the_week');
          if (fallbackError) return [];
          return fallbackData || [];
        }
        return data || [];
      }
      
      // Otherwise, use the default function
      const { data, error } = await supabase.rpc('get_optimal_lineup_of_the_week');
      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getPositionPriority = (pos: string | null | undefined): number => {
    if (!pos) return 4; // Default to lowest priority for null/undefined positions
    const upperPos = pos.toUpperCase();
    if (upperPos.includes('C') || upperPos === 'CENTER') return 1;
    if (upperPos.includes('F') || upperPos.includes('FORWARD')) return 2;
    if (upperPos.includes('G') || upperPos.includes('GUARD')) return 3;
    return 4;
  };

  const abbreviatePosition = (pos: string | null | undefined): string => {
    if (!pos) return ''; // Return empty string for null/undefined positions
    const upperPos = pos.toUpperCase();
    if (upperPos.includes('CENTER') || upperPos === 'C') return 'C';
    if (upperPos.includes('FORWARD') || upperPos === 'F') return 'F';
    if (upperPos.includes('GUARD') || upperPos === 'G') return 'G';
    return pos; // Return original if can't match
  };

  // Flatten and sort players
  const sortedPlayers = useMemo(() => {
    if (!weekPlayers) return [];
    
    // Flatten all players from all units
    const allPlayers = weekPlayers;
    
    // Sort based on selected column
    if (sortColumn) {
      return [...allPlayers].sort((a, b) => {
        let aValue: any = a[sortColumn as keyof WeekPlayer];
        let bValue: any = b[sortColumn as keyof WeekPlayer];
        
        // Handle null/undefined
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // For player_name, sort alphabetically
        if (sortColumn === 'player_name') {
          const comparison = String(aValue).localeCompare(String(bValue));
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        
        // For numeric values
        const aNum = typeof aValue === 'number' ? aValue : parseFloat(aValue) || 0;
        const bNum = typeof bValue === 'number' ? bValue : parseFloat(bValue) || 0;
        const diff = aNum - bNum;
        return sortDirection === 'asc' ? diff : -diff;
      });
    }
    
    // Default: group by lineup_order (starters first 5, then bench) and sort by position
    const grouped = allPlayers.reduce((acc, player) => {
      // Use lineup_order if available, otherwise use lineup_unit
      const order = player.lineup_order !== undefined && player.lineup_order !== null 
        ? (player.lineup_order <= 5 ? 'starters' : 'bench')
        : (player.lineup_unit || 'bench');
      if (!acc[order]) acc[order] = [];
      acc[order].push(player);
      return acc;
    }, {} as Record<string, WeekPlayer[]>);

    // Sort each group by position priority, then by avg fantasy points
    Object.keys(grouped).forEach(group => {
      grouped[group].sort((a, b) => {
        const posA = getPositionPriority(a.player_position);
        const posB = getPositionPriority(b.player_position);
        if (posA !== posB) return posA - posB;
        return (b.avg_fantasy_points || 0) - (a.avg_fantasy_points || 0);
      });
    });

    // Return starters first, then bench
    const starters = grouped['starters'] || [];
    const bench = grouped['bench'] || [];
    return [...starters, ...bench];
  }, [weekPlayers, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const renderSortableHeader = (label: string, column: string) => {
    const isActive = sortColumn === column;
    const sortIndicator = isActive ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
    
    return (
      <th 
        onClick={() => handleSort(column)}
        style={{ 
          color: '#FFFFFF', 
          fontSize: '0.75rem',
          textAlign: 'right',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isActive ? 'rgba(255, 199, 44, 0.2)' : 'transparent',
          padding: '8px 12px',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {label}{sortIndicator}
      </th>
    );
  };

  // Separate starters and bench
  const starters = sortedPlayers.filter(p => p.lineup_order !== undefined && p.lineup_order !== null && p.lineup_order <= 5);
  const bench = sortedPlayers.filter(p => !p.lineup_order || p.lineup_order > 5);

  return (
    <Box sx={{ bgcolor: '#000000' }}>
      {isLoading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {!hideHeader && (
            <Typography 
              level="title-lg" 
              sx={{ 
                color: '#FFFFFF', 
                fontWeight: 800, 
                mb: 3,
                fontSize: '1.25rem',
              }}
            >
              {weekString}
            </Typography>
          )}
          
          {/* Starters Section */}
          {starters.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography 
                level="title-sm" 
                sx={{ 
                  color: '#FFC72C', 
                  fontWeight: 700,
                  mb: 2,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Starters
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(auto-fill, minmax(100px, 1fr))',
                    sm: 'repeat(auto-fill, minmax(120px, 1fr))',
                    md: 'repeat(5, 1fr)',
                  },
                  gap: 2,
                }}
              >
                {starters.map((player) => {
                const playerKey = player.player_id || player.nba_player_id;
                return (
                    <Card
                      key={playerKey}
                      variant="outlined"
                      onClick={() => player.player_id && navigate(`/player/${player.player_id}`)}
                      sx={{
                        bgcolor: '#0f0f0f',
                        borderColor: '#2a2a2a',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        p: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: '#FFC72C',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 24px rgba(255, 199, 44, 0.3)',
                        },
                      }}
                    >
                      <PlayerJersey
                        playerName={player.player_name}
                        jerseyNumber={player.jersey_number}
                        nbaTeam={player.team}
                        position={abbreviatePosition(player.player_position)}
                        size="small"
                        textColor="#FFFFFF"
                      />
                      <Box sx={{ mt: 1.5, width: '100%', textAlign: 'center' }}>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            color: '#FFC72C', 
                            fontWeight: 800,
                            fontSize: '1rem',
                            mb: 0.5,
                          }}
                        >
                          {player.avg_fantasy_points.toFixed(1)} FP
                        </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#B0B0B0',
                            fontSize: '0.75rem',
                          }}
                        >
                          {player.games_played} games
                              </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#B0B0B0',
                            fontSize: '0.7rem',
                            mt: 0.25,
                          }}
                        >
                          ${(player.salary / 1000).toFixed(1)}K
                        </Typography>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Bench Section */}
          {bench.length > 0 && (
            <Box>
              <Typography 
                level="title-sm" 
                sx={{ 
                  color: '#FFC72C', 
                  fontWeight: 700,
                  mb: 2,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Bench
                            </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(auto-fill, minmax(100px, 1fr))',
                    sm: 'repeat(auto-fill, minmax(120px, 1fr))',
                    md: 'repeat(auto-fill, minmax(120px, 1fr))',
                  },
                  gap: 2,
                }}
              >
                {bench.map((player) => {
                  const playerKey = player.player_id || player.nba_player_id;
                  return (
                    <Card
                      key={playerKey}
                      variant="outlined"
                      onClick={() => player.player_id && navigate(`/player/${player.player_id}`)}
                      sx={{
                        bgcolor: '#0f0f0f',
                        borderColor: '#2a2a2a',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        p: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: '#FFC72C',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 24px rgba(255, 199, 44, 0.3)',
                        },
                      }}
                    >
                      <PlayerJersey
                        playerName={player.player_name}
                        jerseyNumber={player.jersey_number}
                        nbaTeam={player.team}
                        position={abbreviatePosition(player.player_position)}
                        size="small"
                        textColor="#FFFFFF"
                      />
                      <Box sx={{ mt: 1.5, width: '100%', textAlign: 'center' }}>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            color: '#FFC72C', 
                            fontWeight: 800,
                            fontSize: '1rem',
                            mb: 0.5,
                          }}
                        >
                          {player.avg_fantasy_points.toFixed(1)} FP
                        </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#B0B0B0',
                              fontSize: '0.75rem',
                          }}
                        >
                          {player.games_played} games
                        </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#B0B0B0',
                            fontSize: '0.7rem',
                            mt: 0.25,
                          }}
                        >
                          ${(player.salary / 1000).toFixed(1)}K
                            </Typography>
                          </Box>
                    </Card>
                  );
                })}
                        </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// Prop Predictions Full View - Replaces all modules
function PropPredictionsFullView({
  selectedDate,
  navigate,
  onClose,
  allGames: propAllGames,
  propsData,
}: {
  selectedDate: Dayjs;
  navigate: (path: string) => void;
  onClose: () => void;
  allGames?: any[];
  propsData?: {
    pastProps?: any[];
    futureProps?: any[];
    isLoading: boolean;
    activeTab: 'hottest' | 'coldest';
  } | null;
}) {
  const dateString = selectedDate.format('YYYY-MM-DD');
  const todayEST = getTodayEST();
  const isPast = selectedDate.isBefore(todayEST, 'day');
  const [activeTab, setActiveTab] = useState<'hottest' | 'coldest'>('hottest');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<string>(isPast ? 'actualValue' : 'last10HitRate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(isPast ? 'desc' : 'desc');
  const [gameFilter, setGameFilter] = useState<string>('');
  const [propTypeFilter, setPropTypeFilter] = useState<string>('');

  // Fetch games independently
  const { data: games } = useGamesByDate(dateString);
  const allGames = propAllGames && propAllGames.length > 0 ? propAllGames : (games || []);

  // Use passed props data instead of fetching
  const allProps = useMemo(() => {
    return isPast ? (propsData?.pastProps || []) : (propsData?.futureProps || []);
  }, [isPast, propsData?.pastProps, propsData?.futureProps]);
  
  const isLoading = propsData?.isLoading || false;

  // Fetch player_props_games records to get game information for filtering
  const { data: propsGamesData } = useQuery({
    queryKey: ['player-props-games-for-date', dateString],
    queryFn: async () => {
      const nextDay = dayjs(dateString).add(1, 'day').format('YYYY-MM-DD');
      console.log('🔍 Fetching player_props_games for dates:', dateString, nextDay);
      const { data, error } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
        .in('game_date', [dateString, nextDay]);
      
      if (error) {
        console.error('❌ Error fetching player_props_games:', error);
        return [];
      }
      
      console.log('✅ Fetched', data?.length || 0, 'player_props_games records');
      return data || [];
    },
    enabled: !isLoading && (allProps?.length || 0) > 0,
  });

  // Create a map of game_id (UUID) -> player_props_games record
  const propsGamesMap = useMemo(() => {
    const map = new Map();
    (propsGamesData || []).forEach((pg: any) => {
      if (pg.id) {
        map.set(pg.id, pg);
      }
    });
    console.log('🗺️ Created propsGamesMap with', map.size, 'entries');
    return map;
  }, [propsGamesData]);

  // Update activeTab when propsData changes
  useEffect(() => {
    if (propsData?.activeTab) {
      setActiveTab(propsData.activeTab);
    }
  }, [propsData?.activeTab]);

  // Helper function to format bet type for display
  const formatBetType = (betType: string): string => {
    // Normalize: lowercase, remove spaces, convert separators to + for combined stats
    const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+').replace(/-/g, '+');
    
    // Handle combined stats first (points+rebounds+assists, etc.)
    if (normalized.includes('points+rebounds+assists') || normalized === 'par' || normalized.includes('par')) {
      return 'P+A+R';
    }
    if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) {
      return 'P+R';
    }
    if (normalized.includes('points+assists') || normalized.includes('pts+ast')) {
      return 'P+A';
    }
    if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast') || normalized.includes('assists+rebounds')) {
      return 'R+A';
    }
    if (normalized.includes('blocks+steals') || normalized === 'stocks' || normalized.includes('stocks') || normalized.includes('steals+blocks')) {
      return 'STL+BLK';
    }
    
    // For single stats, remove + signs for lookup
    const singleStatNormalized = normalized.replace(/\+/g, '');
    
    // Single stat mappings
    const betTypeMap: Record<string, string> = {
      // Points
      'points': 'PTS',
      'point': 'PTS',
      'pts': 'PTS',
      // Rebounds
      'rebounds': 'REB',
      'rebound': 'REB',
      'reb': 'REB',
      // Assists
      'assists': 'AST',
      'assist': 'AST',
      'ast': 'AST',
      // Steals
      'steals': 'STL',
      'steal': 'STL',
      'stl': 'STL',
      // Blocks
      'blocks': 'BLK',
      'block': 'BLK',
      'blk': 'BLK',
      // Turnovers
      'turnovers': 'TOV',
      'turnover': 'TOV',
      'tov': 'TOV',
      // Three pointers made
      'threes': '3PM',
      'three': '3PM',
      '3pt': '3PM',
      '3-pointer': '3PM',
      '3pm': '3PM',
      'threepointersmade': '3PM',
      'three_pointers_made': '3PM',
      'three-pointers-made': '3PM',
      // Three pointers attempted
      'threepointersattempted': '3PA',
      'three_pointers_attempted': '3PA',
      'three-pointers-attempted': '3PA',
      '3pa': '3PA',
      '3-pointers-attempted': '3PA',
      'threesattempted': '3PA',
      // Two pointers made
      'twopointersmade': '2PM',
      'two_pointers_made': '2PM',
      'two-pointers-made': '2PM',
      '2pm': '2PM',
      // Two pointers attempted
      'twopointersattempted': '2PA',
      'two_pointers_attempted': '2PA',
      'two-pointers-attempted': '2PA',
      '2pa': '2PA',
      // Field goals made
      'fieldgoalsmade': 'FGM',
      'field_goals_made': 'FGM',
      'field-goals-made': 'FGM',
      'fgm': 'FGM',
      'fieldgoals': 'FGM',
      // Field goals attempted
      'fieldgoalsattempted': 'FGA',
      'field_goals_attempted': 'FGA',
      'field-goals-attempted': 'FGA',
      'fga': 'FGA',
      'fieldgoalattempts': 'FGA',
      // Free throws made
      'freethrowsmade': 'FTM',
      'free_throws_made': 'FTM',
      'free-throws-made': 'FTM',
      'ftm': 'FTM',
      'freethrows': 'FTM',
      // Free throws attempted
      'freethrowsattempted': 'FTA',
      'free_throws_attempted': 'FTA',
      'free-throws-attempted': 'FTA',
      'fta': 'FTA',
    };
    
    return betTypeMap[singleStatNormalized] || betType.toUpperCase();
  };

  // OLD CODE - Now using propsData passed from parent
  // Fetch ALL props for the date (not filtered by carousel games) - DISABLED
  const _unused_query = useQuery({
    queryKey: ['prop-predictions-full-all', dateString, activeTab],
    queryFn: async () => {
      // Fetch ALL player_props_games for this date and the day after
      // Props are stored with the game's date, which is often the next day in EST
      const nextDay = dayjs(dateString).add(1, 'day').format('YYYY-MM-DD');
      const { data: allPropsGamesForDate } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
        .in('game_date', [dateString, nextDay]);
      
      if (!allPropsGamesForDate || allPropsGamesForDate.length === 0) {
        return [];
      }
      
      const propsGameIds = allPropsGamesForDate.map(pg => pg.id).filter(Boolean);
      
      // Fetch ALL props for this date and next day
      const { data: props, error: propsError } = await supabase
        .from('player_props')
        .select(`
          *,
          player_props_games (
            id,
            nba_game_id,
            game_date,
            home_team_tricode,
            away_team_tricode,
            home_team,
            away_team
          )
        `)
        .in('game_id', propsGameIds)
        .in('game_date', [dateString, nextDay])
        .limit(10000);
      
      if (propsError || !props || props.length === 0) {
        return [];
      }
      
      // Filter props by over/under based on activeTab
      const filteredProps = props.filter((prop: any) => {
        const betTypeId = prop.bet_type_id || '';
        const isOver = betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over');
        const isUnder = betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under');
        
        if (activeTab === 'hottest') {
          return isOver;
        } else {
          return isUnder;
        }
      });
      
      // For past dates, calculate results
      if (isPast) {
        const playerIds = [...new Set(filteredProps.map((p: any) => p.nba_player_id).filter(Boolean))];
        
        if (playerIds.length === 0) {
          return [];
        }
        
        // Boxscores are stored with the game's date, which is often the next day in EST
        const nextDayForBoxscores = dayjs(dateString).add(1, 'day').format('YYYY-MM-DD');
        const { data: boxscores } = await supabase
          .from('nba_boxscores')
          .select('nba_player_id, game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
          .in('nba_player_id', playerIds)
          .in('game_date', [dateString, nextDayForBoxscores]);
        
        if (!boxscores || boxscores.length === 0) {
          return [];
        }
        
        const boxscoreMap = new Map<string, any>();
        boxscores.forEach((bs: any) => {
          boxscoreMap.set(`${bs.nba_player_id}-${bs.game_id}`, bs);
        });
        
        const { calculatePropResult } = await import('../utils/playerPropsCalculator');
        
        const propsWithCalculatedResults = filteredProps.map((prop: any) => {
          const propsGame = Array.isArray(prop.player_props_games) 
            ? prop.player_props_games[0] 
            : prop.player_props_games;
          const nbaGameId = propsGame?.nba_game_id;
          
          let boxscore: any = null;
          if (nbaGameId) {
            const boxscoreKey = `${prop.nba_player_id}-${nbaGameId}`;
            boxscore = boxscoreMap.get(boxscoreKey);
          }
          
          if (!boxscore) {
            const playerBoxscores = boxscores.filter((bs: any) => bs.nba_player_id === prop.nba_player_id);
            if (playerBoxscores.length === 1) {
              boxscore = playerBoxscores[0];
            }
          }
          
          if (!boxscore) {
            return null;
          }
          
          const betTypeId = prop.bet_type_id || '';
          const isOver = betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over');
          
          const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
          if (!result) return null;
          
          // Filter based on tab:
          // Hottest: Only over props that hit (result.result === 'over' means actual > line)
          // Coldest: Only under props that hit (result.result === 'under' means actual < line)
          if (activeTab === 'hottest') {
            if (!isOver || result.result !== 'over') {
              return null;
            }
          } else {
            if (isOver || result.result !== 'under') {
              return null;
            }
          }
          
          return {
            ...prop,
            result,
            actualValue: result.actualValue,
            hit: result.hit,
          };
        }).filter(Boolean);
        
        return propsWithCalculatedResults;
      }
      
      // For future dates, return props as-is (they should have last10HitRate from the query)
      return filteredProps;
    },
    enabled: false, // Disabled - using propsData instead
  });

  // Get unique games for filter - use game_id (UUID) from props
  const uniqueGames = useMemo(() => {
    const gamesMap = new Map<string, { id: string; label: string; homeTeam: string; awayTeam: string }>();
    
    console.log('🎮 Building unique games list from', allProps?.length || 0, 'props');
    console.log('🎮 PropsGamesMap size:', propsGamesMap.size);
    
    (allProps || []).forEach((prop: any) => {
      // Use prop.game_id (UUID reference to player_props_games)
      const gameId = prop.game_id;
      if (!gameId) {
        console.warn('⚠️ Prop missing game_id:', prop.id, prop.player_name);
        return;
      }
      
      // Get the player_props_games record
      let propsGame: any = null;
      
      // Check if we have it in the map first
      propsGame = propsGamesMap.get(gameId);
      
      // Fallback: check nested player_props_games (for raw props)
      if (!propsGame) {
        propsGame = Array.isArray(prop.player_props_games) 
          ? prop.player_props_games[0] 
          : prop.player_props_games;
      }
      
      if (!propsGame) {
        console.warn('⚠️ No propsGame found for game_id:', gameId);
        return;
      }
      
      const nbaGameId = propsGame.nba_game_id;
      let homeTeam = '';
      let awayTeam = '';
      
      // Try to get team info from allGames first
      if (nbaGameId) {
        const game = allGames.find((g: any) => {
          const gId = g.gameId || g.game_id;
          return String(gId) === String(nbaGameId);
        });
        
        if (game) {
          homeTeam = game.homeTeam?.abbreviation || game.home_team_tricode || game.homeTeam?.tricode || '';
          awayTeam = game.awayTeam?.abbreviation || game.away_team_tricode || game.awayTeam?.tricode || '';
        }
      }
      
      // Fallback to propsGame team data
      if (!homeTeam || !awayTeam) {
        homeTeam = propsGame.home_team_tricode || '';
        awayTeam = propsGame.away_team_tricode || '';
      }
      
      // Create label - use team names if available, otherwise use a fallback
      let label = '';
      if (homeTeam && awayTeam) {
        label = `${awayTeam} @ ${homeTeam}`;
      } else {
        // Fallback: use game_id or event_id if available
        const eventId = propsGame.event_id || '';
        label = eventId ? `Game: ${eventId}` : `Game: ${gameId.substring(0, 8)}...`;
      }
      
      // Always add to map, even if we don't have team names (filter will still work)
      gamesMap.set(gameId, { id: gameId, label, homeTeam: homeTeam || 'Unknown', awayTeam: awayTeam || 'Unknown' });
    });
    
    const uniqueGamesList = Array.from(gamesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    console.log('✅ Unique games found:', uniqueGamesList.length, uniqueGamesList.map(g => ({ id: g.id, label: g.label })));
    return uniqueGamesList;
  }, [allProps, allGames, propsGamesMap]);
  
  // Exclude FTM and FTA from prop predictor for now
  const isFtmOrFtaProp = (prop: any) => {
    const fmt = formatBetType(prop.bet_type || '');
    return fmt === 'FTM' || fmt === 'FTA';
  };

  // Get unique prop types for filter (exclude FTM/FTA)
  const uniquePropTypes = useMemo(() => {
    const types = new Set<string>();
    (allProps || []).forEach((prop: any) => {
      if (prop.bet_type && !isFtmOrFtaProp(prop)) {
        types.add(prop.bet_type);
      }
    });
    return Array.from(types).sort();
  }, [allProps]);
  
  // Filter and sort props
  const filteredAndSortedProps = useMemo(() => {
    let filtered = [...(allProps || [])].filter((prop: any) => !isFtmOrFtaProp(prop));
    
    // Filter by game (using game_id UUID - the foreign key to player_props_games)
    if (gameFilter) {
      console.log('🔍 Filtering by game:', gameFilter);
      console.log('📊 Total props before filter:', filtered.length);
      console.log('📊 Sample prop game_ids:', filtered.slice(0, 5).map((p: any) => p.game_id));
      
      filtered = filtered.filter((prop: any) => {
        const propGameId = prop.game_id;
        if (!propGameId) {
          return false;
        }
        // Normalize both values to strings for comparison
        const propGameIdStr = String(propGameId).trim();
        const filterStr = String(gameFilter).trim();
        const matches = propGameIdStr === filterStr;
        if (matches) {
          console.log('✅ Match found:', propGameIdStr, '===', filterStr);
        }
        return matches;
      });
      
      console.log('📊 Props after filter:', filtered.length);
    }
    
    // Filter by prop type
    if (propTypeFilter) {
      filtered = filtered.filter((prop: any) => prop.bet_type === propTypeFilter);
    }
    
    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (aVal == null) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      const comparison = (aVal as number) - (bVal as number);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [allProps, gameFilter, propTypeFilter, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProps.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedProps = filteredAndSortedProps.slice(startIndex, endIndex);
  
  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [gameFilter, propTypeFilter, sortField, sortDirection, activeTab]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            variant="soft"
            onClick={onClose}
            sx={{ bgcolor: '#1a1a1a', color: '#FFFFFF', '&:hover': { bgcolor: '#2a2a2a' } }}
          >
            <ArrowBack />
          </IconButton>
          <Typography level="h3" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Prop Predictions - {selectedDate.format('MMMM D, YYYY')}
          </Typography>
        </Box>
      </Box>

      {/* Consolidated Navigation Bar */}
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Tabs */}
            <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val as 'hottest' | 'coldest')}>
              <TabList>
                <Tab value="hottest">Hottest</Tab>
                <Tab value="coldest">Coldest</Tab>
              </TabList>
            </Tabs>
            
            {/* Filters */}
            <FormControl size="sm" sx={{ minWidth: 200 }}>
              <FormLabel sx={{ fontSize: '0.75rem', mb: 0.5 }}>Game</FormLabel>
              <Select
                value={gameFilter}
                onChange={(e, val) => {
                  console.log('🎯 Game filter changed:', val, 'from:', gameFilter);
                  setGameFilter(val || '');
                }}
                placeholder="All Games"
                sx={{ minHeight: '32px' }}
              >
                <Option value="">All Games</Option>
                {uniqueGames.map((game) => (
                  <Option key={game.id} value={game.id}>
                    {game.label}
                  </Option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="sm" sx={{ minWidth: 150 }}>
              <FormLabel sx={{ fontSize: '0.75rem', mb: 0.5 }}>Prop Type</FormLabel>
              <Select
                value={propTypeFilter}
                onChange={(e, val) => setPropTypeFilter(val || '')}
                placeholder="All Props"
                sx={{ minHeight: '32px' }}
              >
                <Option value="">All Props</Option>
                {uniquePropTypes.map((type) => (
                  <Option key={type} value={type}>
                    {formatBetType(type)}
                  </Option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="sm" sx={{ minWidth: 120 }}>
              <FormLabel sx={{ fontSize: '0.75rem', mb: 0.5 }}>Per Page</FormLabel>
              <Select
                value={rowsPerPage}
                onChange={(e, val) => {
                  setRowsPerPage(val || 25);
                  setPage(1);
                }}
                sx={{ minHeight: '32px' }}
              >
                <Option value={25}>25</Option>
                <Option value={50}>50</Option>
                <Option value={100}>100</Option>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Props Table */}
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : paginatedProps && paginatedProps.length > 0 ? (
            <>
              <Table hoverRow size="sm">
                <thead>
                  <tr>
                    <th 
                      style={{ color: '#FFFFFF', cursor: 'pointer' }}
                      onClick={() => handleSort('player_name')}
                    >
                      Player {sortField === 'player_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ color: '#FFFFFF', cursor: 'pointer' }}
                      onClick={() => handleSort('bet_type')}
                    >
                      Prop {sortField === 'bet_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ color: '#FFFFFF', cursor: 'pointer' }}
                      onClick={() => handleSort('line')}
                    >
                      Line {sortField === 'line' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    {isPast && (
                      <th 
                        style={{ color: '#FFFFFF', cursor: 'pointer' }}
                        onClick={() => handleSort('actualValue')}
                      >
                        Actual {sortField === 'actualValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {!isPast && (
                      <th 
                        style={{ color: '#FFFFFF', cursor: 'pointer' }}
                        onClick={() => handleSort('last10HitRate')}
                      >
                        Hit Rate {sortField === 'last10HitRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    <th style={{ color: '#FFFFFF' }}>Odds</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProps.map((prop: any, index: number) => {
                    // Handle both raw props (with player_props_games) and cleaned props (with nba_game_id directly)
                    const propsGame = Array.isArray(prop.player_props_games) 
                      ? prop.player_props_games[0] 
                      : prop.player_props_games;
                    const propsGameId = propsGame?.id;
                    // Cleaned props have nba_game_id directly, raw props have it nested in player_props_games
                    const nbaGameId = prop.nba_game_id || propsGame?.nba_game_id;
                    const game = allGames.find((g: any) => (g.gameId || g.game_id) === nbaGameId);
                    
                    let homeTeam = game?.homeTeam?.abbreviation || game?.home_team_tricode || game?.homeTeam?.tricode || '';
                    let awayTeam = game?.awayTeam?.abbreviation || game?.away_team_tricode || game?.awayTeam?.tricode || '';
                    
                    if (!homeTeam || !awayTeam) {
                      homeTeam = propsGame?.home_team_tricode || '';
                      awayTeam = propsGame?.away_team_tricode || '';
                    }
                    
                    const gameLabel = homeTeam && awayTeam ? `${awayTeam} @ ${homeTeam}` : 'N/A';
                    
                    return (
                      <tr 
                        key={prop.id || index}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (prop.player_id) {
                            navigate(`/player/${prop.player_id}`);
                          }
                        }}
                      >
                        <td>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar 
                              src={prop.nba_player_id && prop.nba_player_id > 0
                                ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png`
                                : undefined
                              }
                              alt={prop.player_name}
                              sx={{ width: 32, height: 32 }}
                            >
                              {(!prop.nba_player_id || prop.nba_player_id === 0) && (
                                <Typography sx={{ fontSize: '0.7rem', color: '#FFFFFF' }}>
                                  {prop.player_name?.charAt(0) || '?'}
                                </Typography>
                              )}
                            </Avatar>
                            <Box>
                              <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                                {prop.player_name || 'N/A'}
                              </Typography>
                              <Typography level="body-xs" sx={{ color: '#B0B0B0' }}>
                                {gameLabel}
                              </Typography>
                            </Box>
                          </Box>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                            {formatBetType(prop.bet_type)}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                            {(() => {
                              const lineValue = prop.currentLine || prop.line;
                              if (lineValue == null) return 'N/A';
                              const numValue = typeof lineValue === 'string' ? parseFloat(lineValue) : lineValue;
                              return isNaN(numValue) ? 'N/A' : numValue.toFixed(1);
                            })()}
                          </Typography>
                        </td>
                        {isPast && (
                          <td>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                color: prop.hit ? '#10B981' : '#EF4444',
                                fontWeight: 600,
                              }}
                            >
                              {prop.actualValue !== undefined ? prop.actualValue.toFixed(1) : 'N/A'}
                            </Typography>
                          </td>
                        )}
                        {!isPast && (
                          <td>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                color: activeTab === 'hottest' 
                                  ? (prop.last10HitRate >= 70 ? '#10B981' : prop.last10HitRate >= 50 ? '#FFC72C' : '#CCCCCC')
                                  : (prop.last10HitRate <= 30 ? '#EF4444' : prop.last10HitRate <= 50 ? '#FFC72C' : '#CCCCCC'),
                                fontWeight: 600,
                              }}
                            >
                              {prop.last10HitRate !== null && prop.last10HitRate !== undefined 
                                ? `${prop.last10HitRate.toFixed(1)}%` 
                                : 'N/A'}
                            </Typography>
                          </td>
                        )}
                        <td>
                          <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                            {(() => {
                              // Handle cleaned props (odds in over/under) vs raw props (odds directly)
                              if (prop.over || prop.under) {
                                // Cleaned prop - use over/under based on activeTab
                                const oddsData = activeTab === 'hottest' ? prop.over : prop.under;
                                return oddsData?.american_odds || oddsData?.price || 'N/A';
                              } else {
                                // Raw prop - odds directly on prop
                                return prop.american_odds || prop.price || 'N/A';
                              }
                            })()}
                          </Typography>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedProps.length)} of {filteredAndSortedProps.length} props
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <NavigateBefore />
                    </IconButton>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', alignSelf: 'center', px: 1 }}>
                      Page {page} of {totalPages}
                    </Typography>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <NavigateNext />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                No {activeTab === 'hottest' ? 'over' : 'under'} props found for this date.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

// Prop Performance Module - Historical prop performance for past dates
export function PropPerformanceModule({ 
  selectedDate, 
  navigate,
  onOpen
}: { 
  selectedDate: Dayjs; 
  navigate: (path: string) => void;
  onOpen?: (propsData: { pastProps?: any[]; futureProps?: any[]; isLoading: boolean; activeTab: 'hottest' | 'coldest' }) => void;
}) {
  const dateString = selectedDate.format('YYYY-MM-DD');
  const todayEST = getTodayEST();
  const isPast = selectedDate.isBefore(todayEST, 'day');
  
  // Only show for past dates
  if (!isPast) {
    return null;
  }
  
  const [activeTab, setActiveTab] = useState<'hottest' | 'coldest'>('hottest');
  
  // Fetch games
  const { data: games } = useGamesByDate(dateString);
  const allGames = games || [];
  
  // Helper function to format bet type for display
  const formatBetType = (betType: string): string => {
    // Normalize: lowercase, remove spaces, convert separators to + for combined stats
    const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+').replace(/-/g, '+');
    
    // Handle combined stats first (points+rebounds+assists, etc.)
    if (normalized.includes('points+rebounds+assists') || normalized === 'par' || normalized.includes('par')) {
      return 'P+A+R';
    }
    if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) {
      return 'P+R';
    }
    if (normalized.includes('points+assists') || normalized.includes('pts+ast')) {
      return 'P+A';
    }
    if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast') || normalized.includes('assists+rebounds')) {
      return 'R+A';
    }
    if (normalized.includes('blocks+steals') || normalized === 'stocks' || normalized.includes('stocks') || normalized.includes('steals+blocks')) {
      return 'STL+BLK';
    }
    
    // For single stats, remove + signs for lookup
    const singleStatNormalized = normalized.replace(/\+/g, '');
    
    // Single stat mappings
    const betTypeMap: Record<string, string> = {
      // Points
      'points': 'PTS',
      'point': 'PTS',
      'pts': 'PTS',
      // Rebounds
      'rebounds': 'REB',
      'rebound': 'REB',
      'reb': 'REB',
      // Assists
      'assists': 'AST',
      'assist': 'AST',
      'ast': 'AST',
      // Steals
      'steals': 'STL',
      'steal': 'STL',
      'stl': 'STL',
      // Blocks
      'blocks': 'BLK',
      'block': 'BLK',
      'blk': 'BLK',
      // Turnovers
      'turnovers': 'TOV',
      'turnover': 'TOV',
      'tov': 'TOV',
      // Three pointers made
      'threes': '3PM',
      'three': '3PM',
      '3pt': '3PM',
      '3-pointer': '3PM',
      '3pm': '3PM',
      'threepointersmade': '3PM',
      'three_pointers_made': '3PM',
      'three-pointers-made': '3PM',
      // Three pointers attempted
      'threepointersattempted': '3PA',
      'three_pointers_attempted': '3PA',
      'three-pointers-attempted': '3PA',
      '3pa': '3PA',
      '3-pointers-attempted': '3PA',
      'threesattempted': '3PA',
      // Two pointers made
      'twopointersmade': '2PM',
      'two_pointers_made': '2PM',
      'two-pointers-made': '2PM',
      '2pm': '2PM',
      // Two pointers attempted
      'twopointersattempted': '2PA',
      'two_pointers_attempted': '2PA',
      'two-pointers-attempted': '2PA',
      '2pa': '2PA',
      // Field goals made
      'fieldgoalsmade': 'FGM',
      'field_goals_made': 'FGM',
      'field-goals-made': 'FGM',
      'fgm': 'FGM',
      'fieldgoals': 'FGM',
      // Field goals attempted
      'fieldgoalsattempted': 'FGA',
      'field_goals_attempted': 'FGA',
      'field-goals-attempted': 'FGA',
      'fga': 'FGA',
      'fieldgoalattempts': 'FGA',
      // Free throws made
      'freethrowsmade': 'FTM',
      'free_throws_made': 'FTM',
      'free-throws-made': 'FTM',
      'ftm': 'FTM',
      'freethrows': 'FTM',
      // Free throws attempted
      'freethrowsattempted': 'FTA',
      'free_throws_attempted': 'FTA',
      'free-throws-attempted': 'FTA',
      'fta': 'FTA',
    };
    
    return betTypeMap[singleStatNormalized] || betType.toUpperCase();
  };

  // Calculate individual props with results, filtered by over/under
  const { data: pastPropsWithResults, isLoading: hitRatesLoading } = useQuery({
    queryKey: ['past-props-with-results', dateString, activeTab, allGames?.map(g => g.game_id || g.gameId).join(',')],
    queryFn: async () => {
      
      // Get game IDs from the carousel (handle both game_id and gameId formats)
      const gameIds = (allGames || []).map(g => g.game_id || g.gameId).filter(Boolean);
      
      if (gameIds.length === 0) {
        console.log('⚠️ No games in carousel for past date:', dateString);
        return null;
      }
      
      console.log('🔍 Calculating hit rates for past date:', dateString, 'for', gameIds.length, 'games');
      
      // Step 1: Fetch all player_props_games for this date and the day after
      // Props are stored with the game's date, which is often the next day in EST
      const nextDay = dayjs(dateString).add(1, 'day').format('YYYY-MM-DD');
      const { data: allPropsGames, error: propsGamesError } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, game_date, event_id, home_team, away_team, home_team_tricode, away_team_tricode')
        .in('game_date', [dateString, nextDay]);
      
      if (propsGamesError) {
        console.error('❌ Error fetching player_props_games:', propsGamesError);
        return null;
      }
      
      if (!allPropsGames || allPropsGames.length === 0) {
        console.log('⚠️ No player_props_games found for date:', dateString);
        return null;
      }
      
      // Match props games to nba games using our utility
      const nbaGamesForMatching = (allGames || []).map((g: any) => ({
        game_id: g.game_id || g.gameId,
        game_date: g.game_date || g.gameDate || dateString,
        home_team_tricode: g.home_team_tricode || g.homeTeam?.abbreviation || g.homeTeam?.tricode,
        away_team_tricode: g.away_team_tricode || g.awayTeam?.abbreviation || g.awayTeam?.tricode,
        home_team_name: g.home_team_name || g.homeTeam?.name,
        away_team_name: g.away_team_name || g.awayTeam?.name,
        home_team_city: g.home_team_city || g.homeTeam?.city,
        away_team_city: g.away_team_city || g.awayTeam?.city,
      }));
      
      const propsGameMatches = matchPropsGamesToNbaGames(allPropsGames, nbaGamesForMatching);
      
      // Filter to only props games that match carousel games
      const matchedPropsGameIds = Array.from(propsGameMatches.entries())
        .filter(([propsGameId, nbaGame]) => gameIds.includes(nbaGame.game_id))
        .map(([propsGameId]) => propsGameId);
      
      if (matchedPropsGameIds.length === 0) {
        console.log('⚠️ No player_props_games matched to carousel games');
        return null;
      }
      
      const propsGameIds = matchedPropsGameIds;
      console.log(`✅ Matched ${propsGameIds.length} player_props_games entries to ${gameIds.length} carousel games`);
      
      // Step 2: Fetch props for the date filtered by carousel games
      // Also check next day since props might be stored with game's date
      const { data: props, error: propsError } = await supabase
        .from('player_props')
        .select(`
          *,
          player_props_games (
            id,
            nba_game_id,
            event_id
          )
        `)
        .in('game_id', propsGameIds)
        .in('game_date', [dateString, nextDay])
        .limit(1000);
      
      if (propsError) {
        console.error('❌ Error fetching props:', propsError);
        return null;
      }
      
      if (!props || props.length === 0) {
        console.log('⚠️ No props found for date:', dateString);
        // Try to see if any props exist at all (for debugging)
        const { data: anyProps } = await supabase
          .from('player_props')
          .select('game_date')
          .order('game_date', { ascending: false })
          .limit(10);
        console.log('📊 Sample game_date values in database:', anyProps?.map((p: any) => p.game_date));
        
        // Try querying with a date range in case game_date is stored differently
        const dayBefore = selectedDate.subtract(1, 'day').format('YYYY-MM-DD');
        const dayAfter = selectedDate.add(1, 'day').format('YYYY-MM-DD');
        const { data: propsRange } = await supabase
          .from('player_props')
          .select('*')
          .gte('game_date', dayBefore)
          .lte('game_date', dayAfter)
          .limit(10);
        console.log(`📊 Props in date range (${dayBefore} to ${dayAfter}):`, propsRange?.length || 0);
        
        return null;
      }
      
      console.log(`✅ Found ${props.length} props for date: ${dateString}`);
      
      // Filter out points props with line < 5.5
      const filteredProps = props.filter((p: any) => {
        if (p.bet_type?.toLowerCase().includes('point') && p.line < 5.5) {
          return false;
        }
        return p.player_name && p.bet_type && p.line !== null && p.line !== undefined;
      });
      
      console.log(`✅ Found ${filteredProps.length} props (after filtering)`);
      
      // Get unique player IDs (before cleaning, so we can fetch boxscores)
      const playerIds = [...new Set(filteredProps.map((p: any) => p.nba_player_id).filter(Boolean))];
      
      if (playerIds.length === 0) {
        console.log('⚠️ No valid player IDs found in props');
        return null;
      }
      
      // Fetch boxscores for all players on this date and next day
      // Boxscores are stored with the game's date, which is often the next day in EST
      // The game_id in player_props is a UUID reference, not the NBA game_id
      // Note: nextDay is already declared above
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
        .in('nba_player_id', playerIds)
        .in('game_date', [dateString, nextDay]);
      
      if (boxscoreError || !boxscores || boxscores.length === 0) {
        console.log('⚠️ No boxscores found for date:', dateString);
        return null;
      }
      
      console.log(`📊 Found ${boxscores.length} boxscores for ${playerIds.length} players`);
      
      // Create boxscore map: nba_player_id + nba_game_id -> boxscore
      // The game_id in boxscores is the NBA game_id (e.g., "0022500516")
      const boxscoreMap = new Map<string, any>();
      boxscores.forEach((bs: any) => {
        boxscoreMap.set(`${bs.nba_player_id}-${bs.game_id}`, bs);
      });
      
      // Import calculatePropResult
      const { calculatePropResult } = await import('../utils/playerPropsCalculator');
      
      // Process each prop and calculate results
      const propsWithResults: any[] = [];
      
      // Create a map of propsGame.id -> matched nba_game for quick lookup
      const propsGameToNbaGameMap = new Map<string, string>();
      propsGameMatches.forEach((nbaGame, propsGameId) => {
        if (gameIds.includes(nbaGame.game_id)) {
          propsGameToNbaGameMap.set(propsGameId, nbaGame.game_id);
        }
      });
      
      filteredProps.forEach((prop: any) => {
        // Get nba_game_id from the joined player_props_games data or from our matching
        const propsGame = Array.isArray(prop.player_props_games) 
          ? prop.player_props_games[0] 
          : prop.player_props_games;
        let nbaGameId = propsGame?.nba_game_id;
        
        // If nba_game_id is null, try to get it from our matching
        if (!nbaGameId && propsGame?.id) {
          nbaGameId = propsGameToNbaGameMap.get(propsGame.id) || null;
        }
        
        let boxscore: any = null;
        
        if (nbaGameId) {
          // Match by nba_player_id and nba_game_id
          const boxscoreKey = `${prop.nba_player_id}-${nbaGameId}`;
          boxscore = boxscoreMap.get(boxscoreKey);
        }
        
        // Fallback: if no match by game_id, try to find any boxscore for this player on this date
        if (!boxscore) {
          const playerBoxscores = boxscores.filter((bs: any) => bs.nba_player_id === prop.nba_player_id);
          if (playerBoxscores.length === 1) {
            boxscore = playerBoxscores[0];
          } else if (playerBoxscores.length > 1 && nbaGameId) {
            boxscore = playerBoxscores.find((bs: any) => bs.game_id === nbaGameId);
          }
        }
        
        if (!boxscore) {
          return; // No boxscore for this player/game
        }
        
        // Determine if this is an over or under prop
        const betTypeId = prop.bet_type_id || '';
        const isOver = betTypeId.includes('-over') || betTypeId.endsWith('over') || 
                      betTypeId.toLowerCase().includes('over');
        const isUnder = betTypeId.includes('-under') || betTypeId.endsWith('under') || 
                       betTypeId.toLowerCase().includes('under');
        
        // Filter by activeTab: hottest = over props, coldest = under props
        if (activeTab === 'hottest' && !isOver) {
          return; // Skip under props for hottest tab
        }
        if (activeTab === 'coldest' && !isUnder) {
          return; // Skip over props for coldest tab
        }
        
        // Calculate result
        const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
        if (!result) return;
        
        // Filter based on whether prop hit:
        // Hottest: Only show over props that hit (result.result === 'over')
        // Coldest: Only show under props that hit (result.result === 'under')
        if (activeTab === 'hottest') {
          if (!isOver || result.result !== 'over') {
            return; // Only show over props that hit
          }
        } else {
          if (!isUnder || result.result !== 'under') {
            return; // Only show under props that hit
          }
        }
        
        propsWithResults.push({
          ...prop,
          result,
          actualValue: result.actualValue,
          hit: result.hit,
        });
      });
      
      // Sort by actual value (hottest descending, coldest ascending)
      const sorted = propsWithResults.sort((a: any, b: any) => {
        if (activeTab === 'hottest') {
          return (b.actualValue || 0) - (a.actualValue || 0);
        } else {
          return (a.actualValue || 0) - (b.actualValue || 0);
        }
      });
      
      console.log(`✅ Found ${sorted.length} ${activeTab === 'hottest' ? 'over' : 'under'} props that hit`);
      
      // Clean and combine props (combine over/under pairs, extract raw_odd_data)
      console.log('🧹 Cleaning and combining past props...');
      const cleanedProps = cleanPlayerProps(sorted);
      console.log(`✅ Cleaned: ${sorted.length} -> ${cleanedProps.length} props (combined over/under pairs)`);
      
      // Filter to game-level props only (exclude quarters/halves)
      const gamePropsOnly = filterGamePropsOnly(cleanedProps);
      console.log(`✅ Filtered to game props: ${cleanedProps.length} -> ${gamePropsOnly.length} props`);
      
      // Add result data back to cleaned props by matching IDs
      const propsWithResultsMap = new Map(sorted.map((p: any) => [p.id, p]));
      const finalProps = gamePropsOnly.map((cleanedProp: CleanedPlayerProp) => {
        // Try to find the original prop with results
        // Match by checking if the cleaned prop's over/under IDs match
        let originalProp: any = null;
        
        if (cleanedProp.over?.id) {
          originalProp = propsWithResultsMap.get(cleanedProp.over.id);
        }
        if (!originalProp && cleanedProp.under?.id) {
          originalProp = propsWithResultsMap.get(cleanedProp.under.id);
        }
        
        if (originalProp) {
          return {
            ...cleanedProp,
            result: originalProp.result,
            actualValue: originalProp.actualValue,
            hit: originalProp.hit,
            nba_game_id: originalProp.nba_game_id,
          };
        }
        return cleanedProp;
      });
      
      return finalProps;
    },
    enabled: true, // Always enabled for PropPerformanceModule (only called for past dates)
  });
  
  const isLoading = hitRatesLoading;
  
  // Return JSX for PropPerformanceModule
  // This module shows past prop performance
  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography 
            level="h4" 
            sx={{ 
              fontWeight: 'bold', 
              color: '#FFFFFF',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
                textDecoration: 'underline'
              }
            }}
            onClick={() => {
              if (onOpen) {
                const propsData = {
                  pastProps: pastPropsWithResults || [],
                  isLoading: isLoading,
                  activeTab: activeTab,
                };
                onOpen(propsData);
              } else {
                navigate(`/prop-predictions/${dateString}`);
              }
            }}
          >
            Prop Performance
          </Typography>
          <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val as 'hottest' | 'coldest')}>
            <TabList>
              <Tab value="hottest">Hottest</Tab>
              <Tab value="coldest">Coldest</Tab>
            </TabList>
          </Tabs>
        </Box>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : pastPropsWithResults && pastPropsWithResults.length > 0 ? (
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ color: '#FFFFFF' }}>Player</th>
                <th style={{ color: '#FFFFFF' }}>Prop</th>
                <th style={{ color: '#FFFFFF' }}>Line</th>
                <th style={{ color: '#FFFFFF' }}>Actual</th>
                <th style={{ color: '#FFFFFF' }}>Odds</th>
              </tr>
            </thead>
            <tbody>
              {pastPropsWithResults.slice(0, 10).map((prop: any, index: number) => (
                <tr 
                  key={prop.id || index}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (prop.player_id) {
                      navigate(`/player/${prop.player_id}`);
                    }
                  }}
                >
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar 
                        src={prop.nba_player_id && prop.nba_player_id > 0
                          ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png`
                          : undefined
                        }
                        alt={prop.player_name}
                        sx={{ width: 24, height: 24 }}
                      >
                        {(!prop.nba_player_id || prop.nba_player_id === 0) && (
                          <Typography sx={{ fontSize: '0.6rem', color: '#FFFFFF' }}>
                            {prop.player_name?.charAt(0) || '?'}
                          </Typography>
                        )}
                      </Avatar>
                      <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                        {prop.player_name || 'N/A'}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      {formatBetType(prop.bet_type)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                      {(() => {
                        const lineValue = prop.currentLine || prop.line;
                        if (lineValue == null) return 'N/A';
                        const numValue = typeof lineValue === 'string' ? parseFloat(lineValue) : lineValue;
                        return isNaN(numValue) ? 'N/A' : numValue.toFixed(1);
                      })()}
                    </Typography>
                  </td>
                  <td>
                    <Typography 
                      level="body-sm" 
                      sx={{ 
                        color: prop.hit ? '#10B981' : '#EF4444',
                        fontWeight: 600,
                      }}
                    >
                      {prop.actualValue !== undefined ? prop.actualValue.toFixed(1) : 'N/A'}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      {(() => {
                        if (prop.over || prop.under) {
                          const oddsData = activeTab === 'hottest' ? prop.over : prop.under;
                          return oddsData?.american_odds || oddsData?.price || 'N/A';
                        } else {
                          return prop.american_odds || prop.price || 'N/A';
                        }
                      })()}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              No prop performance available for this date.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Prop Predictions Module - For present/today dates
export function PropPredictionsModule({ 
  selectedDate, 
  navigate,
  onOpen,
  nbaScoreboard
}: { 
  selectedDate: Dayjs; 
  navigate: (path: string) => void;
  onOpen?: (propsData: { pastProps?: any[]; futureProps?: any[]; isLoading: boolean; activeTab: 'hottest' | 'coldest' }) => void;
  nbaScoreboard?: any;
}) {
  const dateString = selectedDate.format('YYYY-MM-DD');
  const todayEST = getTodayEST();
  const isPast = selectedDate.isBefore(todayEST, 'day');
  const isToday = selectedDate.isSame(todayEST, 'day');
  
  const [activeTab, setActiveTab] = useState<'hottest' | 'coldest'>('hottest');
  
  // Fetch games from DB
  const { data: games } = useGamesByDate(dateString);
  // For today: use scoreboard games when nba_games has none yet (games often sync later)
  const allGames = useMemo(() => {
    const fromDb = games || [];
    if (fromDb.length > 0) return fromDb;
    if (!isToday || !nbaScoreboard?.games) return fromDb;
    const selectedDateString = selectedDate.format('YYYY-MM-DD');
    const filtered = nbaScoreboard.games.filter((game: any) => {
      const gameDate = game.gameDate || game.game_date;
      if (!gameDate) return false;
      try {
        if (gameDate.includes('T') || gameDate.includes(' ')) {
          return isDateInEST(gameDate, selectedDateString);
        }
        const utcDate = new Date(gameDate + 'T00:00:00Z');
        const estDateString = utcToESTDate(utcDate);
        return estDateString === selectedDateString;
      } catch (e) {
        return false;
      }
    });
    return filtered.map((game: any) => ({
      ...game,
      game_id: game.gameId || game.game_id,
      game_date: game.gameDate || game.game_date,
      home_team_tricode: game.home_team_tricode || game.homeTeam?.abbreviation || game.homeTeam?.tricode,
      away_team_tricode: game.away_team_tricode || game.awayTeam?.abbreviation || game.awayTeam?.tricode,
      home_team_name: game.home_team_name || game.homeTeam?.name,
      away_team_name: game.away_team_name || game.awayTeam?.name,
      home_team_city: game.home_team_city || game.homeTeam?.city,
      away_team_city: game.away_team_city || game.awayTeam?.city,
    }));
  }, [games, isToday, nbaScoreboard, selectedDate]);
  
  // Only show for present/today dates
  if (isPast || !isToday) {
    return null;
  }
  
  // Helper function to format bet type for display
  const formatBetType = (betType: string): string => {
    const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+').replace(/-/g, '+');
    
    if (normalized.includes('points+rebounds+assists') || normalized === 'par' || normalized.includes('par')) {
      return 'P+A+R';
    }
    if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) {
      return 'P+R';
    }
    if (normalized.includes('points+assists') || normalized.includes('pts+ast')) {
      return 'P+A';
    }
    if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast') || normalized.includes('assists+rebounds')) {
      return 'R+A';
    }
    if (normalized.includes('blocks+steals') || normalized === 'stocks' || normalized.includes('stocks') || normalized.includes('steals+blocks')) {
      return 'STL+BLK';
    }
    
    const singleStatNormalized = normalized.replace(/\+/g, '');
    const betTypeMap: Record<string, string> = {
      'points': 'PTS', 'point': 'PTS', 'pts': 'PTS',
      'rebounds': 'REB', 'rebound': 'REB', 'reb': 'REB',
      'assists': 'AST', 'assist': 'AST', 'ast': 'AST',
      'steals': 'STL', 'steal': 'STL', 'stl': 'STL',
      'blocks': 'BLK', 'block': 'BLK', 'blk': 'BLK',
      'turnovers': 'TOV', 'turnover': 'TOV', 'tov': 'TOV',
      'threes': '3PM', 'three': '3PM', '3pt': '3PM', '3-pointer': '3PM', '3pm': '3PM',
      'threepointersmade': '3PM', 'three_pointers_made': '3PM', 'three-pointers-made': '3PM',
      'threepointersattempted': '3PA', 'three_pointers_attempted': '3PA', 'three-pointers-attempted': '3PA', '3pa': '3PA',
      'twopointersmade': '2PM', 'two_pointers_made': '2PM', 'two-pointers-made': '2PM', '2pm': '2PM',
      'twopointersattempted': '2PA', 'two_pointers_attempted': '2PA', 'two-pointers-attempted': '2PA', '2pa': '2PA',
      'fieldgoalsmade': 'FGM', 'field_goals_made': 'FGM', 'field-goals-made': 'FGM', 'fgm': 'FGM', 'fieldgoals': 'FGM',
      'fieldgoalsattempted': 'FGA', 'field_goals_attempted': 'FGA', 'field-goals-attempted': 'FGA', 'fga': 'FGA', 'fieldgoalattempts': 'FGA',
      'freethrowsmade': 'FTM', 'free_throws_made': 'FTM', 'free-throws-made': 'FTM', 'ftm': 'FTM', 'freethrows': 'FTM',
      'freethrowsattempted': 'FTA', 'free_throws_attempted': 'FTA', 'free-throws-attempted': 'FTA', 'fta': 'FTA',
    };
    
    return betTypeMap[singleStatNormalized] || betType.toUpperCase();
  };

  // Fetch predicted props with hit rates for present/today dates
  const { data: predictedPropsData, isLoading: predictedPropsLoading } = useQuery({
    queryKey: ['predicted-props', dateString, allGames?.map(g => g.game_id || g.gameId).join(',')],
    queryFn: async () => {
      // Get game IDs from the carousel (handle both game_id and gameId formats)
      const gameIds = (allGames || []).map(g => g.game_id || g.gameId).filter(Boolean);
      
      if (gameIds.length === 0) {
        console.log('⚠️ No games in carousel for date:', dateString);
        return [];
      }
      
      console.log('🔍 Fetching props for games in carousel:', gameIds.length, 'games');
      console.log('🔍 Game IDs:', gameIds);
      console.log('🔍 Date string:', dateString);
      
      // Get team codes and names from carousel games for fallback matching
      const gameTeamMap = new Map<string, { 
        homeTricode: string | null; 
        awayTricode: string | null;
        homeName: string | null;
        awayName: string | null;
      }>();
      (allGames || []).forEach(g => {
        if (g.game_id) {
          gameTeamMap.set(g.game_id, {
            homeTricode: g.home_team_tricode || null,
            awayTricode: g.away_team_tricode || null,
            homeName: g.home_team_name || g.home_team_city || null,
            awayName: g.away_team_name || g.away_team_city || null,
          });
        }
      });
      
      console.log('📊 Carousel games team data:', Array.from(gameTeamMap.entries()).map(([id, teams]) => ({
        game_id: id,
        home: { tricode: teams.homeTricode, name: teams.homeName },
        away: { tricode: teams.awayTricode, name: teams.awayName }
      })));
      
      // Step 1: Match props games to nba games using our utility
      const nextDay = dayjs(dateString).add(1, 'day').format('YYYY-MM-DD');
      
      // Prepare nba games for matching
      const nbaGamesForMatching = (allGames || []).map((g: any) => ({
        game_id: g.game_id || g.gameId,
        game_date: g.game_date || g.gameDate || dateString,
        home_team_tricode: g.home_team_tricode || g.homeTeam?.abbreviation || g.homeTeam?.tricode,
        away_team_tricode: g.away_team_tricode || g.awayTeam?.abbreviation || g.awayTeam?.tricode,
        home_team_name: g.home_team_name || g.homeTeam?.name,
        away_team_name: g.away_team_name || g.awayTeam?.name,
        home_team_city: g.home_team_city || g.homeTeam?.city,
        away_team_city: g.away_team_city || g.awayTeam?.city,
      }));
      
      // Fetch all player_props_games for this date and the day after
      const { data: allPropsGames, error: propsGamesError } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, event_id')
        .in('game_date', [dateString, nextDay]);
      
      if (propsGamesError) {
        console.error('❌ Error fetching player_props_games:', propsGamesError);
        return [];
      }
      
      if (!allPropsGames || allPropsGames.length === 0) {
        console.log('⚠️ No player_props_games found for date:', dateString, 'or next day:', nextDay);
        return [];
      }
      
      // Match props games to nba games using our utility
      const propsGameMatches = matchPropsGamesToNbaGames(allPropsGames, nbaGamesForMatching);
      
      // Filter to only props games that match carousel games
      const matchedPropsGameIds = Array.from(propsGameMatches.entries())
        .filter(([propsGameId, nbaGame]) => {
          return gameIds.includes(nbaGame.game_id);
        })
        .map(([propsGameId]) => propsGameId);
      
      if (matchedPropsGameIds.length === 0) {
        console.log('⚠️ No player_props_games matched to carousel games for date:', dateString);
        console.log('📊 Carousel game IDs:', gameIds);
        console.log('📊 Props games found:', allPropsGames.length, 'but none matched');
        return [];
      }
      
      const propsGames = allPropsGames.filter(pg => matchedPropsGameIds.includes(pg.id));
      console.log(`✅ Matched ${propsGames.length} player_props_games to ${gameIds.length} carousel games for date: ${dateString}`);
      
      const propsGameIds = propsGames.map(pg => pg.id).filter(Boolean);
      console.log(`✅ Found ${propsGameIds.length} player_props_games entries for ${gameIds.length} carousel games`);
      
      // Step 2: Query player_props with pagination
      let allProps: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: pageProps, error: propsError } = await supabase
          .from('player_props')
          .select(`
            *,
            player_props_games (
              id,
              nba_game_id,
              game_date,
              home_team_tricode,
              away_team_tricode
            )
          `)
          .in('game_id', propsGameIds)
          .in('game_date', [dateString, nextDay])
          .order('player_name')
          .order('bet_type')
          .range(offset, offset + pageSize - 1);
        
        if (propsError) {
          console.error('❌ Error fetching player props:', propsError);
          break;
        }
        
        if (!pageProps || pageProps.length === 0) {
          hasMore = false;
          break;
        }
        
        allProps = [...allProps, ...pageProps];
        console.log(`📊 Loaded ${allProps.length} props so far...`);
        
        if (pageProps.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }
      
      if (allProps.length === 0) {
        console.log('⚠️ No props found for date:', dateString);
        return [];
      }
      
      console.log(`✅ Loaded ${allProps.length} total props for date ${dateString}`);
      
      // Step 3: Use player name matcher
      const unmatchedNames = [...new Set(
        allProps
          .filter((p: any) => !p.player_id && p.player_name)
          .map((p: any) => p.player_name)
      )];
      
      let playerNameMatches = new Map();
      if (unmatchedNames.length > 0) {
        console.log(`🔍 Matching ${unmatchedNames.length} unmatched player names...`);
        playerNameMatches = await matchPlayerNames(supabase, unmatchedNames);
        console.log(`✅ Matched ${Array.from(playerNameMatches.values()).filter(m => m !== null).length} players`);
      }
      
      // Step 4: Enhance props with matched player info
      const propsGameToNbaGameMap = new Map<string, string>();
      propsGameMatches.forEach((nbaGame, propsGameId) => {
        if (gameIds.includes(nbaGame.game_id)) {
          propsGameToNbaGameMap.set(propsGameId, nbaGame.game_id);
        }
      });
      
      const enhancedProps = allProps.map((prop: any) => {
        const propsGame = Array.isArray(prop.player_props_games) 
          ? prop.player_props_games[0] 
          : prop.player_props_games;
        
        let nbaGameId = propsGame?.nba_game_id;
        if (!nbaGameId && propsGame?.id) {
          nbaGameId = propsGameToNbaGameMap.get(propsGame.id) || null;
        }
        
        const updatedPropsGame = nbaGameId ? { ...propsGame, nba_game_id: nbaGameId } : propsGame;
        
        if (prop.player_id && prop.nba_player_id) {
          return {
            ...prop,
            player_props_games: updatedPropsGame,
            props_game_id: updatedPropsGame?.id,
          };
        }
        
        if (prop.player_name && playerNameMatches) {
          const match = playerNameMatches.get(prop.player_name);
          if (match) {
            return {
              ...prop,
              player_id: match.player_id,
              nba_player_id: match.nba_player_id,
              player_props_games: updatedPropsGame,
              props_game_id: updatedPropsGame?.id,
            };
          }
        }
        
        return {
          ...prop,
          player_props_games: updatedPropsGame,
          props_game_id: updatedPropsGame?.id,
        };
      });
      
      console.log(`✅ Enhanced ${enhancedProps.length} props with player matching`);
      
      // Step 5: Clean and combine props
      console.log('🧹 Cleaning and combining props...');
      const cleanedProps = cleanPlayerProps(enhancedProps);
      console.log(`✅ Cleaned: ${enhancedProps.length} -> ${cleanedProps.length} props (combined over/under pairs)`);
      
      // Step 6: Filter to game-level props only
      const gamePropsOnly = filterGamePropsOnly(cleanedProps);
      console.log(`✅ Filtered to game props: ${cleanedProps.length} -> ${gamePropsOnly.length} props`);
      
      // Step 7: Calculate hit rates for all props
      const { calculatePropResult } = await import('../utils/playerPropsCalculator');
      
      const propsByPlayer = new Map<number, CleanedPlayerProp[]>();
      gamePropsOnly.forEach((prop: CleanedPlayerProp) => {
        const nbaPlayerId = prop.nba_player_id;
        if (nbaPlayerId) {
          if (!propsByPlayer.has(nbaPlayerId)) {
            propsByPlayer.set(nbaPlayerId, []);
          }
          propsByPlayer.get(nbaPlayerId)!.push(prop);
        }
      });
      
      const boxscoreCache = new Map<number, any[]>();
      const uniquePlayerIds = Array.from(propsByPlayer.keys());
      const batchSize = 20;
      
      for (let i = 0; i < uniquePlayerIds.length; i += batchSize) {
        const batch = uniquePlayerIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (nbaPlayerId) => {
            const { data: recentBoxscores, error: boxscoreError } = await supabase
              .from('nba_boxscores')
              .select('game_id, game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
              .eq('nba_player_id', nbaPlayerId)
              .lt('game_date', dateString)
              .order('game_date', { ascending: false })
              .limit(10);
            
            if (!boxscoreError && recentBoxscores) {
              boxscoreCache.set(nbaPlayerId, recentBoxscores);
            }
          })
        );
      }
      
      const propsWithHitRates = gamePropsOnly.map((prop: CleanedPlayerProp) => {
        const nbaPlayerId = prop.nba_player_id;
        
        if (!nbaPlayerId) {
          return {
            ...prop,
            last10HitRate: null,
            last10Hits: 0,
            last10Total: 0,
            overHitRate: null,
            underHitRate: null,
          };
        }
        
        const recentBoxscores = boxscoreCache.get(nbaPlayerId);
        
        if (!recentBoxscores || recentBoxscores.length === 0) {
          return {
            ...prop,
            last10HitRate: null,
            last10Hits: 0,
            last10Total: 0,
            overHitRate: null,
            underHitRate: null,
          };
        }
        
        let overHits = 0;
        let underHits = 0;
        let total = 0;
        
        const lineValue = prop.currentLine || prop.line || 0;
        
        for (const boxscore of recentBoxscores) {
          const result = calculatePropResult(prop.bet_type, lineValue, boxscore);
          if (!result) continue;
          
          total++;
          
          if (result.result === 'over') {
            overHits++;
          }
          if (result.result === 'under') {
            underHits++;
          }
        }
        
        const overHitRate = total > 0 ? (overHits / total) * 100 : null;
        const underHitRate = total > 0 ? (underHits / total) * 100 : null;
        
        return {
          ...prop,
          last10HitRate: prop.over ? overHitRate : (prop.under ? underHitRate : null),
          last10Hits: prop.over ? overHits : underHits,
          last10Total: total,
          overHitRate,
          underHitRate,
          overHits,
          underHits,
        };
      });
      
      console.log(`✅ Calculated hit rates for ${propsWithHitRates.length} props`);
      
      // Deduplicate by taking highest line for each player+bet_type
      const propsByPlayerAndType = new Map<string, typeof propsWithHitRates>();
      propsWithHitRates.forEach((prop) => {
        const key = `${prop.nba_player_id || prop.player_name}_${prop.bet_type}`;
        if (!propsByPlayerAndType.has(key)) {
          propsByPlayerAndType.set(key, []);
        }
        propsByPlayerAndType.get(key)!.push(prop);
      });
      
      const deduplicatedProps: typeof propsWithHitRates = [];
      propsByPlayerAndType.forEach((props) => {
        props.sort((a, b) => {
          const lineA = a.currentLine || a.line || 0;
          const lineB = b.currentLine || b.line || 0;
          return lineB - lineA;
        });
        
        if (props[0]) {
          deduplicatedProps.push(props[0]);
        }
      });
      
      console.log(`✅ Deduplicated: ${propsWithHitRates.length} -> ${deduplicatedProps.length} props (taking highest line for each player+bet_type)`);
      
      return deduplicatedProps;
    },
    enabled: true, // Always enabled for PropPredictionsModule (only called for present dates)
  });
  
  const isLoading = predictedPropsLoading;
  const predictedProps = predictedPropsData;
  
  // Exclude FTM and FTA from prop predictor for now
  const isFtmOrFta = (p: any) => {
    const fmt = formatBetType(p.bet_type || '');
    return fmt === 'FTM' || fmt === 'FTA';
  };

  // For present/today dates: show hottest/coldest props based on last 10 games
  // Hottest: Show OVER props sorted by overHitRate (descending) - players consistently going over
  // Coldest: Show UNDER props sorted by underHitRate (descending) - players consistently going under
  const sortedProps = predictedProps 
    ? (activeTab === 'hottest' 
        ? [...predictedProps]
            .filter((p: any) => !isFtmOrFta(p))
            .filter((p: any) => p.over && p.overHitRate !== null && p.overHitRate !== undefined) // Only show props with over side and valid hit rate
            .map((p: any) => ({ 
              ...p, 
              displayHitRate: p.overHitRate, 
              displayHits: p.overHits || 0, 
              displaySide: 'over',
              displayOdds: p.over?.american_odds || p.over?.price || 'N/A'
            }))
            .sort((a: any, b: any) => (b.displayHitRate || 0) - (a.displayHitRate || 0)) // Highest hit rate first
            .slice(0, 10)
        : [...predictedProps]
            .filter((p: any) => !isFtmOrFta(p))
            .filter((p: any) => p.under && p.underHitRate !== null && p.underHitRate !== undefined) // Only show props with under side and valid hit rate
            .map((p: any) => ({ 
              ...p, 
              displayHitRate: p.underHitRate, 
              displayHits: p.underHits || 0, 
              displaySide: 'under',
              displayOdds: p.under?.american_odds || p.under?.price || 'N/A'
            }))
            .sort((a: any, b: any) => (b.displayHitRate || 0) - (a.displayHitRate || 0)) // Highest hit rate first (players consistently going under)
            .slice(0, 10))
    : [];
  
  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography 
            level="h4" 
            sx={{ 
              fontWeight: 'bold', 
              color: '#FFFFFF',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
                textDecoration: 'underline'
              }
            }}
            onClick={() => {
              if (onOpen) {
                // Pass the props data to the parent
                // For present dates, use predictedProps (cleaned props with hit rates)
                let propsToPass: any[] = [];
                
                if (predictedProps) {
                  // predictedProps are already cleaned; exclude FTM/FTA for full view
                  propsToPass = predictedProps.filter((p: any) => !isFtmOrFta(p));
                }
                
                const propsData = {
                  futureProps: propsToPass,
                  isLoading: isLoading,
                  activeTab: activeTab,
                };
                onOpen(propsData);
              } else {
                // Fallback to navigation if onOpen not provided
                navigate(`/prop-predictions/${dateString}`);
              }
            }}
          >
            Prop Predictions
          </Typography>
          <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val as 'hottest' | 'coldest')}>
            <TabList>
              <Tab value="hottest">Hottest</Tab>
              <Tab value="coldest">Coldest</Tab>
            </TabList>
          </Tabs>
        </Box>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : sortedProps && sortedProps.length > 0 ? (
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ color: '#FFFFFF' }}>Player</th>
                <th style={{ color: '#FFFFFF' }}>Prop</th>
                <th style={{ color: '#FFFFFF' }}>Line</th>
                <th style={{ color: '#FFFFFF' }}>Last 10 Hit Rate</th>
                <th style={{ color: '#FFFFFF' }}>Odds</th>
              </tr>
            </thead>
            <tbody>
              {sortedProps.map((prop: any, index: number) => (
                <tr 
                  key={prop.id || index}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (prop.player_id) {
                      navigate(`/player/${prop.player_id}`);
                    }
                  }}
                >
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar 
                        src={prop.nba_player_id && prop.nba_player_id > 0
                          ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png`
                          : undefined
                        }
                        alt={prop.player_name}
                        sx={{ width: 24, height: 24 }}
                      >
                        {(!prop.nba_player_id || prop.nba_player_id === 0) && (
                          <Typography sx={{ fontSize: '0.6rem', color: '#FFFFFF' }}>
                            {prop.player_name?.charAt(0) || '?'}
                          </Typography>
                        )}
                      </Avatar>
                      <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                        {prop.player_name || 'N/A'}
                      </Typography>
                    </Box>
                  </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                          {formatBetType(prop.bet_type)}
                        </Typography>
                      </td>
                  <td>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                        {(() => {
                          const lineValue = prop.currentLine || prop.line;
                          if (lineValue == null) return 'N/A';
                          const numValue = typeof lineValue === 'string' ? parseFloat(lineValue) : lineValue;
                          return isNaN(numValue) ? 'N/A' : numValue.toFixed(1);
                        })()}
                      </Typography>
                      {prop.lineMovement !== undefined && prop.lineMovement !== 0 && (
                        <Chip 
                          size="sm" 
                          variant="soft"
                          color={prop.lineMovement > 0 ? 'success' : 'danger'}
                          sx={{ height: '16px', fontSize: '0.65rem' }}
                        >
                          {prop.lineMovement > 0 ? '↑' : '↓'} {Math.abs(prop.lineMovement).toFixed(1)}
                        </Chip>
                      )}
                    </Stack>
                  </td>
                  <td>
                    <Typography 
                      level="body-sm" 
                      sx={{ 
                        color: activeTab === 'hottest' 
                          ? ((prop.displayHitRate || prop.last10HitRate) >= 70 ? '#10B981' : (prop.displayHitRate || prop.last10HitRate) >= 50 ? '#FFC72C' : '#CCCCCC')
                          : ((prop.displayHitRate || prop.last10HitRate) <= 30 ? '#EF4444' : (prop.displayHitRate || prop.last10HitRate) <= 50 ? '#FFC72C' : '#CCCCCC'),
                        fontWeight: 600,
                      }}
                    >
                      {(prop.displayHitRate !== null && prop.displayHitRate !== undefined) 
                        ? `${prop.displayHitRate.toFixed(1)}%` 
                        : (prop.last10HitRate !== null ? `${prop.last10HitRate.toFixed(1)}%` : 'N/A')} 
                      ({prop.displayHits || prop.last10Hits}/{prop.last10Total})
                    </Typography>
                  </td>
                  <td>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {prop.displaySide === 'over' && prop.over ? (
                        <>
                          <Chip size="sm" variant="soft" color="success" sx={{ fontSize: '0.7rem', height: '18px' }}>
                            O {prop.displayOdds || prop.over.american_odds || prop.over.price || 'N/A'}
                          </Chip>
                          {prop.bestOverOdds && prop.bestOverOdds.bookmaker !== prop.over.bookmaker && (
                            <Tooltip title={`Best: ${prop.bestOverOdds.bookmaker} ${prop.bestOverOdds.odds}`}>
                              <Typography level="body-xs" sx={{ color: '#999999' }}>
                                ⭐
                              </Typography>
                            </Tooltip>
                          )}
                        </>
                      ) : prop.displaySide === 'under' && prop.under ? (
                        <>
                          <Chip size="sm" variant="soft" color="danger" sx={{ fontSize: '0.7rem', height: '18px' }}>
                            U {prop.displayOdds || prop.under.american_odds || prop.under.price || 'N/A'}
                          </Chip>
                          {prop.bestUnderOdds && prop.bestUnderOdds.bookmaker !== prop.under.bookmaker && (
                            <Tooltip title={`Best: ${prop.bestUnderOdds.bookmaker} ${prop.bestUnderOdds.odds}`}>
                              <Typography level="body-xs" sx={{ color: '#999999' }}>
                                ⭐
                              </Typography>
                            </Tooltip>
                          )}
                        </>
                      ) : (
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                          {prop.displayOdds || prop.over?.american_odds || prop.under?.american_odds || prop.american_odds || prop.price || 'N/A'}
                        </Typography>
                      )}
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              No prop predictions available for this date.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Full Prop Predictions Modal with pagination, sorting, and filtering
// NOTE: This modal is no longer used - replaced by PropPredictionsFullView
// Keeping for reference but not called anywhere
function PropPredictionsModal({
  open,
  onClose,
  selectedDate,
  predictedProps,
  allGames,
  activeTab,
  navigate,
  isLoading
}: {
  open: boolean;
  onClose: () => void;
  selectedDate: Dayjs;
  predictedProps: any[] | null | undefined;
  allGames: any[];
  activeTab: 'hottest' | 'coldest';
  navigate: (path: string) => void;
  isLoading: boolean;
}) {
  // Helper function to format bet type for display
  const formatBetType = (betType: string): string => {
    // First normalize the input: lowercase, remove spaces, underscores, hyphens
    const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '').replace(/-/g, '');
    
    // Handle combined stats first (points+rebounds+assists, etc.)
    if (normalized.includes('points+rebounds+assists') || normalized.includes('par')) {
      return 'P+A+R';
    }
    if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) {
      return 'P+R';
    }
    if (normalized.includes('points+assists') || normalized.includes('pts+ast')) {
      return 'P+A';
    }
    if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast')) {
      return 'R+A';
    }
    if (normalized.includes('blocks+steals') || normalized.includes('stocks') || normalized.includes('steals+blocks')) {
      return 'STL+BLK';
    }
    
    // Single stat mappings
    const betTypeMap: Record<string, string> = {
      // Points
      'points': 'PTS',
      'point': 'PTS',
      'pts': 'PTS',
      // Rebounds
      'rebounds': 'REB',
      'rebound': 'REB',
      'reb': 'REB',
      // Assists
      'assists': 'AST',
      'assist': 'AST',
      'ast': 'AST',
      // Steals
      'steals': 'STL',
      'steal': 'STL',
      'stl': 'STL',
      // Blocks
      'blocks': 'BLK',
      'block': 'BLK',
      'blk': 'BLK',
      // Turnovers
      'turnovers': 'TOV',
      'turnover': 'TOV',
      'tov': 'TOV',
      // Three pointers made
      'threes': '3PM',
      'three': '3PM',
      '3pt': '3PM',
      '3-pointer': '3PM',
      '3pm': '3PM',
      'threepointersmade': '3PM',
      'three_pointers_made': '3PM',
      'three-pointers-made': '3PM',
      // Three pointers attempted
      'threepointersattempted': '3PA',
      'three_pointers_attempted': '3PA',
      'three-pointers-attempted': '3PA',
      '3pa': '3PA',
      '3-pointers-attempted': '3PA',
      'threesattempted': '3PA',
      // Two pointers made
      'twopointersmade': '2PM',
      'two_pointers_made': '2PM',
      'two-pointers-made': '2PM',
      '2pm': '2PM',
      // Two pointers attempted
      'twopointersattempted': '2PA',
      'two_pointers_attempted': '2PA',
      'two-pointers-attempted': '2PA',
      '2pa': '2PA',
      // Field goals made
      'fieldgoalsmade': 'FGM',
      'field_goals_made': 'FGM',
      'field-goals-made': 'FGM',
      'fgm': 'FGM',
      'fieldgoals': 'FGM',
      // Field goals attempted
      'fieldgoalsattempted': 'FGA',
      'field_goals_attempted': 'FGA',
      'field-goals-attempted': 'FGA',
      'fga': 'FGA',
      'fieldgoalattempts': 'FGA',
      // Free throws made
      'freethrowsmade': 'FTM',
      'free_throws_made': 'FTM',
      'free-throws-made': 'FTM',
      'ftm': 'FTM',
      'freethrows': 'FTM',
      // Free throws attempted
      'freethrowsattempted': 'FTA',
      'free_throws_attempted': 'FTA',
      'free-throws-attempted': 'FTA',
      'fta': 'FTA',
    };
    
    return betTypeMap[singleStatNormalized] || betType.toUpperCase();
  };
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<string>('last10HitRate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [gameFilter, setGameFilter] = useState<string>('');
  const [propTypeFilter, setPropTypeFilter] = useState<string>('');
  
  // Get all props (not just top 10)
  const allProps = useMemo(() => {
    if (!predictedProps) return [];
    
    // Sort by activeTab preference
    const sorted = activeTab === 'hottest'
      ? [...predictedProps].sort((a: any, b: any) => (b.last10HitRate || 0) - (a.last10HitRate || 0))
      : [...predictedProps].sort((a: any, b: any) => (a.last10HitRate || 0) - (b.last10HitRate || 0));
    
    return sorted;
  }, [predictedProps, activeTab]);
  
  // Get unique games for filter - use player_props_games.id (UUID) as the filter key
  const uniqueGames = useMemo(() => {
    const gamesMap = new Map<string, { id: string; label: string; homeTeam: string; awayTeam: string }>();
    
    allProps.forEach((prop: any) => {
      const propsGame = Array.isArray(prop.player_props_games) 
        ? prop.player_props_games[0] 
        : prop.player_props_games;
      
      // Use player_props_games.id (UUID) as the unique identifier
      const propsGameId = propsGame?.id;
      
      if (propsGameId) {
        // Try to find the game in allGames first for team names
        let homeTeam = '';
        let awayTeam = '';
        
        const nbaGameId = propsGame?.nba_game_id;
        if (nbaGameId) {
          const game = allGames.find((g: any) => {
            const gId = g.gameId || g.game_id;
            return String(gId) === String(nbaGameId);
          });
          
          if (game) {
            homeTeam = game.homeTeam?.abbreviation || game.home_team_tricode || game.homeTeam?.tricode || '';
            awayTeam = game.awayTeam?.abbreviation || game.away_team_tricode || game.awayTeam?.tricode || '';
          }
        }
        
        // Fallback to team codes from player_props_games
        if (!homeTeam || !awayTeam) {
          homeTeam = propsGame?.home_team_tricode || '';
          awayTeam = propsGame?.away_team_tricode || '';
        }
        
        if (homeTeam && awayTeam) {
          const label = `${awayTeam} @ ${homeTeam}`;
          gamesMap.set(propsGameId, { id: propsGameId, label, homeTeam, awayTeam });
        }
      }
    });
    
    // Convert to array and sort by label
    return Array.from(gamesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allProps, allGames]);
  
  // Get unique prop types for filter
  const uniquePropTypes = useMemo(() => {
    const types = new Set<string>();
    allProps.forEach((prop: any) => {
      if (prop.bet_type) {
        types.add(prop.bet_type);
      }
    });
    return Array.from(types).sort();
  }, [allProps]);
  
  // Filter and sort props
  const filteredAndSortedProps = useMemo(() => {
    let filtered = [...allProps];
    
    // Filter by game (using player_props_games.id UUID)
    if (gameFilter) {
      filtered = filtered.filter((prop: any) => {
        const propsGame = Array.isArray(prop.player_props_games) 
          ? prop.player_props_games[0] 
          : prop.player_props_games;
        const propsGameId = propsGame?.id;
        // Filter by player_props_games.id (UUID)
        return propsGameId === gameFilter;
      });
    }
    
    // Filter by prop type
    if (propTypeFilter) {
      filtered = filtered.filter((prop: any) => prop.bet_type === propTypeFilter);
    }
    
    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle null/undefined
      if (aVal == null) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
      
      // Handle string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      // Numeric comparison
      const comparison = (aVal as number) - (bVal as number);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [allProps, gameFilter, propTypeFilter, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProps.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedProps = filteredAndSortedProps.slice(startIndex, endIndex);
  
  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [gameFilter, propTypeFilter, sortField, sortDirection]);
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          width: '95vw',
          maxWidth: 1400,
          maxHeight: '95vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          p: 0,
        }}
      >
        <ModalClose />
        
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography level="h3" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 2 }}>
            Prop Predictions - {selectedDate.format('MMMM D, YYYY')}
          </Typography>
          
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <FormControl size="sm" sx={{ minWidth: 250 }}>
              <FormLabel>Filter by Game</FormLabel>
              <Select
                value={gameFilter}
                onChange={(e, val) => setGameFilter(val || '')}
                placeholder="All Games"
              >
                <Option value="">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography>All Games</Typography>
                  </Box>
                </Option>
                {uniqueGames.map((game) => (
                  <Option key={game.id} value={game.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar 
                        src={getTeamLogoUrl(game.awayTeam)}
                        alt={game.awayTeam}
                        sx={{ width: 20, height: 20 }}
                      />
                      <Typography>@</Typography>
                      <Avatar 
                        src={getTeamLogoUrl(game.homeTeam)}
                        alt={game.homeTeam}
                        sx={{ width: 20, height: 20 }}
                      />
                      <Typography sx={{ ml: 1 }}>{game.label}</Typography>
                    </Box>
                  </Option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="sm" sx={{ minWidth: 200 }}>
              <FormLabel>Filter by Prop Type</FormLabel>
              <Select
                value={propTypeFilter}
                onChange={(e, val) => setPropTypeFilter(val || '')}
                placeholder="All Props"
              >
                <Option value="">All Props</Option>
                {uniquePropTypes.map((type) => (
                  <Option key={type} value={type}>
                    {type}
                  </Option>
                ))}
              </Select>
            </FormControl>
            
            <Box sx={{ flex: 1 }} />
            
            <Typography level="body-sm" sx={{ alignSelf: 'flex-end', color: '#CCCCCC' }}>
              {filteredAndSortedProps.length} props
            </Typography>
          </Box>
        </Box>
        
        {/* Table */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : paginatedProps.length > 0 ? (
            <Table hoverRow stickyHeader>
              <thead>
                <tr>
                  <th 
                    style={{ color: '#FFFFFF', cursor: 'pointer' }}
                    onClick={() => handleSort('player_name')}
                  >
                    Player {sortField === 'player_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    style={{ color: '#FFFFFF', cursor: 'pointer' }}
                    onClick={() => handleSort('bet_type')}
                  >
                    Prop {sortField === 'bet_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    style={{ color: '#FFFFFF', cursor: 'pointer' }}
                    onClick={() => handleSort('line')}
                  >
                    Line {sortField === 'line' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    style={{ color: '#FFFFFF', cursor: 'pointer' }}
                    onClick={() => handleSort('last10HitRate')}
                  >
                    Hit Rate {sortField === 'last10HitRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    style={{ color: '#FFFFFF', cursor: 'pointer' }}
                    onClick={() => handleSort('american_odds')}
                  >
                    Odds {sortField === 'american_odds' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ color: '#FFFFFF' }}>Game</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProps.map((prop: any, index: number) => {
                  const propsGame = Array.isArray(prop.player_props_games) 
                    ? prop.player_props_games[0] 
                    : prop.player_props_games;
                  const propsGameId = propsGame?.id; // player_props_games UUID
                  const nbaGameId = propsGame?.nba_game_id;
                  const game = allGames.find((g: any) => (g.gameId || g.game_id) === nbaGameId);
                  
                  // Get team tricodes
                  let homeTeam = game?.homeTeam?.abbreviation || game?.home_team_tricode || game?.homeTeam?.tricode || '';
                  let awayTeam = game?.awayTeam?.abbreviation || game?.away_team_tricode || game?.awayTeam?.tricode || '';
                  
                  // Fallback to player_props_games team codes
                  if (!homeTeam || !awayTeam) {
                    homeTeam = propsGame?.home_team_tricode || '';
                    awayTeam = propsGame?.away_team_tricode || '';
                  }
                  
                  const gameLabel = homeTeam && awayTeam ? `${awayTeam} @ ${homeTeam}` : 'N/A';
                  
                  return (
                    <tr 
                      key={prop.id || index}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (prop.player_id) {
                          navigate(`/player/${prop.player_id}`);
                          onClose();
                        }
                      }}
                    >
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar 
                            src={prop.nba_player_id && prop.nba_player_id > 0
                              ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png`
                              : undefined
                            }
                            alt={prop.player_name}
                            sx={{ width: 32, height: 32 }}
                          >
                            {(!prop.nba_player_id || prop.nba_player_id === 0) && (
                              <Typography sx={{ fontSize: '0.7rem', color: '#FFFFFF' }}>
                                {prop.player_name?.charAt(0) || '?'}
                              </Typography>
                            )}
                          </Avatar>
                          <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {prop.player_name || 'N/A'}
                          </Typography>
                        </Box>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                          {formatBetType(prop.bet_type)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                          {(() => {
                            const lineValue = prop.currentLine || prop.line;
                            if (lineValue == null) return 'N/A';
                            const numValue = typeof lineValue === 'string' ? parseFloat(lineValue) : lineValue;
                            return isNaN(numValue) ? 'N/A' : numValue.toFixed(1);
                          })()}
                        </Typography>
                      </td>
                      <td>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            color: activeTab === 'hottest' 
                              ? (prop.last10HitRate >= 70 ? '#10B981' : prop.last10HitRate >= 50 ? '#FFC72C' : '#CCCCCC')
                              : (prop.last10HitRate <= 30 ? '#EF4444' : prop.last10HitRate <= 50 ? '#FFC72C' : '#CCCCCC'),
                            fontWeight: 600,
                          }}
                        >
                          {prop.last10HitRate !== null ? `${prop.last10HitRate.toFixed(1)}%` : 'N/A'} ({prop.last10Hits}/{prop.last10Total})
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                          {prop.american_odds || prop.price || 'N/A'}
                        </Typography>
                      </td>
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {awayTeam && (
                            <Avatar 
                              src={getTeamLogoUrl(awayTeam)}
                              alt={awayTeam}
                              sx={{ width: 20, height: 20 }}
                            />
                          )}
                          <Typography level="body-sm" sx={{ color: '#CCCCCC', mx: 0.5 }}>
                            @
                          </Typography>
                          {homeTeam && (
                            <Avatar 
                              src={getTeamLogoUrl(homeTeam)}
                              alt={homeTeam}
                              sx={{ width: 20, height: 20 }}
                            />
                          )}
                          {(!awayTeam || !homeTeam) && (
                            <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                              {gameLabel}
                            </Typography>
                          )}
                        </Box>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                No prop predictions available.
              </Typography>
            </Alert>
          )}
        </Box>
        
        {/* Pagination */}
        {filteredAndSortedProps.length > 0 && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedProps.length)} of {filteredAndSortedProps.length} props
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControl size="sm" sx={{ minWidth: 100 }}>
                <Select
                  value={rowsPerPage}
                  onChange={(e, val) => {
                    setRowsPerPage(val as number);
                    setPage(1);
                  }}
                >
                  <Option value={10}>10 per page</Option>
                  <Option value={25}>25 per page</Option>
                  <Option value={50}>50 per page</Option>
                  <Option value={100}>100 per page</Option>
                </Select>
              </FormControl>
              
              <Button
                size="sm"
                variant="outlined"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Typography level="body-sm" sx={{ px: 2, color: '#CCCCCC' }}>
                Page {page} of {totalPages}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}
      </ModalDialog>
    </Modal>
  );
}

// Standings Module
export function StandingsModule({ 
  standings, 
  standingsLoading, 
  navigate 
}: { 
  standings: any; 
  standingsLoading: boolean; 
  navigate: (path: string) => void;
}) {
  const [conference, setConference] = useState<'east' | 'west'>('east');
  
  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Standings
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="sm"
              variant={conference === 'east' ? 'solid' : 'outlined'}
              onClick={() => setConference('east')}
            >
              East
            </Button>
            <Button
              size="sm"
              variant={conference === 'west' ? 'solid' : 'outlined'}
              onClick={() => setConference('west')}
            >
              West
            </Button>
          </Stack>
        </Box>
        
        {standingsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : standings && standings[conference] ? (
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ color: '#FFFFFF' }}>Team</th>
                <th style={{ color: '#FFFFFF' }}>W</th>
                <th style={{ color: '#FFFFFF' }}>L</th>
                <th style={{ color: '#FFFFFF' }}>PCT</th>
              </tr>
            </thead>
            <tbody>
              {standings[conference].slice(0, 8).map((team: any, index: number) => (
                <tr 
                  key={team.team_id || index}
                  style={{ cursor: 'pointer' }}
                  onClick={async () => {
                    if (!team.team_id) return;
                    try {
                      const { data: teamData, error } = await supabase
                        .from('nba_teams')
                        .select('id')
                        .eq('team_id', team.team_id)
                        .single();

                      if (error) {
                        console.error('Error handling team click:', error);
                        return;
                      }

                      if (teamData?.id) {
                        navigate(`/team/${teamData.id}`);
                      }
                    } catch (error) {
                      console.error('Error handling team click:', error);
                    }
                  }}
                >
                  <td>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                      {team.team_abbreviation || team.abbreviation}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      {team.wins || team.w}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      {team.losses || team.l}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      {team.win_percentage ? team.win_percentage.toFixed(3) : 'N/A'}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              No standings data available.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Favorite Players Module
export function FavoritePlayersModule({ navigate }: { navigate: (path: string) => void }) {
  const { user } = useAuth();
  const { data: favoritePlayers } = usePlayerFavorites();
  const removeFromFavoritesMutation = useRemoveFromFavorites();
  
  // Get today's games to check if players are playing
  const todayEST = getTodayEST();
  const { data: todayGames } = useGamesByDate(null);
  const { data: nbaScoreboard } = useNBAScoreboard(todayEST);
  
  const allTodayGames = useMemo(() => {
    return nbaScoreboard?.games || todayGames || [];
  }, [nbaScoreboard, todayGames]);
  
  // Get team abbreviations from today's games
  const todayTeamAbbreviations = useMemo(() => {
    const teams = new Set<string>();
    allTodayGames.forEach((game: any) => {
      if (game.homeTeam?.abbreviation) teams.add(game.homeTeam.abbreviation);
      if (game.awayTeam?.abbreviation) teams.add(game.awayTeam.abbreviation);
    });
    return teams;
  }, [allTodayGames]);
  
  // Get player teams
  const { data: playerTeams } = useQuery({
    queryKey: ['favorite-player-teams', favoritePlayers?.map((p: any) => p.nba_players?.nba_player_id)],
    queryFn: async () => {
      if (!favoritePlayers || favoritePlayers.length === 0) return new Map();
      
      const nbaPlayerIds = favoritePlayers
        .map((p: any) => p.nba_players?.nba_player_id)
        .filter(Boolean);
      
      const { data } = await supabase
        .from('nba_players')
        .select('nba_player_id, team_abbreviation')
        .in('nba_player_id', nbaPlayerIds);
      
      const map = new Map();
      data?.forEach((p: any) => {
        map.set(p.nba_player_id, p.team_abbreviation);
      });
      return map;
    },
    enabled: !!favoritePlayers && favoritePlayers.length > 0,
  });
  
  if (!user) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
        <CardContent>
          <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 2 }}>
            Favorite Players
          </Typography>
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              Sign in to view your favorite players.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 2 }}>
          Favorite Players
        </Typography>
        
        {!favoritePlayers || favoritePlayers.length === 0 ? (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              No favorite players yet. Add players to see them here.
            </Typography>
          </Alert>
        ) : (
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ color: '#FFFFFF' }}>Player</th>
                <th style={{ color: '#FFFFFF' }}>Team</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {favoritePlayers.map((player: any) => {
                const teamAbbr = playerTeams?.get(player.nba_players?.nba_player_id);
                const isPlayingToday = teamAbbr && todayTeamAbbreviations.has(teamAbbr);
                
                return (
                  <tr 
                    key={player.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (player.player_id) {
                        navigate(`/player/${player.player_id}`);
                      }
                    }}
                  >
                    <td>
                      <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                        {player.nba_players?.name || 'Unknown'}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                        {teamAbbr || player.nba_players?.team_abbreviation || 'FA'}
                      </Typography>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (player.player_id) {
                            removeFromFavoritesMutation.mutate({ playerId: player.player_id });
                          }
                        }}
                        sx={{
                          '&:hover': {
                            bgcolor: 'rgba(239, 68, 68, 0.2)',
                          },
                        }}
                      >
                        <Close />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to calculate season injury progress bar
function calculateInjuryProgress(injuryHistory: any[]): Array<{
  status: string;
  startPercent: number;
  widthPercent: number;
}> {
  if (!injuryHistory || injuryHistory.length === 0) {
    return [{ status: 'Healthy', startPercent: 0, widthPercent: 100 }];
  }

  // Season start: October 21, 2025
  const firstDate = new Date('2025-10-21');
  firstDate.setHours(0, 0, 0, 0);
  const lastDate = new Date(); // Today
  lastDate.setHours(23, 59, 59, 999);
  const totalDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Sort injuries by date (oldest first)
  const sorted = [...injuryHistory].sort((a, b) => 
    new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime()
  );

  // Group consecutive injuries by status
  const injurySegments: Array<{
    status: string;
    startDate: Date;
    endDate: Date;
  }> = [];

  let currentSegment: any = null;
  sorted.forEach((injury) => {
    const injuryDate = new Date(injury.date_updated);
    injuryDate.setHours(0, 0, 0, 0);
    const status = injury.injury_status || 'Healthy';
    
    // Normalize status
    const normalizedStatus = 
      status === 'Day-to-Day' ? 'Questionable' :
      status === 'Out' ? 'Out' :
      status === 'Questionable' ? 'Questionable' :
      status === 'Probable' ? 'Probable' :
      'Healthy';
    
    if (!currentSegment || currentSegment.status !== normalizedStatus) {
      if (currentSegment) {
        injurySegments.push(currentSegment);
      }
      currentSegment = {
        status: normalizedStatus,
        startDate: injuryDate,
        endDate: injuryDate,
      };
    } else {
      currentSegment.endDate = injuryDate;
    }
  });

  if (currentSegment) {
    injurySegments.push(currentSegment);
  }

  // Fill gaps with Healthy segments
  const allSegments: Array<{
    status: string;
    startPercent: number;
    widthPercent: number;
  }> = [];

  injurySegments.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  let currentDate = new Date(firstDate);

  injurySegments.forEach((segment) => {
    const segmentStart = new Date(segment.startDate);
    segmentStart.setHours(0, 0, 0, 0);

    // Fill gap before this segment
    if (currentDate.getTime() < segmentStart.getTime()) {
      const gapEnd = new Date(segmentStart);
      gapEnd.setDate(gapEnd.getDate() - 1);
      
      if (currentDate.getTime() <= gapEnd.getTime()) {
        const gapDays = Math.ceil((gapEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const gapStartDays = Math.ceil((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        
        allSegments.push({
          status: 'Healthy',
          startPercent: (gapStartDays / totalDays) * 100,
          widthPercent: (gapDays / totalDays) * 100,
        });
      }
    }

    // Add injury segment
    const segmentStartDays = Math.ceil((segmentStart.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const segmentEnd = new Date(segment.endDate);
    segmentEnd.setHours(23, 59, 59, 999);
    const segmentEndDays = Math.ceil((segmentEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const segmentDays = segmentEndDays - segmentStartDays + 1;

    allSegments.push({
      status: segment.status,
      startPercent: (segmentStartDays / totalDays) * 100,
      widthPercent: (segmentDays / totalDays) * 100,
    });

    currentDate = new Date(segmentEnd);
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  });

  // Fill gap from last injury to today
  if (currentDate.getTime() <= lastDate.getTime()) {
    const gapStartDays = Math.ceil((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const gapDays = Math.ceil((lastDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    allSegments.push({
      status: 'Healthy',
      startPercent: (gapStartDays / totalDays) * 100,
      widthPercent: (gapDays / totalDays) * 100,
    });
  }

  // If no injuries, fill entire timeline
  if (allSegments.length === 0) {
    allSegments.push({
      status: 'Healthy',
      startPercent: 0,
      widthPercent: 100,
    });
  }

  return allSegments.sort((a, b) => a.startPercent - b.startPercent);
}

function getStatusColorForProgress(status: string): string {
  switch (status) {
    case 'Healthy': return '#10B981'; // Green
    case 'Out': return '#EF4444'; // Red
    case 'Probable': return '#FFC72C'; // Yellow
    case 'Questionable': return '#FF6B35'; // Orange
    default: return '#666666'; // Gray
  }
}

// Injuries Module - Shows current NBA injuries (or historical for past dates)
export function InjuriesModule({ 
  navigate, 
  selectedDate 
}: { 
  navigate: (path: string) => void;
  selectedDate?: Dayjs;
}) {
  const [selectedStatus, setSelectedStatus] = useState<string>('Out');
  const [page, setPage] = useState<Record<string, number>>({ Out: 1, Questionable: 1, 'Day-to-Day': 1 });
  const [gameFilter, setGameFilter] = useState<string>('');
  const ITEMS_PER_PAGE = 5;

  // Determine if we should show current injuries or historical injuries
  const isPastDate = selectedDate && selectedDate.isBefore(dayjs(), 'day');
  const targetDate = selectedDate ? selectedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
  const isToday = !selectedDate || selectedDate.isSame(dayjs(), 'day');
  
  // Fetch games for the date
  const { data: games } = useGamesByDate(targetDate);
  const { data: nbaScoreboard } = useNBAScoreboard(isToday ? targetDate : undefined);
  
  const allGames = useMemo(() => {
    if (isToday && nbaScoreboard?.games) {
      const filteredScoreboardGames = nbaScoreboard.games.filter((game: any) => {
        const gameDate = game.gameDate || game.game_date;
        if (!gameDate) return false;
        try {
          if (gameDate.includes('T') || gameDate.includes(' ')) {
            return isDateInEST(gameDate, targetDate);
          } else {
            const utcDate = new Date(gameDate + 'T00:00:00Z');
            const estDateString = utcToESTDate(utcDate);
            return estDateString === targetDate;
          }
        } catch (e) {
          return false;
        }
      });
      return filteredScoreboardGames.length > 0 ? filteredScoreboardGames : (games || []);
    }
    return games || [];
  }, [isToday, nbaScoreboard, games, targetDate]);
  
  // Get unique games for filter
  const uniqueGames = useMemo(() => {
    const gamesMap = new Map<string, { id: string; label: string }>();
    allGames.forEach((game: any) => {
      const gameId = game.gameId || game.game_id;
      const homeTeam = game.homeTeam?.abbreviation || game.home_team_tricode || game.homeTeam?.tricode || '';
      const awayTeam = game.awayTeam?.abbreviation || game.away_team_tricode || game.awayTeam?.tricode || '';
      if (homeTeam && awayTeam && gameId) {
        const label = `${awayTeam} @ ${homeTeam}`;
        gamesMap.set(gameId, { id: gameId, label });
      }
    });
    return Array.from(gamesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allGames]);
  
  const { data: injuries, isLoading } = useQuery({
    queryKey: ['injuries', targetDate, isPastDate],
    queryFn: async () => {
      if (isPastDate) {
        // For past dates: show the injury report snapshot for that exact day (date_updated = report date)
        const dayStart = `${targetDate}T00:00:00.000Z`;
        const dayEnd = `${targetDate}T23:59:59.999Z`;
        const { data, error } = await supabase
          .from('nba_injuries')
          .select(`
            id,
            nba_player_id,
            injury_type,
            injury_description,
            injury_status,
            date_updated,
            report_timestamp,
            nba_players!nba_player_id (
              id,
              name,
              team_abbreviation,
              position
            )
          `)
          .gte('date_updated', dayStart)
          .lte('date_updated', dayEnd)
          .in('injury_status', ['Out', 'Questionable', 'Day-to-Day'])
          .order('date_updated', { ascending: false })
          .limit(200);
        
        if (error) {
          console.error('Error fetching historical injuries:', error);
          return [];
        }
        
        // One row per player for this report date (dedupe by player)
        const playerMap = new Map<number, any>();
        if (data) {
          data.forEach((injury: any) => {
            const playerId = injury.nba_player_id;
            if (!playerMap.has(playerId)) {
              playerMap.set(playerId, injury);
            }
          });
        }
        
        return Array.from(playerMap.values());
      } else {
        // For today/future: show current injury report (latest fetch)
        const { data, error } = await supabase
          .from('nba_injuries')
          .select(`
            id,
            nba_player_id,
            injury_type,
            injury_description,
            injury_status,
            date_updated,
            nba_players!nba_player_id (
              id,
              name,
              team_abbreviation,
              position
            )
          `)
          .eq('is_current', true)
          .in('injury_status', ['Out', 'Questionable', 'Day-to-Day'])
          .order('injury_status', { ascending: false })
          .order('date_updated', { ascending: false })
          .limit(200);
        
        if (error) {
          console.error('Error fetching current injuries:', error);
          return [];
        }
        
        return data || [];
      }
    },
    refetchInterval: isPastDate ? false : 300000,
  });

  // Fetch season minutes for all injured players
  const allPlayerIds = useMemo(() => {
    if (!injuries) return [];
    return injuries.map((injury: any) => injury.nba_player_id).filter(Boolean);
  }, [injuries]);

  const { data: minutesMap } = useQuery({
    queryKey: ['injury-season-minutes', allPlayerIds],
    queryFn: async () => {
      if (allPlayerIds.length === 0) return new Map<number, number>();

      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, min')
        .in('nba_player_id', allPlayerIds)
        .eq('season_year', '2025-26')
        .gte('game_date', '2025-10-21')
        .lte('game_date', '2026-04-12');

      if (error) {
        console.error('Error fetching season minutes:', error);
        return new Map<number, number>();
      }

      // Calculate total minutes per player
      const map = new Map<number, number>();
      if (data) {
        data.forEach((boxscore: any) => {
          const playerId = boxscore.nba_player_id;
          let minutes = 0;
          
          // Handle minutes format: could be "36:00" string or number
          if (typeof boxscore.min === 'string' && boxscore.min.includes(':')) {
            const [mins, secs] = boxscore.min.split(':').map(Number);
            minutes = mins + (secs / 60);
          } else {
            minutes = parseFloat(String(boxscore.min || 0));
          }
          
          map.set(playerId, (map.get(playerId) || 0) + minutes);
        });
      }

      return map;
    },
    enabled: allPlayerIds.length > 0,
  });

  // Group injuries by status, filter by game, and sort by minutes played
  const injuriesByStatus = useMemo(() => {
    if (!injuries) return { Out: [], Questionable: [], 'Day-to-Day': [] };
    
    let filteredInjuries = injuries;
    
    // Filter by game if selected
    if (gameFilter) {
      const selectedGame = allGames.find((g: any) => {
        const gId = g.gameId || g.game_id;
        return String(gId) === String(gameFilter);
      });
      
      if (selectedGame) {
        const homeTeam = selectedGame.homeTeam?.abbreviation || selectedGame.home_team_tricode || selectedGame.homeTeam?.tricode || '';
        const awayTeam = selectedGame.awayTeam?.abbreviation || selectedGame.away_team_tricode || selectedGame.awayTeam?.tricode || '';
        
        filteredInjuries = injuries.filter((injury: any) => {
          const playerTeam = injury.nba_players?.team_abbreviation;
          return playerTeam === homeTeam || playerTeam === awayTeam;
        });
      }
    }
    
    const grouped: Record<string, any[]> = {
      Out: [],
      Questionable: [],
      'Day-to-Day': [],
    };
    
    filteredInjuries.forEach((injury: any) => {
      const status = injury.injury_status;
      if (grouped[status]) {
        grouped[status].push(injury);
      }
    });
    
    // Sort each status group by minutes played (descending)
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => {
        const minutesA = minutesMap?.get(a.nba_player_id) || 0;
        const minutesB = minutesMap?.get(b.nba_player_id) || 0;
        return minutesB - minutesA; // Descending order
      });
    });
    
    return grouped;
  }, [injuries, minutesMap, gameFilter, allGames]);

  // Fetch injury history for visible players
  const visibleInjuries = useMemo(() => {
    const statusInjuries = injuriesByStatus[selectedStatus] || [];
    const startIdx = (page[selectedStatus] - 1) * ITEMS_PER_PAGE;
    return statusInjuries.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [injuriesByStatus, selectedStatus, page]);

  const playerIds = useMemo(() => 
    visibleInjuries.map((injury: any) => injury.nba_player_id).filter(Boolean),
    [visibleInjuries]
  );

  // Fetch injury history for all visible players
  const { data: injuryHistoryMap } = useQuery({
    queryKey: ['injury-history', playerIds],
    queryFn: async () => {
      if (playerIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from('nba_injuries')
        .select('*')
        .in('nba_player_id', playerIds)
        .in('injury_status', ['Out', 'Questionable', 'Day-to-Day', 'Probable', 'Healthy'])
        .order('date_updated', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error fetching injury history:', error);
        return new Map();
      }

      // Group by player_id
      const map = new Map<number, any[]>();
      if (data) {
        data.forEach((injury: any) => {
          const playerId = injury.nba_player_id;
          if (!map.has(playerId)) {
            map.set(playerId, []);
          }
          map.get(playerId)!.push(injury);
        });
      }

      return map;
    },
    enabled: playerIds.length > 0,
  });

  const getStatusColor = (status: string) => {
    if (status === 'Out') return 'danger';
    if (status === 'Questionable') return 'warning';
    if (status === 'Day-to-Day') return 'warning';
    return 'neutral';
  };

  const totalPages = useMemo(() => {
    const count = injuriesByStatus[selectedStatus]?.length || 0;
    return Math.ceil(count / ITEMS_PER_PAGE);
  }, [injuriesByStatus, selectedStatus]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    // Reset to page 1 when changing status
    if (!page[status]) {
      setPage({ ...page, [status]: 1 });
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage({ ...page, [selectedStatus]: newPage });
  };

  // Determine available statuses (only show chips for statuses that have injuries)
  const availableStatuses = useMemo(() => {
    const statuses: string[] = [];
    if (injuriesByStatus.Out.length > 0) statuses.push('Out');
    if (injuriesByStatus.Questionable.length > 0) statuses.push('Questionable');
    if (injuriesByStatus['Day-to-Day'].length > 0) statuses.push('Day-to-Day');
    return statuses;
  }, [injuriesByStatus]);

  // Set initial status to first available
  useEffect(() => {
    if (availableStatuses.length > 0 && !availableStatuses.includes(selectedStatus)) {
      setSelectedStatus(availableStatuses[0]);
    }
  }, [availableStatuses, selectedStatus]);

  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        {/* Header Row 1: Title */}
        <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 2 }}>
          Injuries
          {isPastDate && (
            <Typography level="body-xs" component="span" sx={{ color: '#999999', ml: 1 }}>
              ({selectedDate?.format('MMM D, YYYY')})
            </Typography>
          )}
        </Typography>
        
        {/* Header Row 2: Status Chips and Game Filter */}
        {!isLoading && availableStatuses.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, flex: 1 }}>
              {availableStatuses.map((status) => {
                // Short labels for header
                const statusLabel = status === 'Out' ? 'O' : status === 'Questionable' ? 'Q' : status;
                return (
                  <Chip
                    key={status}
                    size="md"
                    color={getStatusColor(status)}
                    variant={selectedStatus === status ? 'solid' : 'soft'}
                    onClick={() => handleStatusChange(status)}
                    sx={{
                      cursor: 'pointer',
                      fontWeight: selectedStatus === status ? 'bold' : 'normal',
                    }}
                  >
                    {statusLabel} ({injuriesByStatus[status]?.length || 0})
                  </Chip>
                );
              })}
            </Stack>
            
            {/* Game Filter */}
            {uniqueGames.length > 0 && (
              <FormControl size="sm" sx={{ minWidth: 200 }}>
                <FormLabel sx={{ fontSize: '0.75rem', mb: 0.5 }}>Game</FormLabel>
                <Select
                  value={gameFilter}
                  onChange={(e, val) => {
                    setGameFilter(val || '');
                    setPage({ ...page, [selectedStatus]: 1 }); // Reset to page 1 when filter changes
                  }}
                  placeholder="All Games"
                  sx={{ minHeight: '32px' }}
                >
                  <Option value="">All Games</Option>
                  {uniqueGames.map((game) => (
                    <Option key={game.id} value={game.id}>
                      {game.label}
                    </Option>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        )}
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : availableStatuses.length === 0 ? (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              {isPastDate ? 'No injuries reported for this date.' : 'No current injuries reported.'}
            </Typography>
          </Alert>
        ) : (
          <Stack spacing={2}>
            {/* Injuries Table */}
            {visibleInjuries.length > 0 && (
              <>
                <Table hoverRow size="sm">
                  <tbody>
                    {visibleInjuries.map((injury: any) => {
                      const playerId = injury.nba_player_id;
                      const history = injuryHistoryMap?.get(playerId) || [];
                      const progressSegments = calculateInjuryProgress(history);

                      return (
                        <tr
                          key={injury.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            if (injury.nba_players?.id) {
                              navigate(`/player/${injury.nba_players.id}`);
                            }
                          }}
                        >
                          <td style={{ width: '100%' }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                                    {injury.nba_players?.name || 'Unknown'}
                                  </Typography>
                                  <Chip size="sm" color={getStatusColor(injury.injury_status)} variant="soft">
                                    {injury.injury_status}
                                  </Chip>
                                  {injury.nba_players?.team_abbreviation && (
                                    <Avatar
                                      src={getTeamLogoUrl(injury.nba_players.team_abbreviation)}
                                      alt={injury.nba_players.team_abbreviation}
                                      sx={{ width: 20, height: 20 }}
                                    >
                                      {injury.nba_players.team_abbreviation.charAt(0)}
                                    </Avatar>
                                  )}
                                </Stack>
                              </Stack>
                              
                              {/* Season Progress Bar */}
                              {progressSegments.length > 0 && (
                                <Box sx={{ position: 'relative', width: '100%', height: 20, borderRadius: '4px', overflow: 'hidden' }}>
                                  {progressSegments.map((segment, idx) => (
                                    <Box
                                      key={`segment-${idx}`}
                                      sx={{
                                        position: 'absolute',
                                        left: `${segment.startPercent}%`,
                                        width: `${segment.widthPercent}%`,
                                        height: '100%',
                                        bgcolor: getStatusColorForProgress(segment.status),
                                        borderRadius: idx === 0 ? '4px 0 0 4px' : idx === progressSegments.length - 1 ? '0 4px 4px 0' : '0',
                                      }}
                                      title={`${segment.status}: ${segment.startPercent.toFixed(1)}% - ${(segment.startPercent + segment.widthPercent).toFixed(1)}%`}
                                    />
                                  ))}
                                </Box>
                              )}

                              {injury.injury_type && (
                                <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>
                                  {injury.injury_type.replace(/^Injury\/Illness\s*-\s*/i, '')}
                                </Typography>
                              )}
                            </Stack>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      disabled={page[selectedStatus] <= 1}
                      onClick={() => handlePageChange(page[selectedStatus] - 1)}
                    >
                      <NavigateBefore />
                    </IconButton>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', minWidth: '80px', textAlign: 'center' }}>
                      Page {page[selectedStatus]} of {totalPages}
                    </Typography>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      disabled={page[selectedStatus] >= totalPages}
                      onClick={() => handlePageChange(page[selectedStatus] + 1)}
                    >
                      <NavigateNext />
                    </IconButton>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// Live Team of the Night Module - For today when games are active
export function LiveTeamOfNightModule({ 
  navigate, 
  selectedDate,
  nbaScoreboard
}: { 
  navigate: (path: string) => void; 
  selectedDate: Dayjs;
  nbaScoreboard: any;
}) {
  const dateString = selectedDate.format('YYYY-MM-DD');
  
  // Get all game IDs for today
  const gameIds = useMemo(() => {
    if (!nbaScoreboard?.games) return [];
    return nbaScoreboard.games.map((g: any) => g.gameId).filter(Boolean);
  }, [nbaScoreboard]);
  
  // Check if there are any live games by checking live_player_stats
  const { data: liveStatsData, isLoading: liveStatsLoading } = useQuery({
    queryKey: ['live-team-of-night', dateString, gameIds.join(',')],
    queryFn: async () => {
      if (!gameIds || gameIds.length === 0) return null;
      
      // Fetch live_player_stats for all games today
      const { data: liveStats, error } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, player_id, player_name, team_tricode, stats, game_id')
        .in('game_id', gameIds);
      
      if (error) {
        console.error('Error fetching live stats:', error);
        return null;
      }
      
      if (!liveStats || liveStats.length === 0) {
        return null; // No live games
      }
      
      return liveStats;
    },
    enabled: gameIds.length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
    staleTime: 15000,
  });
  
  // Calculate Team of the Night from live stats
  const { data: liveTeamOfNight, isLoading: lineupLoading } = useQuery({
    queryKey: ['live-team-of-night-lineup', liveStatsData],
    queryFn: async () => {
      if (!liveStatsData || liveStatsData.length === 0) return null;
      
      // Get unique player IDs
      const playerIds = [...new Set(liveStatsData.map((s: any) => s.nba_player_id).filter(Boolean))];
      
      // Fetch player info and salaries
      const { data: players, error: playersError } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation, position, jersey_number')
        .in('nba_player_id', playerIds)
        .eq('is_active', true);
      
      if (playersError || !players) {
        return null;
      }
      
      // Fetch salaries
      const playerDbIds = players.map(p => p.id);
      const { data: salaries } = await supabase
        .from('nba_hoopshype_salaries')
        .select('player_id, salary_2025_26')
        .in('player_id', playerDbIds);
      
      const salaryMap = new Map(salaries?.map(s => [s.player_id, s.salary_2025_26]) || []);
      const defaultSalary = 1157153;
      
      // Calculate fantasy points for each player from live stats
      const playerPerformance = liveStatsData.map((liveStat: any) => {
        const player = players.find(p => p.nba_player_id === liveStat.nba_player_id);
        if (!player) return null;
        
        const stats = liveStat.stats || {};
        const salary = salaryMap.get(player.id) || defaultSalary;
        if (salary <= 0) return null;
        
        // Calculate FanDuel fantasy points: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
        const fantasyPoints = 
          (stats.pts || 0) + 
          ((stats.reb || 0) * 1.2) + 
          ((stats.ast || 0) * 1.5) + 
          ((stats.stl || 0) * 3) + 
          ((stats.blk || 0) * 3) - 
          (stats.tov || 0);
        
        const pointsPerDollar = salary > 0 ? fantasyPoints / salary : 0;
        
        return {
          player_id: player.id,
          nba_player_id: player.nba_player_id,
          player_name: player.name,
          team: player.team_abbreviation,
          player_position: player.position,
          jersey_number: player.jersey_number?.toString() || '0',
          salary: salary,
          fantasy_points: fantasyPoints,
          games_played: 1,
          points_per_dollar: pointsPerDollar,
          selection_score: (fantasyPoints * 0.8) + (pointsPerDollar * 1000000 * 0.2),
        };
      }).filter(Boolean) as any[];
      
      // Greedy algorithm to build optimal lineup (12 players, $208M cap)
      const salaryCap = 208000000;
      const maxPlayers = 12;
      
      // Sort by selection score
      playerPerformance.sort((a, b) => b.selection_score - a.selection_score);
      
      const lineup: any[] = [];
      let usedSalary = 0;
      let lineupOrder = 1;
      
      // First pass: Add players that fit individually
      for (const player of playerPerformance) {
        if (lineup.length >= maxPlayers) break;
        if (usedSalary + player.salary <= salaryCap) {
          lineup.push({
            ...player,
            lineup_order: lineupOrder++,
            lineup_unit: lineupOrder <= 5 ? 'starters' : lineupOrder <= 10 ? 'rotation' : 'bench',
            unit_position: lineupOrder <= 5 ? lineupOrder : lineupOrder <= 10 ? lineupOrder - 5 : lineupOrder - 10,
            weighted_points: player.fantasy_points * (lineupOrder <= 5 ? 1.0 : lineupOrder <= 10 ? 0.75 : 0.5),
          });
          usedSalary += player.salary;
        }
      }
      
      // Second pass: Try to fill remaining slots with best value players
      const remainingSlots = maxPlayers - lineup.length;
      const remainingCap = salaryCap - usedSalary;
      const usedPlayerIds = new Set(lineup.map(p => p.player_id));
      
      if (remainingSlots > 0 && remainingCap > 0) {
        const availablePlayers = playerPerformance
          .filter(p => !usedPlayerIds.has(p.player_id) && p.salary <= remainingCap)
          .sort((a, b) => b.points_per_dollar - a.points_per_dollar);
        
        for (const player of availablePlayers) {
          if (lineup.length >= maxPlayers) break;
          if (usedSalary + player.salary <= salaryCap) {
            lineup.push({
              ...player,
              lineup_order: lineupOrder++,
              lineup_unit: lineupOrder <= 5 ? 'starters' : lineupOrder <= 10 ? 'rotation' : 'bench',
              unit_position: lineupOrder <= 5 ? lineupOrder : lineupOrder <= 10 ? lineupOrder - 5 : lineupOrder - 10,
              weighted_points: player.fantasy_points * (lineupOrder <= 5 ? 1.0 : lineupOrder <= 10 ? 0.75 : 0.5),
            });
            usedSalary += player.salary;
          }
        }
      }
      
      return lineup;
    },
    enabled: !!liveStatsData && liveStatsData.length > 0,
  });
  
  const isLoading = liveStatsLoading || lineupLoading;
  const hasLiveGames = liveStatsData && liveStatsData.length > 0;
  
  // Use the lineup as-is (already optimized with salary constraints) - MUST be before early return (Rules of Hooks)
  const sortedPlayers = useMemo(() => {
    if (!liveTeamOfNight || liveTeamOfNight.length === 0) return [];
    // Return lineup in order (already optimized with salary constraints)
    return [...liveTeamOfNight].sort((a, b) => (a.lineup_order || 0) - (b.lineup_order || 0));
  }, [liveTeamOfNight]);
  
  // Calculate total salary
  const totalSalary = useMemo(() => {
    if (!liveTeamOfNight || liveTeamOfNight.length === 0) return 0;
    return liveTeamOfNight.reduce((sum, p) => sum + (p.salary || 0), 0);
  }, [liveTeamOfNight]);
  
  // If no live games, don't render (Prop Predictions will show instead)
  if (!isLoading && !hasLiveGames) {
    return null;
  }
  
  return (
    <Card 
      variant="outlined" 
      onClick={() => navigate(`/today/totn?date=${dateString}`)}
      sx={{ 
        bgcolor: '#1a1a1a', 
        borderColor: '#333333', 
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: '#FFC72C',
          boxShadow: '0 4px 12px rgba(255, 199, 44, 0.2)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Live Team of the Night
          </Typography>
          {totalSalary > 0 && (
            <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
              ${(totalSalary / 1000000).toFixed(2)}M salary
            </Typography>
          )}
        </Box>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : sortedPlayers && sortedPlayers.length > 0 ? (
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ color: '#FFFFFF' }}>Player</th>
                <th style={{ color: '#FFFFFF' }}>Team</th>
                <th style={{ color: '#FFFFFF' }}>Salary</th>
                <th style={{ color: '#FFFFFF' }}>FP</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.slice(0, 12).map((player: any, index: number) => (
                <tr 
                  key={player.player_id || player.nba_player_id || index}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (player.player_id) {
                      navigate(`/player/${player.player_id}`);
                    }
                  }}
                >
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar 
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                        alt={player.player_name}
                        sx={{ width: 24, height: 24 }}
                      />
                      <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                        {player.player_name || 'N/A'}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      {player.team || 'N/A'}
                    </Typography>
                  </td>
                  <td>
                    <Typography 
                      level="body-sm" 
                      sx={{ 
                        color: '#B0B0B0',
                        fontWeight: 500,
                      }}
                    >
                      {player.salary ? `$${(player.salary / 1000000).toFixed(2)}M` : 'N/A'}
                    </Typography>
                  </td>
                  <td>
                    <Typography 
                      level="body-sm" 
                      sx={{ 
                        color: '#FFC72C',
                        fontWeight: 600,
                      }}
                    >
                      {player.fantasy_points ? player.fantasy_points.toFixed(1) : '0.0'}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              No live game data available yet. Games may not have started.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Team of the Night Module
export function TeamOfNightModule({ 
  navigate, 
  selectedDate 
}: { 
  navigate: (path: string) => void; 
  selectedDate: Dayjs;
}) {
  const dateString = selectedDate.format('YYYY-MM-DD');

  return (
    <Card 
      variant="outlined" 
      onClick={() => navigate(`/today/totn?date=${dateString}`)}
      sx={{ 
        bgcolor: '#1a1a1a', 
        borderColor: '#333333', 
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: '#FFC72C',
          boxShadow: '0 4px 12px rgba(255, 199, 44, 0.2)',
        },
      }}
    >
      <CardContent>
        <PlayersOfNightSection navigate={navigate} selectedDate={selectedDate} hideHeader={false} compact={true} />
      </CardContent>
    </Card>
  );
}

// Leaders Module
export function LeadersModule({ navigate }: { navigate: (path: string) => void }) {
  const availableCategories = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT'];
  const [categoryIndex, setCategoryIndex] = useState(0);
  const activeCategory = availableCategories[categoryIndex];

  const { data: leaders, isLoading } = useQuery<Leader[]>({
    queryKey: ['nba-leaders-full', activeCategory],
    queryFn: async () => {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10 
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      const { data: leadersData, error: leadersError } = await supabase
        .from('nba_leaders')
        .select('*')
        .eq('season', season)
        .eq('category', activeCategory)
        .order('rank', { ascending: true })
        .limit(8);

      if (leadersError) return [];

      const playerIds = leadersData.map(l => l.player_id);
      const { data: playersData } = await supabase
        .from('nba_players')
        .select('id, name, team_abbreviation, nba_player_id')
        .in('id', playerIds);

      if (!playersData) return [];

      const playersMap = new Map(playersData.map(p => [p.id, p]));

      return leadersData.map(leader => ({
        ...leader,
        player_name: playersMap.get(leader.player_id)?.name,
        team_abbreviation: playersMap.get(leader.player_id)?.team_abbreviation,
        nba_player_id: playersMap.get(leader.player_id)?.nba_player_id || 0,
      }));
    },
    staleTime: 60 * 60 * 1000,
  });

  const getCategoryLabel = (category: string) => {
    return CATEGORY_LABELS[category] || category;
  };

  const getNextCategory = () => {
    setCategoryIndex((prev) => (prev === availableCategories.length - 1 ? 0 : prev + 1));
  };

  const getPrevCategory = () => {
    setCategoryIndex((prev) => (prev === 0 ? availableCategories.length - 1 : prev - 1));
  };
  
  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Leaders
          </Typography>
          <Stack direction="row" spacing={1}>
            <IconButton
              size="sm"
              variant="outlined"
              onClick={getPrevCategory}
              sx={{
                color: '#FFFFFF',
                borderColor: '#333333',
                '&:hover': {
                  borderColor: '#FFC72C',
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                },
              }}
            >
              <NavigateBefore />
            </IconButton>
            <Button
              size="sm"
              variant="solid"
              sx={{
                minWidth: '80px',
                bgcolor: '#FFC72C',
                color: '#000000',
                '&:hover': {
                  bgcolor: '#FFD700',
                },
              }}
            >
              {getCategoryLabel(activeCategory)}
            </Button>
            <IconButton
              size="sm"
              variant="outlined"
              onClick={getNextCategory}
              sx={{
                color: '#FFFFFF',
                borderColor: '#333333',
                '&:hover': {
                  borderColor: '#FFC72C',
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                },
              }}
            >
              <NavigateNext />
            </IconButton>
          </Stack>
        </Box>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : leaders && leaders.length > 0 ? (
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ color: '#FFFFFF' }}>Player</th>
                <th style={{ color: '#FFFFFF' }}>{getCategoryLabel(activeCategory)}</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader) => {
                const valueText = activeCategory.includes('PCT') 
                  ? (leader.value * 100).toFixed(1) + '%'
                  : leader.value.toFixed(1);

                return (
                  <tr 
                    key={leader.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (leader.player_id) {
                        navigate(`/player/${leader.player_id}`);
                      }
                    }}
                  >
                    <td>
                      <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                        {leader.player_name || 'Unknown'}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                        {valueText}
                      </Typography>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              No leaders data available.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Team of the Week Module
function TeamOfWeekModule({ navigate }: { navigate: (path: string) => void }) {
  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        <TeamOfWeekSection navigate={navigate} hideHeader={false} />
      </CardContent>
    </Card>
  );
}
