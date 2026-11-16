import 'dotenv/config';
import { createApp } from './app';
import { env } from './lib/env';

const app = createApp();
app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`FormCoach API listening on port ${env.port}`);
});
