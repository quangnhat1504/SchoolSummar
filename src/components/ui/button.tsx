import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'link'; size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'default', ...props }, ref) => <button ref={ref} className={cn('inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50', variant === 'default' ? 'border-transparent bg-primary text-primary-foreground' : variant === 'outline' ? 'border-input bg-background hover:bg-accent' : variant === 'secondary' ? 'border-transparent bg-secondary' : variant === 'link' ? 'border-transparent text-primary underline-offset-4 hover:underline' : 'border-transparent hover:bg-accent', size === 'icon' ? 'size-9' : size === 'icon-sm' ? 'size-8' : size === 'sm' ? 'h-8 px-3' : size === 'lg' ? 'h-10 px-8' : 'h-9 px-4', className)} {...props} />)
Button.displayName = 'Button'
