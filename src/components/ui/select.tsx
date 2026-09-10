import * as SelectPrimitive from '@radix-ui/react-select'
import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { cn } from '../../lib/utils'
export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value
export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, ...props }, ref) => <SelectPrimitive.Trigger ref={ref} className={cn('flex h-9 items-center justify-between rounded-md border bg-background px-3 text-sm', className)} {...props} />)
export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, ...props }, ref) => <SelectPrimitive.Portal><SelectPrimitive.Content ref={ref} className={cn('z-50 min-w-32 rounded-md border bg-popover p-1 shadow-md', className)} {...props} /></SelectPrimitive.Portal>)
export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, ...props }, ref) => <SelectPrimitive.Item ref={ref} className={cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent', className)} {...props} />)
