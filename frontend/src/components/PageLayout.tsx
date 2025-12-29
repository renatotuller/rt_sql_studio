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
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {backUrl && (
            <IconButton
              onClick={() => navigate(backUrl)}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.main,
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            {title}
          </Typography>
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
          overflow: fullscreen ? 'hidden' : 'visible',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
