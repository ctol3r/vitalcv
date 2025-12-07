import path from 'path';
import { register } from 'tsconfig-paths';
import tsconfig from '../../../../tsconfig.base.json';

const baseUrl = path.resolve(__dirname, '../../../..');
const paths = tsconfig.compilerOptions?.paths ?? {};

const unregister = register({
  baseUrl,
  paths,
});

process.once('exit', () => {
  unregister();
});

