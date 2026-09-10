import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { cn } from '../../lib/utils'
export const HoverCard = HoverCardPrimitive.Root
export const HoverCardTrigger = HoverCardPrimitive.Trigger
export const HoverCardContent = forwardRef<ElementRef<typeof HoverCardPrimitive.Content>, ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => <HoverCardPrimitive.Portal><HoverCardPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} className={cn('z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md', className)} {...props} /></HoverCardPrimitive.Portal>)
