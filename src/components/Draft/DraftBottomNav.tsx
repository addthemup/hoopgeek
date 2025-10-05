import {
  Box,
  ListItemDecorator,
  Tabs,
  TabList,
  Tab,
  tabClasses,
} from '@mui/joy';
import {
  GroupRounded as RosterIcon,
  SportsBasketball as PlayersIcon,
  StarRounded as BestAvailableIcon,
  ListAltRounded as PicksIcon,
  SwapHorizRounded as TradeIcon,
  RuleRounded as RulesIcon,
  AdminPanelSettingsRounded as CommishIcon,
  ChatRounded as ChatIcon,
} from '@mui/icons-material';

interface DraftBottomNavProps {
  activeTab: number;
  onTabChange: (tab: number) => void;
  isCommissioner?: boolean;
}

export default function DraftBottomNav({ activeTab, onTabChange, isCommissioner = false }: DraftBottomNavProps) {
  const tabs = [
    { label: 'Roster', icon: RosterIcon, color: 'primary' },
    { label: 'Players', icon: PlayersIcon, color: 'success' },
    { label: 'Best Available', icon: BestAvailableIcon, color: 'warning' },
    { label: 'Picks', icon: PicksIcon, color: 'danger' },
    { label: 'Trade', icon: TradeIcon, color: 'neutral' },
    { label: 'Chat', icon: ChatIcon, color: 'info' },
    { label: 'Rules', icon: RulesIcon, color: 'info' },
    ...(isCommissioner ? [{ label: 'Commish', icon: CommishIcon, color: 'primary' }] : []),
  ];

  // Ensure activeTab is within bounds
  const safeActiveTab = Math.max(0, Math.min(activeTab, tabs.length - 1));


  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        bgcolor: `${'var(--colors-index)'}.500`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        mt: 2,
      }}
      style={{ '--colors-index': tabs[safeActiveTab]?.color || 'primary' } as any}
    >
      <Tabs
        size="lg"
        aria-label="Draft Navigation"
        value={safeActiveTab}
        onChange={(_, value) => onTabChange(value as number)}
        sx={(theme) => ({
          p: 1,
          borderRadius: 16,
          maxWidth: '100%',
          mx: 'auto',
          boxShadow: theme.shadow.sm,
          '--joy-shadowChannel': (theme.vars.palette[tabs[safeActiveTab]?.color as keyof typeof theme.vars.palette || 'primary'] as any)?.darkChannel,
          [`& .${tabClasses.root}`]: {
            py: 1,
            flex: 1,
            transition: '0.3s',
            fontWeight: 'md',
            fontSize: 'sm',
            minHeight: '60px',
            [`&:not(.${tabClasses.selected}):not(:hover)`]: {
              opacity: 0.7,
            },
          },
        })}
      >
        <TabList
          variant="plain"
          size="sm"
          disableUnderline
          sx={{ 
            borderRadius: 'lg', 
            p: 0,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.label}
              disableIndicator
              orientation="vertical"
              {...(safeActiveTab === index && { color: tab.color as any })}
              sx={{ minWidth: '80px' }}
            >
              <ListItemDecorator sx={{ mb: 0.5 }}>
                <tab.icon fontSize="small" />
              </ListItemDecorator>
              <Box sx={{ fontSize: '0.7rem', lineHeight: 1 }}>
                {tab.label}
              </Box>
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </Box>
  );
}
