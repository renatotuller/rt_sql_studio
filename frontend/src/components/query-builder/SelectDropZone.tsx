/**
 * Componente de zona de drop para a área SELECT
 * Permite soltar colunas arrastadas do catálogo
 */

import { useDroppable } from '@dnd-kit/core';
import { useMemo } from 'react';
import { Box, Paper, Typography, useTheme, alpha } from '@mui/material';

interface SelectDropZoneProps {
  id: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}

export default function SelectDropZone({ id, children, isEmpty = false }: SelectDropZoneProps) {
  const theme = useTheme();
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'select-zone',
    },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: isOver ? 2 : 0,
        borderColor: isOver ? 'primary.main' : 'transparent',
        borderStyle: isOver ? 'dashed' : 'solid',
        borderRadius: 1,
        bgcolor: isOver ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
        transition: 'all 0.2s',
      }}
    >
      {children}
      {isOver && isEmpty && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <Paper
            elevation={4}
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <Typography variant="body2" fontWeight={500}>
              Solte aqui para adicionar ao SELECT
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
