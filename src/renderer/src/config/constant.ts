export const DEFAULT_TEMPERATURE = 0.7
export const DEFAULT_CONEXTCOUNT = 5
export const DEFAULT_MAX_TOKENS = 4096
export const FONT_FAMILY =
  "Ubuntu, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
export const platform = window.electron?.process?.platform === 'darwin' ? 'macos' : 'windows'
export const isMac = platform === 'macos'
export const isWindows = platform === 'windows'
