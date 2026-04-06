import Button from '@mui/joy/Button';
import Typography from '@mui/joy/Typography';
import StarsRounded from '@mui/icons-material/StarsRounded';
import type { SxProps } from '@mui/joy/styles/types';
import { profileEmailLabel } from '../../lib/profileLabel';

export type DrawerProfileIdentityTriggerProps = {
  user: { email?: string | null }
  onOpenProfile: () => void
  /** `draftDark`: mock draft drawer (light text). */
  tone?: 'default' | 'draftDark'
  sx?: SxProps
}

/** Minimal drawer header: email + stars (reputation placeholder), opens profile. */
export default function DrawerProfileIdentityTrigger({
  user,
  onOpenProfile,
  tone = 'default',
  sx,
}: DrawerProfileIdentityTriggerProps) {
  const emailLine = profileEmailLabel(user)
  const fullEmail = user?.email ?? ''

  const textColor =
    tone === 'draftDark' ? '#f4f4f5' : ('text.primary' as const)

  return (
    <Button
      variant="plain"
      color="neutral"
      onClick={onOpenProfile}
      aria-label={`Open profile, signed in as ${fullEmail}`}
      sx={{
        flex: 1,
        minWidth: 0,
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 0.75,
        px: 0,
        minHeight: 0,
        fontWeight: 'lg',
        color: textColor,
        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
        ...sx,
      }}
    >
      <Typography
        level="title-sm"
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 'lg',
          color: 'inherit',
        }}
      >
        {emailLine}
      </Typography>
      <StarsRounded
        sx={{
          fontSize: 20,
          flexShrink: 0,
          opacity: tone === 'draftDark' ? 0.9 : 0.85,
          color: tone === 'draftDark' ? 'rgba(255, 193, 7, 0.95)' : 'warning.500',
        }}
      />
    </Button>
  )
}
