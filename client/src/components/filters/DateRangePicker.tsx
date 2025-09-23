import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface DateRangePickerProps {
  label: string;
  startDate?: Date;
  endDate?: Date;
  onDateChange: (start?: Date, end?: Date) => void;
  placeholder?: string;
}

export function DateRangePicker({
  label,
  startDate,
  endDate,
  onDateChange,
  placeholder = 'Select dates...'
}: DateRangePickerProps) {
  const [localStart, setLocalStart] = React.useState(startDate?.toISOString().split('T')[0] || '');
  const [localEnd, setLocalEnd] = React.useState(endDate?.toISOString().split('T')[0] || '');

  const handleApply = () => {
    const start = localStart ? new Date(localStart) : undefined;
    const end = localEnd ? new Date(localEnd) : undefined;
    onDateChange(start, end);
  };

  const handleClear = () => {
    setLocalStart('');
    setLocalEnd('');
    onDateChange(undefined, undefined);
  };

  const displayValue = React.useMemo(() => {
    if (startDate && endDate) {
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    if (startDate) return `From ${format(startDate, 'MMM d, yyyy')}`;
    if (endDate) return `Until ${format(endDate, 'MMM d, yyyy')}`;
    return placeholder;
  }, [startDate, endDate, placeholder]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            data-testid={`button-date-range-${label.toLowerCase().replace(' ', '-')}`}
            className="flex items-center justify-between px-3 py-2 text-sm border rounded-lg 
                     hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                     border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          >
            <span className={startDate || endDate ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
              {displayValue}
            </span>
            <CalendarIcon className="w-4 h-4 ml-2 text-gray-400" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-50 p-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg border 
                     border-gray-200 dark:border-gray-700 w-80"
            sideOffset={5}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  data-testid="input-start-date"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 
                           border-gray-300 dark:border-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  data-testid="input-end-date"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  min={localStart}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 
                           border-gray-300 dark:border-gray-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleClear}
                  data-testid="button-clear-dates"
                  className="flex-1 px-3 py-2 text-sm border rounded-md hover:bg-gray-50 
                           dark:hover:bg-gray-800 transition-colors"
                >
                  Clear
                </button>
                <Popover.Close asChild>
                  <button
                    onClick={handleApply}
                    data-testid="button-apply-dates"
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md 
                             hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                </Popover.Close>
              </div>
            </div>
            <Popover.Arrow className="fill-white dark:fill-gray-900" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}