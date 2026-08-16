"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.undefinedIfBlank = void 0;
const class_transformer_1 = require("class-transformer");
exports.undefinedIfBlank = (0, class_transformer_1.Transform)(({ value }) => (value === '' ? undefined : value));
//# sourceMappingURL=undefined-if-blank.transform.js.map