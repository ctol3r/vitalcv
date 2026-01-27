"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceLogger = getServiceLogger;
const logging_core_1 = require("@chai-vc/logging-core");
const loggerCache = new Map();
function getServiceLogger(scope) {
    if (!loggerCache.has(scope)) {
        loggerCache.set(scope, (0, logging_core_1.createLogger)({
            service: scope.startsWith('services:') ? scope : `services:${scope}`,
        }));
    }
    return loggerCache.get(scope);
}
