/** @fakt/ui — Bibliothèque React 19 Brutal Invoice. */

// Primitives
export { Button } from "./primitives/Button.js";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./primitives/Button.js";
export { Input, Textarea } from "./primitives/Input.js";
export type { InputProps, TextareaProps } from "./primitives/Input.js";
export { Select } from "./primitives/Select.js";
export type { SelectOption, SelectProps } from "./primitives/Select.js";
export { Checkbox } from "./primitives/Checkbox.js";
export type { CheckboxProps } from "./primitives/Checkbox.js";
export { Radio, RadioGroup } from "./primitives/Radio.js";
export type { RadioGroupProps, RadioProps } from "./primitives/Radio.js";
export { Tabs, getTabPanelId } from "./primitives/Tabs.js";
export type { TabItem, TabsProps } from "./primitives/Tabs.js";
export { SegmentedControl } from "./primitives/SegmentedControl.js";
export type {
  SegmentedControlOption,
  SegmentedControlProps,
} from "./primitives/SegmentedControl.js";
export { Autocomplete } from "./primitives/Autocomplete.js";
export type { AutocompleteOption, AutocompleteProps } from "./primitives/Autocomplete.js";

// Layout
export { Card } from "./layout/Card.js";
export type { CardProps, CardShadow } from "./layout/Card.js";
export { Sidebar } from "./layout/Sidebar.js";
export type { SidebarItem, SidebarProps } from "./layout/Sidebar.js";
export { Topbar } from "./layout/Topbar.js";
export type { TopbarProps } from "./layout/Topbar.js";
export { Shell } from "./layout/Shell.js";
export type { ShellProps } from "./layout/Shell.js";

// Overlays
export { Overlay } from "./overlays/Overlay.js";
export type { OverlayProps } from "./overlays/Overlay.js";
export { Modal } from "./overlays/Modal.js";
export type { ModalProps } from "./overlays/Modal.js";
export { CommandPalette } from "./overlays/CommandPalette.js";
export type { CommandItem, CommandPaletteProps } from "./overlays/CommandPalette.js";

// Data display
export { Table } from "./data-display/Table.js";
export type { TableColumn, TableProps } from "./data-display/Table.js";
export { StatusPill } from "./data-display/StatusPill.js";
export type { StatusKind, StatusPillProps } from "./data-display/StatusPill.js";
export { Chip } from "./data-display/Chip.js";
export type { ChipProps } from "./data-display/Chip.js";
export { Avatar } from "./data-display/Avatar.js";
export type { AvatarProps } from "./data-display/Avatar.js";
export { Sparkline } from "./data-display/Sparkline.js";
export type { SparklineProps } from "./data-display/Sparkline.js";
export { Breadcrumb } from "./data-display/Breadcrumb.js";
export type { BreadcrumbItem, BreadcrumbProps } from "./data-display/Breadcrumb.js";

// Feedback
export { Toaster, toast } from "./feedback/Toast.js";
export type { ToasterProps } from "./feedback/Toast.js";

// Specialized
export { Canvas } from "./specialized/Canvas.js";
export type { CanvasHandle, CanvasProps } from "./specialized/Canvas.js";

// Utils
export { classNames } from "./utils/classNames.js";
