import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }
export const ButtonGroup = ({ className, orientation = 'horizontal', ...props }: ButtonGroupProps) => <div className={cn('inline-flex items-center', orientation === 'vertical' ? 'flex-col' : 'flex-row', className)} {...props} />
export const ButtonGroupText = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => <span className={cn('px-2 text-sm', className)} {...props} />
