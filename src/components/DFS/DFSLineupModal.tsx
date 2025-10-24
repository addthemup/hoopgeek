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
          minWidth: { xs: '95vw', sm: 900, md: 1200 },
          maxWidth: 1400,
          maxHeight: '95vh',
          overflow: 'auto',
          p: 3,
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

