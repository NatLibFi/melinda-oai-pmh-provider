

import {default as startApp} from './app/index.js';
import * as config from './config.js';

run();

async function run() {
  let server;

  registerInterruptionHandlers();

  server = await startApp(config);

  function registerInterruptionHandlers() {
    process.on('SIGTERM', handleSignal);
    process.on('SIGINT', handleSignal);

    process.on('uncaughtException', ({stack}) => {
      handleTermination({code: 1, message: stack});
    });

    process.on('unhandledRejection', ({stack}) => {
      handleTermination({code: 1, message: stack});
    });

    function handleTermination({code = 0, message}) {
      if (server) {
        server.close();

        if (message) {
          // eslint-disable-next-line no-console
          console.error(message);
          return process.exit(code);
        }
      }

      if (message) {
        // eslint-disable-next-line no-console
        console.error(message);
        return process.exit(code);
      }

      process.exit(code);
    }

    function handleSignal(signal) {
      handleTermination({code: 1, message: `Received ${signal}`});
    }
  }
}
