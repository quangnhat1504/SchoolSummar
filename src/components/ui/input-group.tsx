import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export const InputGroup = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div className={cn('relative flex w-full items-center rounded-md border bg-background', className)} {...props} />
export const InputGroupAddon = ({ className, align: _align, ...props }: HTMLAttributes<HTMLDivElement> & { align?: string }) => <div className={cn('flex items-center px-2 text-muted-foreground', className)} {...props} />
export const InputGroupTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn('min-h-14 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none', className)} {...props} />)
export const InputGroupButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string }>(({ className, ...props }, ref) => <button ref={ref} className={cn('inline-flex items-center justify-center rounded-md p-2 text-sm hover:bg-accent disabled:opacity-50', className)} {...props} />)
