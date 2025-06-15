/**
 * Read an environment variable and provide a default value if it is not set.
 *
 * @param {string} name - Name of the variable to read.
 * @param {string} [defaultValue=''] - Value returned when the variable is undefined.
 * @returns {string} The value of the environment variable or the default.
 */
function getEnvVar(name, defaultValue = '') {
  return process.env[name] || defaultValue
}

/**
 * Read a boolean environment variable.
 *
 * The variable is considered `true` when it exists and equals `"true"`
 * case-insensitively.
 *
 * @param {string} name - Name of the variable to read.
 * @param {boolean} [defaultValue=false] - Value returned when variable is undefined.
 * @returns {boolean} Parsed boolean value.
 */
function getEnvBool(name, defaultValue = false) {
  const value = process.env[name]
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true'
}

/**
 * Global configuration object derived from environment variables.
 *
 * It defines page layout constants, default file paths and URLs as well
 * as break-detection parameters used throughout the processing pipeline.
 */
export const CONFIG = {
  // Environment variables
  DEBUG: getEnvBool('DEBUG', false),
  PDF_URL: getEnvVar(
    'PDF_URL',
    'https://web.archive.org/web/20250601000000/https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf',
  ),
  PDF_URL_FALLBACK: getEnvVar(
    'PDF_URL_FALLBACK',
    'https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf',
  ),

  // PDF processing
  PDF_FILE: getEnvVar('PDF_FILENAME', 'Goethe-Zertifikat_B1_Wortliste.pdf'),
  PDF_DPI: 300,
  PAGE_START: 16,
  PAGE_END: 102,

  // Column coordinates
  LEFT_COLUMN: {
    CROP_X: 140,
    CROP_WIDTH: 1200 - 140,
    TEXT_X: 140,
    TEXT_WIDTH: 540 - 140,
    FULL_WIDTH: 1200,
  },

  RIGHT_COLUMN: {
    CROP_X: 1300,
    CROP_WIDTH: 2340 - 1300,
    TEXT_X: 1300,
    TEXT_WIDTH: 1710 - 1300,
    FULL_WIDTH: 2340,
  },

  // Layout
  Y_OFFSET: 320,
  IMAGE_HEIGHT: 3260 - 320,

  // Break detection
  BREAK_THRESHOLD: 42,

  // Output
  OUTPUT_DIR: 'output',
}

// Manual break overrides for specific pages
/**
 * Manual break overrides for problematic pages.
 *
 * The keys are "page-column" prefixes (e.g. "022-l") and each value is a
 * set of Y coordinates where a break should be forced.
 */
export const BREAK_OVERRIDES = {
  '022-l': new Set([118]),
  '026-l': new Set([348]),
  '028-l': new Set([
    304, 395, 528, 665, 1032, 1175, 1307, 1720, 1954, 2086, 2229, 2407, 2545, 2870,
  ]),
  '032-l': new Set([530]),
  '033-l': new Set([713]),
  '035-l': new Set([711, 991]),
  '037-r': new Set([1083]),
  '040-l': new Set([117]),
  '041-l': new Set([988]),
  '042-l': new Set([2728]),
  '046-r': new Set([711]),
  '048-r': new Set([2776]),
  '050-l': new Set([442]),
  '054-l': new Set([2274]),
  '057-l': new Set([2500]),
  '058-l': new Set([1676]),
  '063-r': new Set([1630]),
  '064-r': new Set([1218]),
  '065-r': new Set([1360]),
  '067-l': new Set([2502]),
  '069-r': new Set([1310]),
  '075-l': new Set([1037, 1079]),
  '077-l': new Set([576]),
  '080-l': new Set([530]),
  '081-l': new Set([1636]),
  '082-l': new Set([346]),
  '086-r': new Set([71]),
  '087-r': new Set([1080]),
  '089-l': new Set([2272]),
  '089-r': new Set([162]),
  '090-l': new Set([486, 574, 715]),
  '090-r': new Set([211]),
  '093-l': new Set([2640]),
}
