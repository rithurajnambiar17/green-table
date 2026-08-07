import * as React from "react"
import { useApp } from "@/lib/store"
import { Customer } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"

interface Props {
  value: string;
  onChange: (name: string, phone: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function CustomerAutocomplete({ value, onChange, placeholder = "Customer name (optional)", id, className }: Props) {
  const { customers } = useApp()
  const [open, setOpen] = React.useState(false)

  // We filter locally instead of using CommandInput's built in, so we can use standard Input
  const searchLower = value.toLowerCase()
  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchLower) || c.phone.includes(searchLower)
  )

  const handleSelect = (customer: Customer) => {
    onChange(customer.name, customer.phone)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value, "") // Reset phone when they type a custom name
              setOpen(true)
            }}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            className={className}
          />
        </div>
      </PopoverTrigger>
      
      {/* 
        We use PopoverContent with same width as trigger.
        We conditionally render contents so we don't show empty popover if they haven't typed yet,
        or we just show the recent customers.
      */}
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()} // prevent popover from stealing focus from input
      >
        <Command>
          <CommandList>
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.name} ${customer.phone}`}
                  onSelect={() => handleSelect(customer)}
                >
                  <div className="flex flex-col">
                    <span>{customer.name}</span>
                    <span className="text-xs text-muted-foreground">{customer.phone}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
