"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortName = shortName;
function shortName(person) {
    if (!person)
        return null;
    const initial = person.lastName?.trim().charAt(0);
    return initial ? `${person.firstName} ${initial}.` : person.firstName;
}
//# sourceMappingURL=short-name.js.map