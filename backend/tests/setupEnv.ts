import { TEST_DATABASE_URL } from './testDatabase';

// Runs before every test file, before any app module is imported.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters';
process.env.SESSION_IDLE_MINUTES = '30';
process.env.BCRYPT_ROUNDS = '4'; // the minimum; keeps password hashing fast in tests
process.env.LOGIN_RATE_LIMIT = '1000'; // the limiter itself is tested separately
