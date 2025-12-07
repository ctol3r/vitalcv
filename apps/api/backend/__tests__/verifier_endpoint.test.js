"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const verifier_routes_1 = require("../src/routes/verifier_routes");
const app = (0, express_1.default)();
app.use('/api', verifier_routes_1.router);
describe('verifier credential status endpoint', () => {
    it('returns a credential status', async () => {
        const res = await (0, supertest_1.default)(app).get('/api/verifier/credential/123/status');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ credentialId: '123', status: 'valid' });
    });
});
