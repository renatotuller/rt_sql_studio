import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Help as HelpIcon,
  Visibility as VisibilityIcon,
  List as ListIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { mode, toggleColorMode } = useThemeMode();
  // Ocultar barra lateral no Query Builder
  const isQueryBuilder = location.pathname.includes('/query-builder');
  const isSchemaPage = location.pathname.includes('/schema/');
  const connId = location.pathname.match(/\/schema\/([^\/]+)/)?.[1];
  
  // Determinar a view atual para o ViewSwitcher
  const getCurrentView = (): 'standard' | 'advanced' | 'analyzer' | 'table' | 'query-builder' | 'ai-query' => {
    if (location.pathname.includes('/query-builder')) return 'query-builder';
    if (location.pathname.includes('/ai-query')) return 'ai-query';
    if (location.pathname.includes('/table')) return 'table';
    if (location.pathname.includes('/analyzer')) return 'analyzer';
    if (location.pathname.includes('/advanced')) return 'advanced';
    return 'standard';
  };
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setViewMenuAnchor(event.currentTarget);
  };

  const handleViewMenuClose = () => {
    setViewMenuAnchor(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
    handleMenuClose();
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.12)}`,
        }}
      >
        <Toolbar>
          <Box
            component="img"
            src="/logo.png"
            alt="RT SQL Studio"
            sx={{ height: 32, mr: 2 }}
          />
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600, mr: 3 }}>
            RT SQL Studio
          </Typography>
          
          {/* Menus de navegação principais */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              component={Link}
              to="/"
              startIcon={<DashboardIcon />}
              sx={{
                color: location.pathname === '/' ? theme.palette.primary.main : theme.palette.text.secondary,
                textTransform: 'none',
                fontWeight: location.pathname === '/' ? 600 : 400,
                fontSize: '0.875rem',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              Dashboard
            </Button>
            <Button
              component={Link}
              to="/connections"
              startIcon={<StorageIcon />}
              sx={{
                color: location.pathname === '/connections' ? theme.palette.primary.main : theme.palette.text.secondary,
                textTransform: 'none',
                fontWeight: location.pathname === '/connections' ? 600 : 400,
                fontSize: '0.875rem',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              Conexões
            </Button>
            <Button
              component={Link}
              to="/settings"
              startIcon={<SettingsIcon />}
              sx={{
                color: location.pathname === '/settings' ? theme.palette.primary.main : theme.palette.text.secondary,
                textTransform: 'none',
                fontWeight: location.pathname === '/settings' ? 600 : 400,
                fontSize: '0.875rem',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              Configurações
            </Button>
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Menu de views - sempre visível */}
          <Tooltip title="Opções de visualização">
            <IconButton
              onClick={handleViewMenuOpen}
              sx={{
                color: 'text.secondary',
                mr: 1,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={viewMenuAnchor}
            open={Boolean(viewMenuAnchor)}
            onClose={handleViewMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {isSchemaPage && connId ? (
              <>
                <MenuItem
                  onClick={() => {
                    navigate(`/schema/${connId}`);
                    handleViewMenuClose();
                  }}
                  selected={getCurrentView() === 'standard'}
                >
                  <ListItemIcon>
                    <StorageIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Padrão</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    navigate(`/schema/${connId}/advanced`);
                    handleViewMenuClose();
                  }}
                  selected={getCurrentView() === 'advanced'}
                >
                  <ListItemIcon>
                    <StorageIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Avançada</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    navigate(`/schema/${connId}/analyzer`);
                    handleViewMenuClose();
                  }}
                  selected={getCurrentView() === 'analyzer'}
                >
                  <ListItemIcon>
                    <StorageIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Analisador</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    navigate(`/schema/${connId}/table`);
                    handleViewMenuClose();
                  }}
                  selected={getCurrentView() === 'table'}
                >
                  <ListItemIcon>
                    <ListIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Tabela</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    navigate(`/schema/${connId}/query-builder`);
                    handleViewMenuClose();
                  }}
                  selected={getCurrentView() === 'query-builder'}
                >
                  <ListItemIcon>
                    <BuildIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Query Builder</ListItemText>
                </MenuItem>
              </>
            ) : (
              <MenuItem disabled>
                <ListItemText>
                  <Typography variant="body2" color="text.secondary">
                    Selecione uma conexão para ver as opções de visualização
                  </Typography>
                </ListItemText>
              </MenuItem>
            )}
          </Menu>
          
          <Tooltip title={mode === 'dark' ? 'Modo Claro' : 'Modo Escuro'}>
            <IconButton color="inherit" onClick={toggleColorMode} sx={{ mr: 1 }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Ajuda / Wiki">
            <IconButton
              component={Link}
              to="/wiki"
              color="inherit"
              sx={{
                mr: 1,
                color: location.pathname === '/wiki' ? theme.palette.primary.main : theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Menu do usuário">
            <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 36,
                  height: 36,
                  fontSize: '0.9rem',
                }}
              >
                {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {currentUser?.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          backgroundColor: theme.palette.mode === 'dark' ? '#121212' : '#f5f5f5',
          height: 'calc(100vh - 64px - 20px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '64px',
          marginBottom: '20px',
        }}
      >
        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </Box>
      {/* Footer fixo na parte inferior */}
      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 20,
          backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
          borderTop: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: theme.zIndex.drawer,
          boxShadow: `0 -1px 3px ${alpha(theme.palette.common.black, 0.12)}`,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.65rem',
            fontWeight: 400,
          }}
        >
          RT SQL Studio - {new Date().getFullYear()} - Renato Tuller - www.renatotuller.com.br
        </Typography>
      </Box>
    </Box>
  );
}
