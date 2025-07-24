/**
 * @file utils/cn.js
 * @description A simple utility to conditionally join Tailwind CSS class names,
 * mimicking the 'clsx' or 'classnames' npm packages used in React.
 * This helps in applying dynamic classes based on conditions.
 */

/**
 * Conditionally joins class names.
 * Accepts multiple arguments which can be strings, numbers, objects, or arrays.
 * Falsy values are ignored. Objects are iterated, and keys are included if their value is truthy.
 * @param {...(string|number|object|Array<string|number|object>)} args - Class names or objects mapping class names to booleans.
 * @returns {string} A single string of joined class names.
 */
export function cn(...args) {
  const classes = [];

  args.forEach(arg => {
    if (!arg) return;

    const type = typeof arg;

    if (type === 'string' || type === 'number') {
      classes.push(arg);
    } else if (Array.isArray(arg)) {
      classes.push(cn(...arg)); // Recursively handle arrays
    } else if (type === 'object') {
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key) && arg[key]) {
          classes.push(key);
        }
      }
    }
  });

  return classes.filter(Boolean).join(' ');
}
