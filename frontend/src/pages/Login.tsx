import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
  alpha,
  Fade,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { uiApi } from '../api/client';
import logoImage from '/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('/background.png');
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.4);
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    // Carregar configuração de background
    const loadBackground = async () => {
      try {
        const response = await uiApi.getConfig();
        if (response.data.loginBackground) {
          // Se for um arquivo customizado, usar a rota de uploads
          if (response.data.loginBackground.startsWith('background-')) {
            setBackgroundImage(`/api/ui/uploads/${response.data.loginBackground}`);
          } else {
            setBackgroundImage(`/${response.data.loginBackground}`);
          }
        }
        if (response.data.loginBackgroundOpacity !== undefined) {
          setBackgroundOpacity(response.data.loginBackgroundOpacity);
        }
      } catch (error) {
        console.error('Erro ao carregar configuração de background:', error);
      }
    };
    
    loadBackground();
    // Animação de fade-in ao carregar
    setFadeIn(true);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupClick = () => {
    setContactDialogOpen(true);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        p: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: backgroundOpacity,
          zIndex: 0,
          animation: fadeIn ? 'fadeInBackground 1.5s ease-in-out' : 'none',
        },
        '@keyframes fadeInBackground': {
          '0%': {
            opacity: 0,
          },
          '100%': {
            opacity: backgroundOpacity,
          },
        },
      }}
    >
      <Fade in={fadeIn} timeout={800}>
        <Card
          sx={{
            maxWidth: 450,
            width: '100%',
            borderRadius: 3,
            position: 'relative',
            zIndex: 1,
            backgroundColor: '#FFFFFF', // Fundo branco igual à logo
            backdropFilter: 'blur(10px)',
            boxShadow: theme.shadows[10],
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                component="img"
                src={logoImage}
                alt="RT SQL Studio"
                sx={{
                  height: { xs: 240, sm: 300 },
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  mx: 'auto',
                  display: 'block',
                  mb: 0.5,
                }}
              />
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mt: 0.5,
                  lineHeight: 1.2,
                }}
              >
                Faça login para continuar
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                autoComplete="email"
                InputProps={{
                  startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <TextField
                fullWidth
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                autoComplete="current-password"
                InputProps={{
                  startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  mt: 3,
                  mb: 2,
                  textTransform: 'none',
                  py: 1.5,
                }}
              >
                {loading ? 'Carregando...' : 'Entrar'}
              </Button>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                onClick={handleSignupClick}
                sx={{
                  textTransform: 'none',
                  color: theme.palette.primary.main,
                }}
              >
                Não tem uma conta? Cadastre-se
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Fade>

      <Dialog
        open={contactDialogOpen}
        onClose={() => setContactDialogOpen(false)}
        aria-labelledby="contact-dialog-title"
        aria-describedby="contact-dialog-description"
      >
        <DialogTitle id="contact-dialog-title">
          Solicitar Acesso
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="contact-dialog-description">
            Para criar uma conta, entre em contato com o administrador do sistema.
            Ele poderá criar sua conta e fornecer as credenciais de acesso.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)} color="primary">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

