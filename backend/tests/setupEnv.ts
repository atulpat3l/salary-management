import { TEST_DATABASE_URL } from './testDatabase';

// Runs before every test file, before any app module is imported.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.DATABASE_URL = TEST_DATABASE_URL;
