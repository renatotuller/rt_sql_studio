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
          px: 2, 
          py: 0.5, 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {backUrl && (
            <IconButton
              onClick={() => navigate(backUrl)}
              size="small"
              sx={{
                p: 0.5,
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
