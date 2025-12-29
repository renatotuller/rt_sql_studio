/**
 * Botões para abrir os editores de cláusulas SQL (WHERE, GROUP BY, ORDER BY, etc.)
 */

import { Filter, Layers, ArrowUpDown, Hash, Link, Settings2 } from 'lucide-react';

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
  const buttons = [
    {
      icon: Link,
      label: 'JOIN',
      count: joinsCount,
      onClick: onOpenJoins,
      color: 'purple',
    },
    {
      icon: Filter,
      label: 'WHERE',
      count: whereCount,
      onClick: onOpenWhere,
      color: 'blue',
    },
    {
      icon: Layers,
      label: 'GROUP BY',
      count: groupByCount,
      onClick: onOpenGroupBy,
      color: 'green',
    },
    {
      icon: ArrowUpDown,
      label: 'ORDER BY',
      count: orderByCount,
      onClick: onOpenOrderBy,
      color: 'amber',
    },
  ];

  const getColorClasses = (color: string, hasItems: boolean) => {
    const colors: Record<string, { bg: string; text: string; hover: string; badge: string }> = {
      purple: {
        bg: hasItems ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-800',
        text: hasItems ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400',
        hover: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
        badge: 'bg-purple-600 text-white',
      },
      blue: {
        bg: hasItems ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800',
        text: hasItems ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400',
        hover: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
        badge: 'bg-blue-600 text-white',
      },
      green: {
        bg: hasItems ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800',
        text: hasItems ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400',
        hover: 'hover:bg-green-200 dark:hover:bg-green-900/50',
        badge: 'bg-green-600 text-white',
      },
      amber: {
        bg: hasItems ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-800',
        text: hasItems ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-400',
        hover: 'hover:bg-amber-200 dark:hover:bg-amber-900/50',
        badge: 'bg-amber-600 text-white',
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {buttons.map(({ icon: Icon, label, count, onClick, color }) => {
        const hasItems = count > 0;
        const colors = getColorClasses(color, hasItems);
        
        return (
          <button
            key={label}
            onClick={onClick}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-sm font-medium transition-colors
              ${colors.bg} ${colors.text} ${colors.hover}
            `}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {hasItems && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${colors.badge}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 
                   dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Configurações"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
