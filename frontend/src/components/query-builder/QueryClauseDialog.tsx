/**
 * Dialog genérico para edição de cláusulas SQL
 */

import { ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface QueryClauseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export default function QueryClauseDialog({
  isOpen,
  onClose,
  title,
  children,
  width = 'lg',
}: QueryClauseDialogProps) {
  const maxWidthMap = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
    xl: 'xl' as const,
    full: false as const,
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '95vw',
          height: '95vh',
          maxWidth: '95vw',
          maxHeight: '95vh',
          m: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" component="span">
          {title}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          overflow: 'auto',
          p: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0, // Permite que o flex funcione corretamente
        }}
      >
        <Box sx={{ p: 2, flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
