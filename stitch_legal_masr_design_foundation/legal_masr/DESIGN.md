---
name: Legal Masr
description: Authoritative Arabic-first design system for a Windows desktop application
  helping individual Egyptian lawyers manage their practice.
colors:
  canvas: '#F8F5ED'
  surface: '#FFFFFF'
  surface-subtle: '#F7F8F6'
  surface-supporting: '#E7F1EE'
  surface-selected: '#D5E9E4'
  primary: '#00423C'
  primary-hover: '#085B53'
  primary-text: '#FFFFFF'
  text-primary: '#101E1D'
  text-secondary: '#5B6966'
  text-disabled: '#8D9794'
  border-default: '#D6DAD7'
  border-strong: '#B7C0BD'
  focus-ring: '#006D63'
  success: '#2E7D32'
  warning: '#B85C00'
  error: '#C62828'
  information: '#1565C0'
  overdue: '#A61B1B'
  completed: '#336B3D'
  surface-dim: '#d9dad9'
  surface-bright: '#f8faf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f2'
  surface-container: '#edeeec'
  surface-container-high: '#e7e8e7'
  surface-container-highest: '#e1e3e1'
  on-surface: '#191c1b'
  on-surface-variant: '#404947'
  inverse-surface: '#2e3130'
  inverse-on-surface: '#f0f1ef'
  outline: '#707977'
  outline-variant: '#bfc8c6'
  surface-tint: '#316760'
  on-primary: '#ffffff'
  primary-container: '#00423c'
  on-primary-container: '#78aea6'
  inverse-primary: '#9ad1c8'
  secondary: '#57605e'
  on-secondary: '#ffffff'
  secondary-container: '#d8e2df'
  on-secondary-container: '#5b6562'
  tertiary: '#3f1a09'
  on-tertiary: '#ffffff'
  tertiary-container: '#592f1c'
  on-tertiary-container: '#d2967d'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b5ede4'
  primary-fixed-dim: '#9ad1c8'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#154f49'
  secondary-fixed: '#dbe5e2'
  secondary-fixed-dim: '#bfc9c6'
  on-secondary-fixed: '#141d1c'
  on-secondary-fixed-variant: '#3f4947'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#f9b89d'
  on-tertiary-fixed: '#331103'
  on-tertiary-fixed-variant: '#683b27'
  background: '#f8faf8'
  on-background: '#191c1b'
  surface-variant: '#e1e3e1'
typography:
  font-family: IBM Plex Sans Arabic
  scale:
    display: 32px
    headline: 24px
    title: 20px
    body: 16px
    label: 14px
  display:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  caption:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
layout:
  sidebar-width: 260px
  top-bar-height: 72px
  grid: 4px / 8px
  radius: 4px
  shadows: subtle neutral
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  top-bar-height: 72px
  unit: 4px
  gutter: 16px
  margin: 24px
---

# Legal Masr Design Tokens

## Purpose
- **canvas**: Main application background color.
- **surface**: Primary background for working areas and cards.
- **surface-subtle**: Subtle background for sections or grouping.
- **surface-supporting**: Secondary surfaces like sidebar or inactive tabs.
- **surface-selected**: Background for active or selected list items.
- **primary**: Main brand teal for primary actions and key UI elements.
- **text-primary**: High-contrast text for headings and main content.
- **text-secondary**: Supporting text for metadata and secondary labels.
- **border-default**: Standard subtle border for cards and inputs.
- **focus-ring**: High-visibility outline for keyboard accessibility.
- **success/warning/error**: Semantic status colors for legal outcomes and system states.
- **overdue/completed**: Specific legal status colors for hearings and tasks.