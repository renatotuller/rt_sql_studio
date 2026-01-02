/**
 * Botões para abrir os editores de cláusulas SQL (WHERE, GROUP BY, ORDER BY, etc.)
 */

import { Box, Button, Chip, IconButton, useTheme, alpha } from '@mui/material';
import { 
  Filter as FilterIcon, 
  Layers as LayersIcon, 
  SwapVert as SwapVertIcon, 
  Link as LinkIcon, 
  Settings as SettingsIcon 
} from '@mui/icons-material';

interface QueryClauseButtonsProps {
  whereCount: number;
  groupByCount: number;
  orderByCount: number;
  joinsCount: number;
  onOpenWhere: () => void;
  onOpenGroupBy: () => void;
  onOpenOrderBy: () => void;
  onOpenJoins: () => void;
  onOpenSettings?: () => void;
}

export default function QueryClauseButtons({
  whereCount,
  groupByCount,
  orderByCount,
  joinsCount,
  onOpenWhere,
  onOpenGroupBy,
  onOpenOrderBy,
  onOpenJoins,
  onOpenSettings,
}: QueryClauseButtonsProps) {
  const theme = useTheme();
  
  const buttons = [
    {
      icon: LinkIcon,
      label: 'JOIN',
      count: joinsCount,
      onClick: onOpenJoins,
      color: 'purple' as const,
    },
    {
      icon: FilterIcon,
      label: 'WHERE',
      count: whereCount,
      onClick: onOpenWhere,
      color: 'blue' as const,
    },
    {
      icon: LayersIcon,
      label: 'GROUP BY',
      count: groupByCount,
      onClick: onOpenGroupBy,
      color: 'green' as const,
    },
    {
      icon: SwapVertIcon,
      label: 'ORDER BY',
      count: orderByCount,
      onClick: onOpenOrderBy,
      color: 'amber' as const,
    },
  ];

  const getColorStyles = (color: 'purple' | 'blue' | 'green' | 'amber', hasItems: boolean) => {
    const colorMap = {
      purple: {
        bg: hasItems ? alpha(theme.palette.secondary.main, 0.1) : theme.palette.action.hover,
        text: hasItems ? theme.palette.secondary.main : theme.palette.text.secondary,
        badge: theme.palette.secondary.main,
      },
      blue: {
        bg: hasItems ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
        text: hasItems ? theme.palette.primary.main : theme.palette.text.secondary,
        badge: theme.palette.primary.main,
      },
      green: {
        bg: hasItems ? alpha(theme.palette.success.main, 0.1) : theme.palette.action.hover,
        text: hasItems ? theme.palette.success.main : theme.palette.text.secondary,
        badge: theme.palette.success.main,
      },
      amber: {
        bg: hasItems ? alpha(theme.palette.warning.main, 0.1) : theme.palette.action.hover,
        text: hasItems ? theme.palette.warning.main : theme.palette.text.secondary,
        badge: theme.palette.warning.main,
      },
    };
    return colorMap[color];
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {buttons.map(({ icon: Icon, label, count, onClick, color }) => {
        const hasItems = count > 0;
        const colors = getColorStyles(color, hasItems);
        
        return (
          <Button
            key={label}
            onClick={onClick}
            startIcon={<Icon sx={{ fontSize: 16 }} />}
            endIcon={hasItems ? (
              <Chip
                label={count}
                size="small"
                sx={{
                  height: 18,
                  minWidth: 18,
                  fontSize: '0.65rem',
                  bgcolor: colors.badge,
                  color: 'white',
                  '& .MuiChip-label': {
                    px: 0.75,
                  },
                }}
              />
            ) : undefined}
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              fontSize: '0.8125rem',
              fontWeight: 500,
              textTransform: 'none',
              bgcolor: colors.bg,
              color: colors.text,
              '&:hover': {
                bgcolor: alpha(colors.badge, 0.15),
              },
            }}
          >
            {label}
          </Button>
        );
      })}
      
      {onOpenSettings && (
        <IconButton
          onClick={onOpenSettings}
          size="small"
          sx={{
            p: 1,
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              bgcolor: 'action.hover',
            },
          }}
          title="Configurações"
        >
          <SettingsIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
}
