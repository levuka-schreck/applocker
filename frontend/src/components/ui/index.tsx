'use client';

import { ReactNode, forwardRef, InputHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Card Component
interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export const Card = ({ children, className, hover = false, glow = false }: CardProps) => (
  <div
    className={cn(
      'glass-card p-6',
      hover && 'hover:border-appex-500/30 hover:shadow-glow-sm transition-all duration-300',
      glow && 'animate-pulse-glow',
      className
    )}
  >
    {children}
  </div>
);

// Button Component
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    isLoading, 
    leftIcon, 
    rightIcon, 
    className, 
    disabled,
    ...props 
  }, ref) => {
    const variants = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'px-6 py-3 bg-error/20 border border-error/30 text-error font-medium rounded-xl hover:bg-error/30 transition-all',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3',
      lg: 'px-8 py-4 text-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(variants[variant], sizes[size], 'flex items-center justify-center gap-2', className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

// Input Component
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftElement, rightElement, className, ...props }, ref) => (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-surface-200">{label}</label>
      )}
      <div className="relative">
        {leftElement && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
            {leftElement}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'input-base',
            leftElement ? 'pl-12' : '',
            rightElement ? 'pr-12' : '',
            error ? 'border-error/50 focus:border-error focus:ring-error/30' : '',
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      {hint && !error && <p className="text-sm text-surface-400">{hint}</p>}
    </div>
  )
);
Input.displayName = 'Input';

// Badge Component
interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  className?: string;
}

export const Badge = ({ children, variant = 'default', className }: BadgeProps) => {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    default: 'bg-surface-700 text-surface-200',
  };

  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  );
};

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                'glass-card p-6 w-full pointer-events-auto',
                'max-h-[90vh] overflow-y-auto',
                sizes[size]
              )}
            >
              <div className="flex items-center justify-between mb-4">
                {title && <h3 className="text-xl font-semibold">{title}</h3>}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-surface-700/50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// Toast Component
interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: (id: string) => void;
}

export const Toast = ({ id, type, title, message, onClose }: ToastProps) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-error" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning" />,
    info: <Info className="w-5 h-5 text-vault" />,
  };

  const colors = {
    success: 'border-l-success',
    error: 'border-l-error',
    warning: 'border-l-warning',
    info: 'border-l-vault',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className={cn(
        'glass-card p-4 flex gap-3 border-l-4 min-w-[300px] max-w-[400px]',
        colors[type]
      )}
    >
      {icons[type]}
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-surface-400">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-surface-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// Skeleton Component
export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'animate-pulse bg-surface-700/50 rounded-lg',
      className
    )}
  />
);

// Progress Bar Component
interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  color?: 'appex' | 'vault' | 'staking' | 'governance';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar = ({ 
  value, 
  max = 100, 
  variant = 'default',
  color,
  showLabel = false,
  className 
}: ProgressBarProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const variants = {
    default: 'bg-gradient-to-r from-appex-500 to-appex-400',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-error',
  };
  
  const colors = {
    appex: 'bg-appex-500',
    vault: 'bg-vault',
    staking: 'bg-staking',
    governance: 'bg-governance',
  };
  
  const barColor = color ? colors[color] : variants[variant];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-surface-400">
          <span>{value.toFixed(1)}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
};

// Tabs Component
interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, activeTab, onChange, className }: TabsProps) => (
  <div className={cn('flex gap-1 p-1 bg-surface-800/50 rounded-xl', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
          activeTab === tab.id
            ? 'bg-appex-500/20 text-appex-400'
            : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
        )}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
);

// Stat Display Component
interface StatDisplayProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

export const StatDisplay = ({ 
  label, 
  value, 
  subValue, 
  icon, 
  trend, 
  className 
}: StatDisplayProps) => (
  <Card className={cn('stat-card', className)} hover>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-surface-400">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subValue && <p className="text-sm text-surface-500">{subValue}</p>}
        {trend && (
          <p className={cn(
            'text-sm font-medium',
            trend.isPositive ? 'text-success' : 'text-error'
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </p>
        )}
      </div>
      {icon && (
        <div className="p-3 rounded-xl bg-surface-700/50">
          {icon}
        </div>
      )}
    </div>
  </Card>
);

// Empty State Component
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {icon && (
      <div className="p-4 rounded-2xl bg-surface-800/50 mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-surface-400 mb-4 max-w-sm">{description}</p>
    {action}
  </div>
);

// Tooltip Component
interface TooltipProps {
  children: ReactNode;
  content: string;
}

export const Tooltip = ({ children, content }: TooltipProps) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-700 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-700" />
    </div>
  </div>
);

// Divider Component
export const Divider = ({ className }: { className?: string }) => (
  <div className={cn('h-px bg-surface-700', className)} />
);

// Avatar Component
interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar = ({ src, name, size = 'md', className }: AvatarProps) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br from-appex-500 to-vault flex items-center justify-center font-semibold text-white',
      sizes[size],
      className
    )}>
      {src ? (
        <img src={src} alt={name || 'Avatar'} className="w-full h-full rounded-full object-cover" />
      ) : (
        name?.charAt(0).toUpperCase() || '?'
      )}
    </div>
  );
};
