/**
 * Reusable search bar for players and teams. Used in TopNavigation (desktop)
 * and on the feed page beside the Home button.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  CircularProgress,
  Avatar,
} from '@mui/joy';
import { Search } from '@mui/icons-material';
import { usePlayerSearch, SearchResult } from '../hooks/usePlayerSearch';

interface PlayerTeamSearchBarProps {
  /** Optional: compact styling for inline use (e.g. feed page) */
  compact?: boolean;
  /** Optional: max width of the input */
  maxWidth?: number | string;
  /** Optional: placeholder */
  placeholder?: string;
  /** Optional: sx for the root Box */
  sx?: object;
}

export default function PlayerTeamSearchBar({
  compact = false,
  maxWidth = 320,
  placeholder = 'Search players and teams...',
  sx = {},
}: PlayerTeamSearchBarProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery);

  useEffect(() => {
    const updatePosition = () => {
      if (searchFocused && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 280),
        });
      }
    };

    if (searchFocused) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [searchFocused, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
          setSearchFocused(false);
        }
      }
    };
    if (searchFocused) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [searchFocused]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'player') {
      navigate(`/player/${result.id}`);
    } else if (result.type === 'prospect') {
      navigate(`/prospect/${result.id}`);
    } else {
      navigate(`/team/${result.id}`);
    }
    setSearchQuery('');
    setSearchFocused(false);
  };

  return (
    <>
      <Box
        ref={searchInputRef}
        onClick={(e) => {
          const input = searchInputRef.current?.querySelector('input');
          if (input && e.target !== input) input.focus();
        }}
        sx={{
          flex: 1,
          minWidth: 0,
          maxWidth: typeof maxWidth === 'number' ? maxWidth : maxWidth,
          ...sx,
        }}
      >
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            if (value.length >= 2) setSearchFocused(true);
            else if (value.length === 0) setSearchFocused(false);
          }}
          onFocus={() => setSearchFocused(true)}
          onBlur={(e) => {
            const relatedTarget = e.relatedTarget as Node | null;
            if (!searchDropdownRef.current?.contains(relatedTarget)) {
              setTimeout(() => {
                if (!searchDropdownRef.current?.contains(document.activeElement)) {
                  setSearchFocused(false);
                }
              }, 200);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
              e.preventDefault();
              handleSelect(searchResults[0]);
            }
            if (e.key === 'Escape') {
              setSearchFocused(false);
              setSearchQuery('');
            }
          }}
          startDecorator={<Search sx={{ color: 'text.secondary', fontSize: compact ? '0.9rem' : '1rem', pointerEvents: 'none' }} />}
          size={compact ? 'sm' : 'md'}
          sx={{
            width: '100%',
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(232, 230, 224, 0.1)',
            borderRadius: compact ? '12px' : '16px',
            py: compact ? 0.5 : 0.75,
            px: compact ? 1 : 1.5,
            color: 'text.primary',
            transition: 'all 0.2s',
            '& input': {
              color: 'text.primary',
              cursor: 'text',
              WebkitAppearance: 'none',
              MozAppearance: 'textfield',
            },
            '&:focus-within': {
              borderColor: '#FFD700',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              boxShadow: '0 0 0 3px rgba(255, 215, 0, 0.1)',
            },
            '& input::placeholder': {
              color: 'rgba(232, 230, 224, 0.4)',
            },
            '& input:focus': {
              outline: 'none',
            },
          }}
        />
      </Box>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {searchFocused && searchQuery.length >= 2 ? (
                <Box
                  ref={searchDropdownRef}
                  component={motion.div}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onMouseDown={(e) => e.preventDefault()}
                  sx={{
                    position: 'fixed',
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    bgcolor: 'rgba(18, 18, 26, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(232, 230, 224, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    zIndex: 10001,
                  }}
                >
                  {searchLoading ? (
                    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress size="sm" />
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Searching...</Typography>
                    </Box>
                  ) : searchResults && searchResults.length > 0 ? (
                    <List sx={{ p: 0.5 }}>
                      {searchResults.map((result: SearchResult) => (
                        <ListItem key={result.id} sx={{ p: 0 }}>
                          <ListItemButton
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(result);
                            }}
                            sx={{
                              p: compact ? 1 : 1.5,
                              borderRadius: '8px',
                              '&:hover': { bgcolor: 'rgba(255, 215, 0, 0.1)' },
                            }}
                          >
                            {result.type === 'player' ? (
                              <>
                                <Avatar
                                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${result.nba_player_id}.png`}
                                  alt={result.name}
                                  size="sm"
                                  sx={{ mr: 1.5 }}
                                />
                                <ListItemContent>
                                  <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                    {result.name}
                                  </Typography>
                                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                    {result.team_name || 'Free Agent'} • {result.position || 'N/A'}
                                  </Typography>
                                </ListItemContent>
                              </>
                            ) : result.type === 'prospect' ? (
                              <>
                                <Avatar
                                  src={result.image_url ?? undefined}
                                  alt={result.name}
                                  size="sm"
                                  sx={{ mr: 1.5, bgcolor: 'neutral.700' }}
                                >
                                  {!result.image_url ? result.name.charAt(0) : null}
                                </Avatar>
                                <ListItemContent>
                                  <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                    {result.name}
                                  </Typography>
                                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                    {result.school_team || '—'} • {result.position_primary || 'N/A'}
                                  </Typography>
                                </ListItemContent>
                              </>
                            ) : (
                              <>
                                <Avatar
                                  sx={{ mr: 1.5, bgcolor: 'primary.500', fontSize: '0.875rem', fontWeight: 600 }}
                                  size="sm"
                                >
                                  {result.abbreviation}
                                </Avatar>
                                <ListItemContent>
                                  <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                    {result.city} {result.nickname}
                                  </Typography>
                                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                    Team • {result.abbreviation}
                                  </Typography>
                                </ListItemContent>
                              </>
                            )}
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  ) : searchQuery.length >= 2 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        No results found
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}
