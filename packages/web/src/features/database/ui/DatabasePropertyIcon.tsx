import {
    AlignLeft,
    Hash,
    Users,
    CalendarDays,
    CircleDot,
    CheckSquare,
    Link2,
    List,
    FunctionSquare,
    Mail,
    Phone,
    Clock,
    Tag,
} from 'lucide-react';
import type { PropertyType } from '../model/types';
export function DatabasePropertyIcon({ type }: { type: PropertyType }) {
    const Icon =
        type === 'person' || type.endsWith('_by')
            ? Users
            : type === 'number' || type === 'unique_id'
              ? Hash
              : type === 'date'
                ? CalendarDays
                : type.endsWith('_time')
                  ? Clock
                  : type === 'status'
                    ? CircleDot
                    : type === 'checkbox'
                      ? CheckSquare
                      : type === 'relation' || type === 'url'
                        ? Link2
                        : type === 'rollup' || type === 'formula'
                          ? FunctionSquare
                          : type === 'email'
                            ? Mail
                            : type === 'phone'
                              ? Phone
                              : type === 'multi_select'
                                ? List
                                : type === 'select'
                                  ? Tag
                                  : AlignLeft;
    return <Icon size={14} aria-hidden="true" className="shrink-0 text-text-tertiary" />;
}
