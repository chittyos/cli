import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});

beforeEach(() => {
  jest.clearAllMocks();
});

jest.setTimeout(10000);

process.env.NODE_ENV = 'test';