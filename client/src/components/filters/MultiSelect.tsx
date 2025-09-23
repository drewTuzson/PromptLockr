import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Collapsible from '@radix-ui/react-collapsible';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...'
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectedLabels = options
    .filter(opt => selectedValues.includes(opt.value))
    .map(opt => opt.label)
    .join(', ');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger asChild>
          <button
            data-testid={`button-multiselect-${label.toLowerCase().replace(' ', '-')}`}
            className="flex items-center justify-between px-3 py-2 text-sm border rounded-lg 
                     hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                     border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          >
            <span className={selectedValues.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
              {selectedValues.length > 0 
                ? `${selectedValues.length} selected`
                : placeholder}
            </span>
            <ChevronDownIcon 
              className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="mt-1 p-2 border rounded-lg bg-white dark:bg-gray-900 
                                      border-gray-300 dark:border-gray-600 max-h-60 overflow-auto">
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 p-2 rounded cursor-pointer 
                         hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Checkbox.Root
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={() => handleToggle(option.value)}
                  data-testid={`checkbox-option-${option.value}`}
                  className="flex h-4 w-4 items-center justify-center rounded border 
                           border-gray-300 dark:border-gray-600 data-[state=checked]:bg-blue-600 
                           data-[state=checked]:border-blue-600"
                >
                  <Checkbox.Indicator>
                    <CheckIcon className="h-3 w-3 text-white" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="flex-1 text-sm">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-gray-500">({option.count})</span>
                )}
              </label>
            ))}
          </div>
          
          {selectedValues.length > 0 && (
            <button
              onClick={() => onChange([])}
              data-testid="button-clear-all"
              className="mt-2 w-full px-2 py-1 text-xs text-gray-600 hover:text-gray-900 
                       dark:text-gray-400 dark:hover:text-white"
            >
              Clear all
            </button>
          )}
        </Collapsible.Content>
      </Collapsible.Root>

      {selectedValues.length > 0 && !isOpen && (
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {selectedLabels}
        </div>
      )}
    </div>
  );
}