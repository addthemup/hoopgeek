import {
  Modal,
  ModalDialog,
  ModalClose,
} from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import DFSLineupBuilder from './DFSLineupBuilder';

interface DFSLineupModalProps {
  poolId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function DFSLineupModal({ poolId, open, onClose }: DFSLineupModalProps) {
  const navigate = useNavigate();

  if (!open || !poolId) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          width: { xs: '100vw', sm: 900, md: 1200 },
          maxWidth: { xs: '100vw', sm: 1400 },
          maxHeight: '100vh',
          overflow: 'auto',
          p: { xs: 1, sm: 2, md: 3 },
          m: { xs: 0, sm: 2 },
          borderRadius: { xs: 0, sm: 'md' },
        }}
      >
        <ModalClose />
        <DFSLineupBuilder
          poolId={poolId}
          onSuccess={onClose}
          onPlayerClick={(nbaPlayerId) => {
            navigate(`/player/${nbaPlayerId}`);
            onClose();
          }}
        />
      </ModalDialog>
    </Modal>
  );
}

