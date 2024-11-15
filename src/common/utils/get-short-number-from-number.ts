/**
 * Converts a number to a short string representation.
 *
 * This function takes a number and converts it to a string with a suffix
 * ('K' for thousands, 'M' for millions) if the number is large enough.
 *
 * @param {number} num - The number to convert.
 * @returns {string} The short string representation of the number.
 */
export const getShortNumberFromNumber = (num: number): string => {
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + 'M';
    } else if (num >= 1_000) {
        return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + 'K';
    } else {
        return num.toString();
    }
};
