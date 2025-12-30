import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, useTheme, alpha } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

interface PageLayoutProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  backUrl?: string;
  currentView?: string;
  fullscreen?: boolean;
}

export default function PageLayout({
  title,
  children,
  actions,
  backUrl,
  currentView,
  fullscreen = false,
}: PageLayoutProps) {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: fullscreen ? 'calc(100vh - 88px)' : 'auto',
        minHeight: fullscreen ? 'calc(100vh - 88px)' : 'auto',
      }}
    >
      {/* Top Bar com título e botões de ação */}
      <Box 
        sx={{ 
          flexShrink: 0, 
          px: 0.75,
          py: 0.125,
          backgroundColor: 'background.paper',
          borderBottom: 1, 
          borderColor: 'divider',
          boxShadow: 1,
          zIndex: 50,
          position: 'sticky',
          top: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2, py: 0.5 }}>
            {title}
          </Typography>
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2 }}>
            {actions}
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: fullscreen ? 'auto' : 'visible',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
