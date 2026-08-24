import {
  IconArchive,
  IconArrowLeft,
  IconBriefcase2,
  IconCalendarEvent,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCirclePlus,
  IconClock,
  IconCoins,
  IconDatabaseExport,
  IconDotsVertical,
  IconFileDescription,
  IconFolder,
  IconGavel,
  IconHome,
  IconLock,
  IconMenu2,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconSquareCheck,
  IconUsers,
  IconX,
  type TablerIcon,
} from '@tabler/icons-react';

export type IconName =
  | 'home'
  | 'clients'
  | 'poa'
  | 'cases'
  | 'calendar'
  | 'tasks'
  | 'documents'
  | 'finances'
  | 'backup'
  | 'settings'
  | 'lock'
  | 'search'
  | 'menu'
  | 'close'
  | 'plus'
  | 'circle-plus'
  | 'clock'
  | 'check'
  | 'archive'
  | 'receipt'
  | 'folder'
  | 'more'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-left'
  | 'shield';

const icons: Record<IconName, TablerIcon> = {
  home: IconHome,
  clients: IconUsers,
  poa: IconBriefcase2,
  cases: IconGavel,
  calendar: IconCalendarEvent,
  tasks: IconSquareCheck,
  documents: IconFileDescription,
  finances: IconCoins,
  backup: IconDatabaseExport,
  settings: IconSettings,
  lock: IconLock,
  search: IconSearch,
  menu: IconMenu2,
  close: IconX,
  plus: IconPlus,
  'circle-plus': IconCirclePlus,
  clock: IconClock,
  check: IconCheck,
  archive: IconArchive,
  receipt: IconReceipt2,
  folder: IconFolder,
  more: IconDotsVertical,
  'chevron-down': IconChevronDown,
  'chevron-left': IconChevronLeft,
  'chevron-right': IconChevronRight,
  'arrow-left': IconArrowLeft,
  shield: IconShieldLock,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Component = icons[name] ?? IconBriefcase2;
  return <Component aria-hidden="true" className="icon" size={size} stroke={1.75} />;
}
