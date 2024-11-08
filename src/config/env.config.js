import {configDotenv} from 'dotenv';
import {cleanEnv, str} from 'envalid';

configDotenv({
  path: './.env',
});

const env = cleanEnv(process.env, {
  GITHUB_USERNAME: str(),
  GITHUB_TOKEN: str(),
});

export default env;
