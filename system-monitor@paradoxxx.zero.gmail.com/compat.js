const Config = imports.misc.config;
const Clutter = imports.gi.Clutter;

/** Compare two dotted version strings (like '10.2.3').
 * @returns {Integer} 0: v1 == v2, -1: v1 < v2, 1: v1 > v2
 */
function versionCompare(v1, v2) {
    let v1parts = ('' + v1).split('.')
    let v2parts = ('' + v2).split('.')
    let minLength = Math.min(v1parts.length, v2parts.length)
    let i, p1, p2;
    // Compare tuple pair-by-pair.
    for (i = 0; i < minLength; i++) {
        // Convert to integer if possible, because "8" > "10".
        p1 = parseInt(v1parts[i], 10);
        p2 = parseInt(v2parts[i], 10);
        if (isNaN(p1)) {
            p1 = v1parts[i];
        }
        if (isNaN(p2)) {
            p2 = v2parts[i];
        }
        if (p1 === p2) {
            continue;
        } else if (p1 > p2) {
            return 1;
        } else if (p1 < p2) {
            return -1;
        }
        // one operand is NaN
        return NaN;
    }
    // The longer tuple is always considered 'greater'
    if (v1parts.length === v2parts.length) {
        return 0;
    }
    return (v1parts.length < v2parts.length) ? -1 : 1;
}

function color_from_string(color) {
    let clutterColor, res;

    if (!Clutter.Color.from_string) {
        clutterColor = new Clutter.Color();
        clutterColor.from_string(color);
    } else {
        [res, clutterColor] = Clutter.Color.from_string(color);
    }

    return clutterColor;
}
