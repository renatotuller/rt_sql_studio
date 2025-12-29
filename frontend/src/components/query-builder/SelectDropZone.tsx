/**
 * Componente de zona de drop para a área SELECT
 * Permite soltar colunas arrastadas do catálogo
 */

import { useDroppable } from '@dnd-kit/core';
import { useMemo } from 'react';

interface SelectDropZoneProps {
  id: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}

export default function SelectDropZone({ id, children, isEmpty = false }: SelectDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'select-zone',
    },
  });

  const className = useMemo(() => {
    const base = 'h-full flex flex-col bg-white dark:bg-gray-900 transition-colors';
    if (isOver) {
      return `${base} bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-500 border-dashed`;
    }
    return base;
  }, [isOver]);

  return (
    <div ref={setNodeRef} className={className}>
      {children}
      {isOver && isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
            Solte aqui para adicionar ao SELECT
          </div>
        </div>
      )}
    </div>
  );
}

