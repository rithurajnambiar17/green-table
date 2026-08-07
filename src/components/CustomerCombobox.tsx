import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useApp } from "@/lib/store"
import { Customer } from "@/lib/types"

interface Props {
  value: string;
  onChange: (name: string, phone: string) => void;
  placeholder?: string;
  id?: string;
}

export function CustomerCombobox({ value, onChange, placeholder = "Select or enter name...", id }: Props) {
  const { customers } = useApp()
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)

  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleSelect = (customer: Customer) => {
    onChange(customer.name, customer.phone)
    setInputValue(customer.name)
    setOpen(false)
  }

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    onChange(val, "") // we only update name, phone remains what it was or gets cleared
  }

  // We want to allow free text input too, but Shadcn Combobox wraps a button.
  // The user asked "while entring the name in walkin or in the table the customer name should be visible in the dropdown below".
  // This implies the input behaves like a normal input, but shows a dropdown.
  // Standard Combobox pattern:
  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {inputValue || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search customers..." 
              value={inputValue}
              onValueChange={(val) => {
                setInputValue(val)
                onChange(val, "") // Update name directly while typing if custom
              }}
            />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup>
                {customers.map((customer) => (
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
    </div>
  )
}
