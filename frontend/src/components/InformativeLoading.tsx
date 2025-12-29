import { useState, useEffect } from 'react';
import { Loader2, Database, Table, Link2, Layout } from 'lucide-react';

interface InformativeLoadingProps {
  message?: string;
  type?: 'schema' | 'analysis' | 'table' | 'general';
  estimatedTime?: number; // em segundos
}

interface LoadingStep {
  label: string;
  icon: React.ReactNode;
  duration: number; // porcentagem do tempo total
}

const loadingSteps: Record<string, LoadingStep[]> = {
  schema: [
    { label: 'Conectando ao banco de dados...', icon: <Database className="h-4 w-4" />, duration: 15 },
    { label: 'Extraindo tabelas e colunas...', icon: <Table className="h-4 w-4" />, duration: 30 },
    { label: 'Mapeando relacionamentos...', icon: <Link2 className="h-4 w-4" />, duration: 30 },
    { label: 'Aplicando layout visual...', icon: <Layout className="h-4 w-4" />, duration: 25 },
  ],
  analysis: [
    { label: 'Carregando schema do banco...', icon: <Database className="h-4 w-4" />, duration: 40 },
    { label: 'Analisando query SQL...', icon: <Table className="h-4 w-4" />, duration: 30 },
    { label: 'Identificando tabelas e relacionamentos...', icon: <Link2 className="h-4 w-4" />, duration: 30 },
  ],
  table: [
    { label: 'Carregando lista de tabelas...', icon: <Table className="h-4 w-4" />, duration: 50 },
    { label: 'Mapeando relacionamentos...', icon: <Link2 className="h-4 w-4" />, duration: 50 },
  ],
  general: [
    { label: 'Processando...', icon: <Loader2 className="h-4 w-4" />, duration: 100 },
  ],
};

export default function InformativeLoading({ 
  message, 
  type = 'general',
  estimatedTime 
}: InformativeLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(estimatedTime || 10);

  const steps = loadingSteps[type] || loadingSteps.general;
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed);

      // Calcular progresso baseado nas etapas
      let accumulatedTime = 0;
      let stepIndex = 0;
      let calculatedProgress = 0;
      
      for (let i = 0; i < steps.length; i++) {
        const stepDuration = (steps[i].duration / totalDuration) * estimatedSeconds;
        const stepEndTime = accumulatedTime + stepDuration;
        
        if (elapsed < stepEndTime) {
          stepIndex = i;
          const stepProgress = (elapsed - accumulatedTime) / stepDuration;
          const stepPercentage = (steps[i].duration / totalDuration) * 100;
          calculatedProgress = (accumulatedTime / estimatedSeconds) * 100 + stepProgress * stepPercentage;
          break;
        }
        
        accumulatedTime = stepEndTime;
        calculatedProgress = (accumulatedTime / estimatedSeconds) * 100;
      }

      if (stepIndex < steps.length) {
        setCurrentStep(stepIndex);
        setProgress(Math.min(99, calculatedProgress)); // Limitar a 99% até completar
      } else {
        setCurrentStep(steps.length - 1);
        setProgress(100);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [steps, totalDuration, estimatedSeconds]);

  const remainingTime = Math.max(0, estimatedSeconds - elapsedTime);
  const currentStepData = steps[currentStep] || steps[0];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-full max-w-md">
        {/* Spinner e Ícone da Etapa */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-primary-600 dark:text-primary-400">
                {currentStepData.icon}
              </div>
            </div>
          </div>
        </div>

        {/* Mensagem Principal */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {message || 'Carregando...'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentStepData.label}
          </p>
        </div>

        {/* Barra de Progresso */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Etapa {currentStep + 1} de {steps.length}
            </span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, progress)}%` }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Estimativa de Tempo */}
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>
            Tempo decorrido: {Math.floor(elapsedTime)}s
          </span>
          <span>
            {remainingTime > 0 ? (
              <>Estimativa: ~{Math.ceil(remainingTime)}s</>
            ) : (
              <span className="text-primary-600 dark:text-primary-400">Finalizando...</span>
            )}
          </span>
        </div>

        {/* Lista de Etapas */}
        <div className="mt-6 space-y-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                index < currentStep
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : index === currentStep
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className={`flex-shrink-0 ${
                index < currentStep
                  ? 'text-green-600 dark:text-green-400'
                  : index === currentStep
                  ? 'text-primary-600 dark:text-primary-400 animate-spin'
                  : 'text-gray-400 dark:text-gray-600'
              }`}>
                {index < currentStep ? (
                  <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-[10px]">✓</span>
                  </div>
                ) : (
                  step.icon
                )}
              </div>
              <span className="text-sm font-medium flex-1">{step.label}</span>
              {index === currentStep && (
                <div className="flex-shrink-0">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

